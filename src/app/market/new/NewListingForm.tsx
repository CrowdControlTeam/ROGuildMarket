"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createListing } from "@/lib/listings";
import { buttonClass, inputClass, labelClass } from "@/lib/ui";
import { ItemPicker } from "./ItemPicker";

export function NewListingForm() {
  const router = useRouter();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setError(null);
        try {
          const { id } = await createListing(formData);
          router.push(`/market/${id}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error inesperado");
        }
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <label className={labelClass}>Item</label>
        <ItemPicker onSelect={(item) => setSelectedItemId(item.id)} />
        <input type="hidden" name="itemId" value={selectedItemId ?? ""} />
      </div>

      <div>
        <label className={labelClass}>Cantidad</label>
        <input
          type="number"
          name="quantity"
          min={1}
          defaultValue={1}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Precio (z)</label>
        <input type="number" name="price" min={1} required className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={!selectedItemId}
        className={buttonClass("primary")}
      >
        Publicar venta
      </button>
    </form>
  );
}
