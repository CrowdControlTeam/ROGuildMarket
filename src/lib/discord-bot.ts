// Llamadas autenticadas "como bot" (Authorization: Bot <token>), separadas
// de auth.ts (que usa el access_token del usuario que hace login). El bot
// es opcional: de momento solo se usa para listar roles con nombre real en
// /admin — si no está configurado, el panel cae a introducir IDs a mano
// (ver AdminConfigForm.tsx). El mismo token servirá en el futuro para las
// DMs de Fase 3.

export type GuildRolesResult =
  | { status: "no_bot" }
  | { status: "error"; message: string }
  | { status: "ok"; roles: { id: string; name: string }[] };

export async function fetchGuildRoles(): Promise<GuildRolesResult> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token) return { status: "no_bot" };
  if (!guildId) return { status: "error", message: "Falta DISCORD_GUILD_ID" };

  let res: Response;
  try {
    res = await fetch(`https://discord.com/api/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${token}` },
    });
  } catch {
    return { status: "error", message: "No se pudo contactar con la API de Discord" };
  }

  if (!res.ok) {
    return {
      status: "error",
      message:
        res.status === 403 || res.status === 404
          ? "El bot no tiene acceso al servidor (¿está invitado?)"
          : `Discord respondió ${res.status}`,
    };
  }

  const roles = (await res.json()) as { id: string; name: string }[];
  return {
    status: "ok",
    roles: roles
      .filter((r) => r.name !== "@everyone")
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
