"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SORT_OPTIONS } from "@/lib/market";
import { selectClass } from "@/lib/ui";

export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "newest") {
      params.delete("sort");
    } else {
      params.set("sort", value);
    }
    // Solo cambia el orden; los filtros ya presentes en la URL se mantienen.
    router.push(`/market?${params.toString()}`);
  }

  return (
    <div className="mb-3 flex items-center justify-end gap-2">
      <label className="text-xs font-medium text-ro-text-light/80">Orden</label>
      <select
        value={searchParams.get("sort") ?? "newest"}
        onChange={(e) => handleChange(e.target.value)}
        className={selectClass}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
