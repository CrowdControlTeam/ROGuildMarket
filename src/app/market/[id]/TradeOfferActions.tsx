"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptTradeOffer, rejectTradeOffer, cancelTradeOffer } from "@/lib/trade-offers";
import { buttonClass } from "@/lib/ui";
import { getErrorMessage } from "@/lib/errors";

export function TradeOfferActions({
  offerId,
  role,
}: {
  offerId: string;
  role: "seller" | "offerer";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action(offerId);
        router.refresh();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        {role === "seller" ? (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(acceptTradeOffer)}
              className={buttonClass("primary")}
            >
              Aceptar
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(rejectTradeOffer)}
              className={buttonClass("outline")}
            >
              Rechazar
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(cancelTradeOffer)}
            className={buttonClass("outline")}
          >
            Cancelar oferta
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
