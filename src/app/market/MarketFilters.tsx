"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ItemCategory, EquipSlot, WeaponType, ListingType, type ItemOptionDef } from "@prisma/client";
import { CATEGORY_LABELS, SLOT_LABELS, WEAPON_TYPE_LABELS, LISTING_TYPE_LABELS } from "@/lib/market-labels";
import { MAX_OPTION_SLOTS } from "@/lib/item-options-constants";
import { isRefineEligible, DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";
import { getMaxCardSlots, MAX_WEAPON_CARD_SLOTS } from "@/lib/card-slots-constants";
import {
  getAllOptionChoices,
  getMaxRefineLevel,
  getOptionsFeatureAvailable,
} from "@/lib/listings";
import { buttonClass, inputClass, inputBaseClass, selectClass, labelClass } from "@/lib/ui";
import { MaskedPriceInput } from "@/components/MaskedPriceInput";

type OptionFilterSelection = { statCode: string; min: number | ""; max: number | "" };

function emptyOptionFilterSelections(): OptionFilterSelection[] {
  return Array.from({ length: MAX_OPTION_SLOTS }, () => ({ statCode: "", min: "", max: "" }));
}

// Un mismo stat (p.ej. "MaxHP %") existe como filas de ItemOptionDef
// distintas en cada grupo (armadura/prenda/calzado/arma física/arma
// mágica) — el filtro busca por posición sin importar el grupo, así que
// aquí se dedupea por statCode, fusionando el rango [min,max] de todas las
// filas que comparten stat+posición (solo afecta al placeholder, la query
// real no depende de este rango).
type StatOption = { statCode: string; label: string; minValue: number; maxValue: number };

function dedupeByStat(defs: ItemOptionDef[]): StatOption[] {
  const byCode = new Map<string, StatOption>();
  for (const d of defs) {
    const existing = byCode.get(d.statCode);
    if (existing) {
      existing.minValue = Math.min(existing.minValue, d.minValue);
      existing.maxValue = Math.max(existing.maxValue, d.maxValue);
    } else {
      byCode.set(d.statCode, { statCode: d.statCode, label: d.label, minValue: d.minValue, maxValue: d.maxValue });
    }
  }
  return Array.from(byCode.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function MarketFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [type, setType] = useState(searchParams.get("type") ?? "");
  // Cuando se llega con un tipo ya fijado en la URL (menú Vender/Comprar/
  // Comerciar, o un filtro de Tipo ya aplicado), el selector se oculta —
  // la propia vista pasa a "ser" de ese tipo. "Reset" (o volver a
  // Mercado) lo despeja y el selector reaparece.
  const typeLocked = !!searchParams.get("type");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [slot, setSlot] = useState(searchParams.get("slot") ?? "");
  const [weaponType, setWeaponType] = useState(searchParams.get("weaponType") ?? "");
  const [minPrice, setMinPrice] = useState<number | "">(
    toNumberOrEmpty(searchParams.get("minPrice")),
  );
  const [maxPrice, setMaxPrice] = useState<number | "">(
    toNumberOrEmpty(searchParams.get("maxPrice")),
  );
  const [refineMin, setRefineMin] = useState<number | "">(
    toNumberOrEmpty(searchParams.get("refineMin")),
  );
  const [refineMax, setRefineMax] = useState<number | "">(
    toNumberOrEmpty(searchParams.get("refineMax")),
  );
  const [maxRefineLevel, setMaxRefineLevel] = useState(DEFAULT_MAX_REFINE_LEVEL);
  useEffect(() => {
    getMaxRefineLevel().then(setMaxRefineLevel);
  }, []);
  const [cardSlotsMin, setCardSlotsMin] = useState<number | "">(
    toNumberOrEmpty(searchParams.get("cardSlotsMin")),
  );
  const [cardSlotsMax, setCardSlotsMax] = useState<number | "">(
    toNumberOrEmpty(searchParams.get("cardSlotsMax")),
  );

  const [optionSelections, setOptionSelections] = useState<OptionFilterSelection[]>(() =>
    Array.from({ length: MAX_OPTION_SLOTS }, (_, i) => {
      const n = i + 1;
      return {
        statCode: searchParams.get(`option${n}Stat`) ?? "",
        min: toNumberOrEmpty(searchParams.get(`option${n}Min`)),
        max: toNumberOrEmpty(searchParams.get(`option${n}Max`)),
      };
    }),
  );
  // Colapsado por defecto salvo que ya llegue con algún filtro de option
  // aplicado desde la URL — si no, el bloque entero (con hasta 3 filas de
  // desplegable + inputs) ocuparía sitio en todas las vistas del mercado
  // aunque casi nunca se use, ahora que ya no depende de elegir categoría
  // para aparecer.
  const [optionsExpanded, setOptionsExpanded] = useState(() =>
    optionSelections.some((sel) => sel.statCode !== ""),
  );
  // Catálogo entero (194 filas), cargado una sola vez — a diferencia del
  // formulario de publicar, el filtro no necesita saber la categoría/slot/
  // tipo de arma de antemano: busca por stat en una posición concreta sin
  // importar de qué grupo salga (ver dedupeByStat), así que puede estar
  // siempre visible en vez de aparecer solo tras elegir categoría.
  const [allOptionDefs, setAllOptionDefs] = useState<ItemOptionDef[]>([]);

  // Toggle + catálogo desde /admin (ver src/lib/item-options.ts) — si está
  // apagado, la sección de options ni se carga ni se muestra.
  const [optionsFeatureAvailable, setOptionsFeatureAvailable] = useState(true);
  useEffect(() => {
    getOptionsFeatureAvailable().then((available) => {
      setOptionsFeatureAvailable(available);
      if (available) getAllOptionChoices().then(setAllOptionDefs);
    });
  }, []);

  const statsBySlot = useMemo(() => {
    const bySlot: StatOption[][] = [];
    for (let slotIndex = 1; slotIndex <= MAX_OPTION_SLOTS; slotIndex++) {
      bySlot.push(dedupeByStat(allOptionDefs.filter((d) => d.slotIndex === slotIndex)));
    }
    return bySlot;
  }, [allOptionDefs]);

  // En BUY, `value` de cada option es el mínimo que pide el comprador, no
  // el roll real de un item (ver comentario de ListingOption en
  // schema.prisma) — no tiene sentido acotar por abajo lo que otro pide
  // como mínimo, así que el filtro "mín." se oculta y el que queda se
  // relee como "mi item tiene este valor, ¿qué compras cumpliría?"
  // (mismo `lte` que ya usa el filtro normal, solo cambia qué representa).
  const isBuyFilter = type === "BUY";

  const showSlot = category === ItemCategory.ARMOR || category === ItemCategory.CARD || category === "";
  const showWeaponType = category === ItemCategory.WEAPON || category === "";

  // A diferencia de las options, el refine no tiene "pool equivocado" — es
  // el mismo rango [0, maxRefineLevel] para cualquier equipo elegible, así
  // que solo hace falta habilitar/deshabilitar, nunca limpiar el valor.
  const refineFilterEnabled =
    category === "" ||
    category === ItemCategory.WEAPON ||
    (category === ItemCategory.ARMOR &&
      (slot === "" || isRefineEligible({ category: ItemCategory.ARMOR, slot: slot as EquipSlot })));

  // Mismo patrón que refineFilterEnabled — el tope varía según la categoría
  // (arma hasta 4, armadura hasta 1, salvo casco inferior 0), así que
  // también se recalcula el máximo permitido en el input, no solo si está
  // habilitado.
  const cardSlotsFilterEnabled =
    category === "" ||
    category === ItemCategory.WEAPON ||
    (category === ItemCategory.ARMOR &&
      (slot === "" || getMaxCardSlots({ category: ItemCategory.ARMOR, slot: slot as EquipSlot }) > 0));
  const cardSlotsFilterMax =
    category === ItemCategory.ARMOR && slot
      ? getMaxCardSlots({ category: ItemCategory.ARMOR, slot: slot as EquipSlot })
      : MAX_WEAPON_CARD_SLOTS;

  function handleOptionSelectChange(index: number, statCode: string) {
    setOptionSelections((prev) => {
      const next = [...prev];
      next[index] = { statCode, min: "", max: "" };
      return next;
    });
  }

  function handleOptionMinChange(index: number, value: number | "") {
    setOptionSelections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], min: value };
      return next;
    });
  }

  function handleOptionMaxChange(index: number, value: number | "") {
    setOptionSelections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], max: value };
      return next;
    });
  }

  // El orden vive en la tabla de resultados (ver SortSelect), no aquí:
  // lo conservamos tal cual esté en la URL al aplicar o resetear filtros.
  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    setOrDelete(params, "q", q.trim());
    setOrDelete(params, "type", type);
    setOrDelete(params, "category", category);
    setOrDelete(params, "slot", slot);
    setOrDelete(params, "weaponType", weaponType);

    // En BUY, "mín." no se manda nunca — ese input ni se renderiza (ver
    // isBuyFilter).
    optionSelections.forEach((sel, i) => {
      const n = i + 1;
      setOrDelete(params, `option${n}Stat`, sel.statCode);
      setOrDelete(params, `option${n}Min`, !isBuyFilter && sel.statCode && sel.min !== "" ? String(sel.min) : "");
      setOrDelete(params, `option${n}Max`, sel.statCode && sel.max !== "" ? String(sel.max) : "");
    });

    setOrDelete(
      params,
      "refineMin",
      refineFilterEnabled && refineMin !== "" ? String(refineMin) : "",
    );
    setOrDelete(
      params,
      "refineMax",
      refineFilterEnabled && refineMax !== "" ? String(refineMax) : "",
    );

    setOrDelete(
      params,
      "cardSlotsMin",
      cardSlotsFilterEnabled && cardSlotsMin !== "" ? String(cardSlotsMin) : "",
    );
    setOrDelete(
      params,
      "cardSlotsMax",
      cardSlotsFilterEnabled && cardSlotsMax !== "" ? String(cardSlotsMax) : "",
    );

    setOrDelete(params, "minPrice", minPrice === "" ? "" : String(minPrice));
    setOrDelete(params, "maxPrice", maxPrice === "" ? "" : String(maxPrice));
    // Cambiar filtros reinicia la paginación (sin cursor).
    router.push(`/market?${params.toString()}`);
  }

  // "type" no se toca aquí a propósito: dentro de una vista ya filtrada por
  // tipo (Ventas/Compras/Intercambios, con el selector "Tipo" oculto),
  // Reset limpia el resto de filtros pero se queda en esa misma vista — para
  // volver al Mercado general está el propio enlace "Mercado" del menú, no
  // hace falta que Reset también sirva de vía de escape.
  function resetFilters() {
    setQ("");
    setCategory("");
    setSlot("");
    setWeaponType("");
    setOptionSelections(emptyOptionFilterSelections());
    setRefineMin("");
    setRefineMax("");
    setCardSlotsMin("");
    setCardSlotsMax("");
    setMinPrice("");
    setMaxPrice("");
    const params = new URLSearchParams(searchParams.toString());
    const keys = [
      "q",
      "category",
      "slot",
      "weaponType",
      "refineMin",
      "refineMax",
      "cardSlotsMin",
      "cardSlotsMax",
      "minPrice",
      "maxPrice",
    ];
    for (let n = 1; n <= MAX_OPTION_SLOTS; n++) {
      keys.push(`option${n}Stat`, `option${n}Min`, `option${n}Max`);
    }
    keys.forEach((key) => params.delete(key));
    router.push(`/market?${params.toString()}`);
  }

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

      {!typeLocked && (
        <div>
          <label className={labelClass}>Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
            <option value="">Todas</option>
            {Object.values(ListingType).map((t) => (
              <option key={t} value={t}>
                {LISTING_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelClass}>Categoría</label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            if (e.target.value !== ItemCategory.ARMOR && e.target.value !== ItemCategory.CARD) {
              setSlot("");
            }
            if (e.target.value !== ItemCategory.WEAPON) {
              setWeaponType("");
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
        <label className={labelClass}>Armadura</label>
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
        <label className={labelClass}>Tipo de arma</label>
        <select
          value={weaponType}
          disabled={!showWeaponType}
          onChange={(e) => setWeaponType(e.target.value)}
          className={selectClass}
        >
          <option value="">Cualquiera</option>
          {Object.values(WeaponType).map((w) => (
            <option key={w} value={w}>
              {WEAPON_TYPE_LABELS[w]}
            </option>
          ))}
        </select>
      </div>

      {/* Agrupados para que salten de línea juntos al hacer wrap, en vez de
          partirse por la mitad. */}
      <div className="flex gap-3">
        <div>
          <label className={labelClass}>Refine mín.</label>
          <input
            type="number"
            min={0}
            max={maxRefineLevel}
            value={refineMin}
            disabled={!refineFilterEnabled}
            onChange={(e) => setRefineMin(e.target.value === "" ? "" : Number(e.target.value))}
            className={`w-20 ${inputBaseClass}`}
          />
        </div>

        <div>
          <label className={labelClass}>Refine máx.</label>
          <input
            type="number"
            min={0}
            max={maxRefineLevel}
            value={refineMax}
            disabled={!refineFilterEnabled}
            onChange={(e) => setRefineMax(e.target.value === "" ? "" : Number(e.target.value))}
            className={`w-20 ${inputBaseClass}`}
          />
        </div>
      </div>

      {/* Agrupados para que salten de línea juntos al hacer wrap, en vez de
          partirse por la mitad. */}
      <div className="flex gap-3">
        <div>
          <label className={labelClass}>Slots mín.</label>
          <input
            type="number"
            min={0}
            max={cardSlotsFilterMax}
            value={cardSlotsMin}
            disabled={!cardSlotsFilterEnabled}
            onChange={(e) => setCardSlotsMin(e.target.value === "" ? "" : Number(e.target.value))}
            className={`w-20 ${inputBaseClass}`}
          />
        </div>

        <div>
          <label className={labelClass}>Slots máx.</label>
          <input
            type="number"
            min={0}
            max={cardSlotsFilterMax}
            value={cardSlotsMax}
            disabled={!cardSlotsFilterEnabled}
            onChange={(e) => setCardSlotsMax(e.target.value === "" ? "" : Number(e.target.value))}
            className={`w-20 ${inputBaseClass}`}
          />
        </div>
      </div>

      {/* Agrupados para que salten de línea juntos al hacer wrap, en vez de
          partirse por la mitad. */}
      <div className="flex gap-3">
        <div>
          <label className={labelClass}>Precio mín.</label>
          <MaskedPriceInput
            value={minPrice}
            onChange={setMinPrice}
            className={`w-36 ${inputBaseClass}`}
          />
        </div>

        <div>
          <label className={labelClass}>Precio máx.</label>
          <MaskedPriceInput
            value={maxPrice}
            onChange={setMaxPrice}
            className={`w-36 ${inputBaseClass}`}
          />
        </div>
      </div>

      {/* Agrupados para que salten de línea juntos al hacer wrap, en vez de
          quedar cada uno en una línea distinta. */}
      <div className="flex gap-3">
        <button type="submit" className={buttonClass("primary")}>
          Buscar
        </button>
        <button type="button" onClick={resetFilters} className={buttonClass("outline")}>
          Reset
        </button>
      </div>

      {optionsFeatureAvailable && allOptionDefs.length > 0 && (
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={() => setOptionsExpanded((prev) => !prev)}
            aria-expanded={optionsExpanded}
            className={`flex items-center gap-1 ${labelClass}`}
          >
            Options
            {optionsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {optionsExpanded && isBuyFilter && (
            <p className="-mt-1 text-xs italic text-ro-text-muted">
              Busca compras que un item tuyo con estos valores cumpliría.
            </p>
          )}
          {optionsExpanded &&
          Array.from({ length: MAX_OPTION_SLOTS }, (_, i) => i + 1).map((slotIndex) => {
            const index = slotIndex - 1;
            const sel = optionSelections[index];
            const statsForSlot = statsBySlot[index];
            const selectedStat = statsForSlot.find((s) => s.statCode === sel.statCode);
            // Mismo criterio que NewPublicationForm: solo se marca en rojo si
            // hay un valor escrito y se sale del rango real de esa stat,
            // nunca por estar vacío.
            const isMinOutOfRange =
              selectedStat !== undefined &&
              sel.min !== "" &&
              (sel.min < selectedStat.minValue || sel.min > selectedStat.maxValue);
            const isMaxOutOfRange =
              selectedStat !== undefined &&
              sel.max !== "" &&
              (sel.max < selectedStat.minValue || sel.max > selectedStat.maxValue);

            return (
              <div key={slotIndex} className="flex items-center gap-2">
                <select
                  value={sel.statCode}
                  onChange={(e) => handleOptionSelectChange(index, e.target.value)}
                  className={`min-w-0 flex-1 ${selectClass}`}
                >
                  <option value="">{`-- Option ${slotIndex} --`}</option>
                  {statsForSlot.map((s) => (
                    <option key={s.statCode} value={s.statCode}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {!isBuyFilter && (
                  <input
                    type="number"
                    placeholder={selectedStat ? String(selectedStat.minValue) : "Mín"}
                    value={sel.min}
                    disabled={!sel.statCode}
                    onChange={(e) =>
                      handleOptionMinChange(index, e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className={`w-20 ${inputBaseClass}`}
                    // Un className condicional no basta aquí — ver el mismo
                    // comentario en NewPublicationForm.tsx.
                    style={isMinOutOfRange ? { borderColor: "#dc2626" } : undefined}
                  />
                )}
                <input
                  type="number"
                  placeholder={
                    selectedStat
                      ? isBuyFilter
                        ? `${selectedStat.minValue}-${selectedStat.maxValue}`
                        : String(selectedStat.maxValue)
                      : isBuyFilter
                        ? "Valor"
                        : "Máx"
                  }
                  value={sel.max}
                  disabled={!sel.statCode}
                  onChange={(e) =>
                    handleOptionMaxChange(index, e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className={`w-20 ${inputBaseClass}`}
                  style={isMaxOutOfRange ? { borderColor: "#dc2626" } : undefined}
                />
              </div>
            );
          })}
        </div>
      )}
    </form>
  );
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}

function toNumberOrEmpty(value: string | null): number | "" {
  if (!value) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}
