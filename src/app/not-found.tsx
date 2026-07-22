import Link from "next/link";
import { Panel } from "@/components/Panel";
import { buttonClass } from "@/lib/ui";

// Se renderiza tanto para rutas inexistentes como al llamar a notFound()
// explícitamente (ej. listing/regalo borrado o de otro usuario) — ver
// market/[id]/page.tsx.
export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <Panel>
        <h1 className="font-heading text-lg text-ro-gold">No encontrado</h1>
        <p className="mt-2 text-sm text-ro-text-muted">
          Esta página no existe o el elemento que buscas ya no está disponible.
        </p>
        <Link href="/market" className={`mt-4 inline-flex ${buttonClass("secondary")}`}>
          Volver al mercado
        </Link>
      </Panel>
    </main>
  );
}
