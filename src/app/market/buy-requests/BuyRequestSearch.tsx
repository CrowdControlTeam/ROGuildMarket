"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { inputClass, buttonClass, labelClass } from "@/lib/ui";

export function BuyRequestSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (q.trim()) params.set("q", q.trim());
        else params.delete("q");
        router.push(`/market/buy-requests?${params.toString()}`);
      }}
      className="mb-6 flex items-end gap-3"
    >
      <div className="flex-1">
        <label className={labelClass}>Nombre</label>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar item..."
          className={inputClass}
        />
      </div>
      <button type="submit" className={buttonClass("primary")}>
        Buscar
      </button>
    </form>
  );
}
