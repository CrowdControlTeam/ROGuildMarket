"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markListingSold } from "@/lib/listings";
import { buttonClass } from "@/lib/ui";

export function MarkSoldButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await markListingSold(listingId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Error inesperado");
            }
          });
        }}
        className={buttonClass("primary")}
      >
        {isPending ? "Marcando..." : "Marcar como vendida"}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
