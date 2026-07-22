"use client";

import { useEffect } from "react";
import { Panel } from "@/components/Panel";
import { buttonClass } from "@/lib/ui";

// Boundary raíz: envuelve todas las páginas/layouts por debajo de este
// (NO el propio layout.tsx — para eso hace falta global-error.tsx aparte).
// Sin este archivo, cualquier fallo no controlado en un Server Component
// (ej. la base de datos no responde) mostraba la pantalla genérica de
// Next ("Application error...") sin ningún mensaje útil para el usuario.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <Panel>
        <h1 className="font-heading text-lg text-ro-gold">Algo ha ido mal</h1>
        <p className="mt-2 text-sm text-ro-text-muted">
          Ha ocurrido un error inesperado. Puedes intentarlo de nuevo.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className={`mt-4 ${buttonClass("secondary")}`}
        >
          Reintentar
        </button>
      </Panel>
    </main>
  );
}
