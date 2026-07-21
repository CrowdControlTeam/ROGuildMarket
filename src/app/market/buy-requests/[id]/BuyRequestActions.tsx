"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBuyRequest, fulfillBuyRequest } from "@/lib/buy-requests";
import { buttonClass } from "@/lib/ui";

export function BuyRequestActions({ buyRequestId }: { buyRequestId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action(buyRequestId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado");
      }
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(fulfillBuyRequest)}
          className={buttonClass("primary")}
        >
          Marcar como cumplida
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(cancelBuyRequest)}
          className={buttonClass("outline")}
        >
          Cancelar
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
