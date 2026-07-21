"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBuyRequest } from "@/lib/buy-requests";
import { buttonClass, inputClass, labelClass } from "@/lib/ui";
import { PriceInput } from "@/components/PriceInput";
import { ItemPicker, type ItemResult } from "@/app/market/new/ItemPicker";

export function NewBuyRequestForm() {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<ItemResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setError(null);
        try {
          const { id } = await createBuyRequest(formData);
          router.push(`/market/${id}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error inesperado");
        }
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <label className={labelClass}>Item</label>
        <ItemPicker onSelect={setSelectedItem} initialQuery={selectedItem?.name} />
        <input type="hidden" name="itemId" value={selectedItem?.id ?? ""} />
      </div>

      <div>
        <label className={labelClass}>Cantidad</label>
        <input type="number" name="quantity" min={1} defaultValue={1} required className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Pago hasta (z)</label>
        <PriceInput name="maxPrice" placeholder="0" />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={!selectedItem} className={buttonClass("primary")}>
        Publicar petición
      </button>
    </form>
  );
}
