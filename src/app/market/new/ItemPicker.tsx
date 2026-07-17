"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { searchItems } from "@/lib/listings";
import { inputClass } from "@/lib/ui";

type ItemResult = {
  id: string;
  name: string;
  iconUrl: string;
  category: string;
};

export function ItemPicker({
  onSelect,
}: {
  onSelect: (item: ItemResult) => void;
}) {
  const [query, setQuery] = useState("");
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
                <span>{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
