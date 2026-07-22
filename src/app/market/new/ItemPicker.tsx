"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { searchItems } from "@/lib/listings";
import { inputClass } from "@/lib/ui";
import { CATEGORY_LABELS, WEAPON_TYPE_LABELS } from "@/lib/market-labels";

export type ItemResult = Awaited<ReturnType<typeof searchItems>>[number];

// El catálogo tiene bastantes nombres duplicados (p.ej. dos "Arc Wand": un
// arma real y un costume cosmético) — sin esta pista, elegir el resultado
// equivocado en la lista es indistinguible hasta publicar, y ese es
// justo el item cuya categoría/tipo decide si aparecen refine/slots/options.
function itemHint(item: ItemResult): string {
  if (item.category === "WEAPON" && item.weaponType) {
    return `${CATEGORY_LABELS[item.category]} · ${WEAPON_TYPE_LABELS[item.weaponType]}`;
  }
  return CATEGORY_LABELS[item.category];
}

export function ItemPicker({
  onSelect,
  initialQuery,
}: {
  onSelect: (item: ItemResult) => void;
  // Texto inicial del input cuando la selección viene de fuera (p.ej. el
  // reconocimiento por captura). El padre fuerza un remount (key={item.id})
  // cuando cambia la selección en vez de sincronizar esto en un efecto.
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<ItemResult[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    setQuery(value);
    startTransition(async () => {
      const found = await searchItems(value);
      setResults(found);
    });
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Busca un item por nombre..."
        className={inputClass}
      />
      {isPending && (
        <p className="mt-1 text-sm text-ro-text-muted">Buscando...</p>
      )}
      {results.length > 0 && (
        <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border-2 border-ro-panel-border bg-ro-panel-alt p-1">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(item);
                  setQuery(item.name);
                  setResults([]);
                }}
                className="flex w-full items-center gap-2 rounded-md p-2 text-left text-ro-text hover:bg-ro-gold/20"
              >
                <Image src={item.iconUrl} alt={item.name} width={24} height={24} />
                <span className="flex-1">
                  {item.name}
                  <span className="block text-xs text-ro-text-muted">{itemHint(item)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
