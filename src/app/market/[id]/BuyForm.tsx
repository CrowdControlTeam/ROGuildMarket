"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { purchaseListing } from "@/lib/listings";
import { buttonClass, inputClass, labelClass } from "@/lib/ui";
import { formatPrice, priceColorClass } from "@/lib/price";

export function BuyForm({
  listingId,
  remaining,
  unitPrice,
}: {
  listingId: string;
  remaining: number;
  unitPrice: number;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setError(null);
        try {
          await purchaseListing(listingId, formData);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error inesperado");
        }
      }}
      className="flex flex-col gap-3"
    >
      <div>
        <label className={labelClass}>Cantidad a comprar</label>
        <input
          type="number"
          name="quantity"
          min={1}
          max={remaining}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className={inputClass}
        />
      </div>

      <p className="text-sm text-ro-text-muted">
        Total:{" "}
        <span className={`font-semibold ${priceColorClass(quantity * unitPrice)}`}>
          {formatPrice(quantity * unitPrice)}
        </span>
      </p>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button type="submit" className={buttonClass("primary")}>
        Comprar
      </button>
    </form>
  );
}
