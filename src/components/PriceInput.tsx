"use client";

import { useState } from "react";
import { MaskedPriceInput } from "./MaskedPriceInput";

// Versión "de formulario" de MaskedPriceInput: guarda su propio estado y
// expone el valor sin formatear vía un input oculto, para que viaje en el
// FormData tal cual espera el server action (createListing, etc.).
export function PriceInput({
  name,
  defaultValue,
  placeholder,
}: {
  name: string;
  defaultValue?: number;
  placeholder?: string;
}) {
  const [value, setValue] = useState<number | "">(defaultValue ?? "");

  return (
    <>
      <MaskedPriceInput value={value} onChange={setValue} placeholder={placeholder} />
      <input type="hidden" name={name} value={value} />
    </>
  );
}
