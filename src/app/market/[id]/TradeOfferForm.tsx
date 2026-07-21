"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createTradeOffer } from "@/lib/trade-offers";
import { getMaxRefineLevel } from "@/lib/listings";
import { buttonClass, inputClass, labelClass } from "@/lib/ui";
import { isRefineEligible, DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";
import { getMaxCardSlots } from "@/lib/card-slots-constants";
import { ItemPicker, type ItemResult } from "../new/ItemPicker";

export function TradeOfferForm({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<ItemResult | null>(null);
  const [refineLevel, setRefineLevel] = useState(0);
  const [cardSlots, setCardSlots] = useState(0);
  const [maxRefineLevel, setMaxRefineLevel] = useState(DEFAULT_MAX_REFINE_LEVEL);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMaxRefineLevel().then(setMaxRefineLevel);
  }, []);

  const refineEligible = selectedItem !== null && isRefineEligible(selectedItem);
  const maxCardSlots = selectedItem !== null ? getMaxCardSlots(selectedItem) : 0;

  function handleItemSelect(item: ItemResult) {
    setSelectedItem(item);
    setRefineLevel(0);
    setCardSlots(0);
  }

  return (
    <form
      action={async (formData) => {
        setError(null);
        try {
          await createTradeOffer(listingId, formData);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error inesperado");
        }
      }}
      className="flex flex-col gap-3"
    >
      <div>
        <label className={labelClass}>Ofrecer item</label>
        <ItemPicker key={selectedItem?.id ?? "empty"} onSelect={handleItemSelect} />
        <input type="hidden" name="itemId" value={selectedItem?.id ?? ""} />
      </div>

      <div>
        <label className={labelClass}>Cantidad</label>
        <input type="number" name="quantity" min={1} defaultValue={1} required className={inputClass} />
      </div>

      {refineEligible && (
        <div>
          <label className={labelClass}>Refine</label>
          <input
            type="number"
            name="refineLevel"
            min={0}
            max={maxRefineLevel}
            value={refineLevel}
            onChange={(e) => setRefineLevel(e.target.value === "" ? 0 : Number(e.target.value))}
            className={inputClass}
          />
        </div>
      )}

      {maxCardSlots > 0 && (
        <div>
          <label className={labelClass}>Slots de carta</label>
          <input
            type="number"
            name="cardSlots"
            min={0}
            max={maxCardSlots}
            value={cardSlots}
            onChange={(e) => setCardSlots(e.target.value === "" ? 0 : Number(e.target.value))}
            className={inputClass}
          />
        </div>
      )}

      <div>
        <label className={labelClass}>Zeny adicional (opcional)</label>
        <input type="number" name="zenyOffered" min={0} defaultValue={0} className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={!selectedItem} className={buttonClass("primary")}>
        Enviar oferta
      </button>
    </form>
  );
}
