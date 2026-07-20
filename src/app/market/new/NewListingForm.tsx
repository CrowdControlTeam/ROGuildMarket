"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ItemOptionDef } from "@prisma/client";
import { createListing, getOptionChoices, getMaxRefineLevel } from "@/lib/listings";
import { buttonClass, inputClass, inputBaseClass, selectClass, labelClass } from "@/lib/ui";
import { PriceInput } from "@/components/PriceInput";
import {
  MAX_OPTION_SLOTS,
  emptyOptionSelections,
  type OptionSelection,
} from "@/lib/item-options-constants";
import { isRefineEligible, DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";
import { ItemPicker, type ItemResult } from "./ItemPicker";

export function NewListingForm() {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<ItemResult | null>(null);
  const [optionDefs, setOptionDefs] = useState<ItemOptionDef[]>([]);
  const [optionSelections, setOptionSelections] = useState<OptionSelection[]>(
    emptyOptionSelections(),
  );
  const [error, setError] = useState<string | null>(null);
  const [maxRefineLevel, setMaxRefineLevel] = useState(DEFAULT_MAX_REFINE_LEVEL);

  useEffect(() => {
    getMaxRefineLevel().then(setMaxRefineLevel);
  }, []);

  const optionGroup = selectedItem?.optionGroup ?? null;
  const refineEligible = selectedItem !== null && isRefineEligible(selectedItem);

  // El reset de optionSelections se dispara desde el evento de selección de
  // item (handleItemSelect más abajo), no aquí: sincronizar dos piezas de
  // estado dentro de un efecto dispara un render en cascada innecesario.
  useEffect(() => {
    // Si el item no es elegible no hace falta limpiar optionDefs: el check
    // de optionGroup en hasOptionCatalog ya oculta la sección igualmente.
    if (!optionGroup) return;
    getOptionChoices(optionGroup).then(setOptionDefs);
  }, [optionGroup]);

  const hasOptionCatalog = optionGroup !== null && optionDefs.length > 0;

  function handleItemSelect(item: ItemResult) {
    setSelectedItem(item);
    setOptionSelections(emptyOptionSelections());
  }

  // Elegir un option real en `index` habilita su input y desbloquea la
  // siguiente fila. Volver al placeholder limpia esa fila y todas las
  // siguientes: las options siempre ocupan las posiciones desde 1 sin
  // huecos, así que no puede quedar la 2 rellena sin la 1.
  function handleSelectChange(index: number, defId: string) {
    setOptionSelections((prev) => {
      const next = [...prev];
      if (!defId) {
        for (let i = index; i < next.length; i++) next[i] = { defId: "", value: "" };
        return next;
      }
      // Sin valor por defecto: el input arranca vacío (el rango se ve en el
      // placeholder) para que el usuario solo tenga que escribir, no borrar.
      next[index] = { defId, value: "" };
      return next;
    });
  }

  function handleValueChange(index: number, value: number | "") {
    setOptionSelections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], value };
      return next;
    });
  }

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
        <ItemPicker onSelect={handleItemSelect} />
        <input type="hidden" name="itemId" value={selectedItem?.id ?? ""} />
      </div>

      <div>
        <label className={labelClass}>Cantidad</label>
        {optionGroup ? (
          <>
            <p className="text-sm text-ro-text-muted">1</p>
            <input type="hidden" name="quantity" value={1} />
          </>
        ) : (
          <input
            type="number"
            name="quantity"
            min={1}
            defaultValue={1}
            required
            className={inputClass}
          />
        )}
      </div>

      {refineEligible && (
        <div>
          <label className={labelClass}>Refine</label>
          <input
            type="number"
            name="refineLevel"
            min={0}
            max={maxRefineLevel}
            defaultValue={0}
            className={inputClass}
          />
        </div>
      )}

      <div>
        <label className={labelClass}>Precio (z)</label>
        <PriceInput name="price" placeholder="0" />
      </div>

      {hasOptionCatalog && (
        <div>
          <label className={labelClass}>Options</label>
          <div className="flex flex-col gap-2">
            {Array.from({ length: MAX_OPTION_SLOTS }, (_, i) => i + 1).map((slotIndex) => {
              const index = slotIndex - 1;
              const selectEnabled = index === 0 || optionSelections[index - 1].defId !== "";
              const selection = optionSelections[index];
              const defsForSlot = optionDefs.filter((d) => d.slotIndex === slotIndex);
              const selectedDef = defsForSlot.find((d) => d.id === selection.defId);
              // Solo se marca en rojo si hay un valor escrito y se sale del
              // rango — nunca por estar vacío (required ya lo cubre al
              // enviar, sin necesidad de pintarlo antes de que el usuario
              // escriba nada).
              const isOutOfRange =
                selectedDef !== undefined &&
                selection.value !== "" &&
                (selection.value < selectedDef.minValue || selection.value > selectedDef.maxValue);

              return (
                <div key={slotIndex} className="flex items-center gap-2">
                  <select
                    name={`option${slotIndex}DefId`}
                    value={selection.defId}
                    disabled={!selectEnabled}
                    onChange={(e) => handleSelectChange(index, e.target.value)}
                    className={`min-w-0 flex-1 ${selectClass}`}
                  >
                    <option value="">{`-- Option ${slotIndex} --`}</option>
                    {defsForSlot.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    name={`option${slotIndex}Value`}
                    min={selectedDef?.minValue}
                    max={selectedDef?.maxValue}
                    placeholder={selectedDef ? `${selectedDef.minValue} - ${selectedDef.maxValue}` : undefined}
                    value={selection.value}
                    disabled={!selection.defId}
                    required={!!selection.defId}
                    onChange={(e) =>
                      handleValueChange(index, e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className={`w-28 ${inputBaseClass}`}
                    // Un className condicional no basta: focus:border-ro-gold-dark
                    // de inputBaseClass le gana a un focus:border-red-600 según
                    // el orden interno con el que Tailwind genera el CSS, no el
                    // orden de escritura. El estilo inline sí tiene prioridad
                    // garantizada sobre cualquier clase, enfocado o no.
                    style={isOutOfRange ? { borderColor: "#dc2626" } : undefined}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={!selectedItem}
        className={buttonClass("primary")}
      >
        Publicar venta
      </button>
    </form>
  );
}
