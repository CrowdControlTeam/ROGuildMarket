"use client";

import { formatNumber, priceColorClass } from "@/lib/price";
import { inputClass } from "@/lib/ui";

// Input de texto controlado para cualquier campo de moneda/precio/coste:
// aplica la máscara de separador de miles y el color por rango mientras se
// escribe. Reutilizado tanto en formularios (vía PriceInput) como en los
// filtros de precio mín./máx. del mercado.
export function MaskedPriceInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number | "";
  onChange: (value: number | "") => void;
  placeholder?: string;
  className?: string;
}) {
  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    onChange(digits === "" ? "" : Number(digits));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={value === "" ? "" : formatNumber(value)}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      className={`${className ?? inputClass} ${value === "" ? "" : `font-semibold ${priceColorClass(value)}`}`}
    />
  );
}
