import Link from "next/link";
import { Panel } from "@/components/Panel";

export default function AuthErrorPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <Panel title="Acceso denegado" className="text-center">
        <div className="flex flex-col items-center gap-4">
          <p>
            Este mercado es solo para miembros de la guild. No hemos podido
            verificar que tu cuenta de Discord pertenezca al servidor de la
            guild.
          </p>
          <Link href="/" className="text-ro-gold-dark underline hover:text-ro-gold">
            Volver al inicio
          </Link>
        </div>
      </Panel>
    </main>
  );
}
