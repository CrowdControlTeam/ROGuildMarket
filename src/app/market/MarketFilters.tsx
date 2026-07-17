"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ItemCategory, EquipSlot } from "@prisma/client";
import { CATEGORY_LABELS, SLOT_LABELS } from "@/lib/market-labels";
import { buttonClass, inputClass, selectClass, labelClass } from "@/lib/ui";

export function MarketFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [slot, setSlot] = useState(searchParams.get("slot") ?? "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");

  // El orden vive en la tabla de resultados (ver SortSelect), no aquí:
  // lo conservamos tal cual esté en la URL al aplicar o resetear filtros.
  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    setOrDelete(params, "q", q.trim());
    setOrDelete(params, "category", category);
    setOrDelete(params, "slot", slot);
    setOrDelete(params, "minPrice", minPrice);
    setOrDelete(params, "maxPrice", maxPrice);
    // Cambiar filtros reinicia la paginación (sin cursor).
    router.push(`/market?${params.toString()}`);
  }

  function resetFilters() {
    setQ("");
    setCategory("");
    setSlot("");
    setMinPrice("");
    setMaxPrice("");
    const params = new URLSearchParams(searchParams.toString());
    ["q", "category", "slot", "minPrice", "maxPrice"].forEach((key) =>
      params.delete(key),
    );
    router.push(`/market?${params.toString()}`);
  }

  const showSlot = category === ItemCategory.ARMOR || category === ItemCategory.CARD || category === "";

  return (
    <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[160px] flex-1">
        <label className={labelClass}>Nombre</label>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar item..."
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Categoría</label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            if (e.target.value !== ItemCategory.ARMOR && e.target.value !== ItemCategory.CARD) {
              setSlot("");
            }
          }}
          className={selectClass}
        >
          <option value="">Todas</option>
          {Object.values(ItemCategory).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Slot</label>
        <select
          value={slot}
          disabled={!showSlot}
          onChange={(e) => setSlot(e.target.value)}
          className={selectClass}
        >
          <option value="">Cualquiera</option>
          {Object.values(EquipSlot).map((s) => (
            <option key={s} value={s}>
              {SLOT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Precio mín.</label>
        <input
          type="number"
          min={0}
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          className={`w-24 ${inputClass}`}
        />
      </div>

      <div>
        <label className={labelClass}>Precio máx.</label>
        <input
          type="number"
          min={0}
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          className={`w-24 ${inputClass}`}
        />
      </div>

      <button type="submit" className={buttonClass("primary")}>
        Buscar
      </button>
      <button type="button" onClick={resetFilters} className={buttonClass("outline")}>
        Reset
      </button>
    </form>
  );
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}
