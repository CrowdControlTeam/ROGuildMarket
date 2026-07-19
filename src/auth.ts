import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { prisma } from "@/lib/prisma";

const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!GUILD_ID) {
  throw new Error("Falta la variable de entorno DISCORD_GUILD_ID");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // Sesión corta: obliga a reautenticar (y por tanto a repasar la
  // pertenencia al guild) con regularidad, en vez de confiar en un login
  // hecho hace semanas. Ver norma de seguridad 4.2 del plan.
  session: { maxAge: 60 * 60 * 24 },
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: { scope: "identify guilds.members.read" },
      },
    }),
  ],
  callbacks: {
    // Deniega el acceso a quien no pertenezca al guild configurado.
    // Se comprueba aquí (con el access_token de esta sesión de login),
    // no solo una vez guardado el perfil. De paso, guarda/actualiza el
    // perfil mínimo del usuario (con sus roles del guild) reutilizando
    // la misma respuesta, sin una segunda llamada a la API de Discord.
    async signIn({ account, profile }) {
      if (!account?.access_token || !profile) return false;

      const res = await fetch(
        `https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`,
        { headers: { Authorization: `Bearer ${account.access_token}` } },
      );
      if (!res.ok) return false;

      const member = (await res.json()) as { roles?: string[]; nick?: string | null };
      const discordId = profile.id as string;
      // Apodo del servidor si tiene uno puesto; si no, el nombre visible de
      // Discord. Nunca el username (@handle) — así se le reconoce y se le
      // puede escribir DM sin tener que buscar quién es. Ver norma 4.1
      // "solo se muestra la información imprescindible".
      const username = (member.nick ??
        profile.global_name ??
        profile.username) as string;
      const avatarUrl = buildAvatarUrl(
        discordId,
        profile.avatar as string | null,
      );

      // La pertenencia al guild ya está confirmada en este punto: un fallo
      // guardando el perfil (p.ej. la DB caída) no debe bloquear el login
      // de alguien que sí es del guild ni disfrazarse de "no eres del
      // guild" (Auth.js manda cualquier excepción aquí al mismo
      // error=AccessDenied que un signIn()=false, así que de cara al
      // usuario serían indistinguibles). Se registra el fallo y se
      // reintentará solo el guardado en el siguiente login.
      try {
        await prisma.user.upsert({
          where: { id: discordId },
          create: {
            id: discordId,
            username,
            avatarUrl,
            guildRoles: member.roles ?? [],
          },
          update: { username, avatarUrl, guildRoles: member.roles ?? [] },
        });
      } catch (err) {
        console.error("No se pudo guardar el perfil de usuario tras el login:", err);
      }

      return true;
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const discordId = profile.id as string;
        token.discordId = discordId;
        token.avatarUrl = buildAvatarUrl(
          discordId,
          profile.avatar as string | null,
        );

        // El nombre a mostrar (apodo del servidor si lo tiene) ya lo
        // calculó y guardó signIn(); lo leemos de vuelta en vez de
        // recalcularlo aquí, que exigiría una segunda llamada a la API de
        // Discord para el mismo dato.
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: discordId },
            select: { username: true },
          });
          token.username =
            dbUser?.username ??
            ((profile.global_name ?? profile.username) as string);
        } catch {
          token.username = (profile.global_name ?? profile.username) as string;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.discordId = token.discordId as string;
      session.user.username = token.username as string;
      session.user.avatarUrl = token.avatarUrl as string | null;
      return session;
    },
  },
  pages: {
    error: "/auth/error",
  },
});

function buildAvatarUrl(discordId: string, avatarHash: string | null) {
  if (!avatarHash) return null;
  const ext = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${ext}`;
}
