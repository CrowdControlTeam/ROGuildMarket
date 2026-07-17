import Link from "next/link";
import { auth, signIn } from "@/auth";
import { Panel } from "@/components/Panel";
import { buttonClass } from "@/lib/ui";

export default async function Home() {
  const session = await auth();

  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-16">
      <Panel title="Bienvenido" className="w-full text-center">
        {session?.user ? (
          <div className="flex flex-col items-center gap-4">
            <p>
              Hola, <strong>{session.user.username}</strong>. ¿Qué se cuece
              hoy en el mercado de la guild?
            </p>
            <Link href="/market" className={buttonClass("primary")}>
              Ir al mercado
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p>
              Mercado privado para miembros de la guild. Inicia sesión con
              Discord para entrar.
            </p>
            <form
              action={async () => {
                "use server";
                await signIn("discord");
              }}
            >
              <button type="submit" className={buttonClass("discord")}>
                Iniciar sesión con Discord
              </button>
            </form>
          </div>
        )}
      </Panel>
    </main>
  );
}
