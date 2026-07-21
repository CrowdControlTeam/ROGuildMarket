"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ItemCategory,
  EquipSlot,
  WeaponType,
  ListingType,
  type ItemOptionGroup,
  type ItemOptionDef,
} from "@prisma/client";
import { CATEGORY_LABELS, SLOT_LABELS, WEAPON_TYPE_LABELS, LISTING_TYPE_LABELS } from "@/lib/market-labels";
import { getItemOptionGroup, MAX_OPTION_SLOTS } from "@/lib/item-options-constants";
import { isRefineEligible, DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";
import { getMaxCardSlots, MAX_WEAPON_CARD_SLOTS } from "@/lib/card-slots-constants";
import {
  getMagicalWeaponTypes,
  getOptionChoices,
  getMaxRefineLevel,
  getOptionsFeatureAvailable,
} from "@/lib/listings";
import { buttonClass, inputClass, inputBaseClass, selectClass, labelClass } from "@/lib/ui";
import { MaskedPriceInput } from "@/components/MaskedPriceInput";

type OptionFilterSelection = { defId: string; min: number | ""; max: number | "" };

function emptyOptionFilterSelections(): OptionFilterSelection[] {
  return Array.from({ length: MAX_OPTION_SLOTS }, () => ({ defId: "", min: "", max: "" }));
}

export function MarketFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [type, setType] = useState(searchParams.get("type") ?? "");
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
        defId: searchParams.get(`option${n}DefId`) ?? "",
        min: toNumberOrEmpty(searchParams.get(`option${n}Min`)),
        max: toNumberOrEmpty(searchParams.get(`option${n}Max`)),
      };
    }),
  );
  const [optionDefs, setOptionDefs] = useState<ItemOptionDef[]>([]);

  // null = magia/física de armas sin cargar todavía (evita resolver mal el
  // grupo de un arma mientras no sabemos qué tipos cuentan como mágicos).
  const [magicalTypes, setMagicalTypes] = useState<Set<WeaponType> | null>(null);
  useEffect(() => {
    getMagicalWeaponTypes().then((types) => setMagicalTypes(new Set(types)));
  }, []);

  // Toggle + catálogo desde /admin (ver src/lib/item-options.ts) — si está
  // apagado, la sección de options ni se carga ni se muestra, sin importar
  // qué combinación de categoría/slot/tipo de arma esté elegida.
  const [optionsFeatureAvailable, setOptionsFeatureAvailable] = useState(true);
  useEffect(() => {
    getOptionsFeatureAvailable().then(setOptionsFeatureAvailable);
  }, []);

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

  // undefined: todavía no se puede saber (falta magicalTypes). null: esta
  // combinación de filtros no tiene options. Un ItemOptionGroup: resuelto.
  const optionGroup = useMemo((): ItemOptionGroup | null | undefined => {
    if (category === ItemCategory.ARMOR && slot) {
      return getItemOptionGroup(
        { category: ItemCategory.ARMOR, slot: slot as EquipSlot, weaponType: null },
        new Set(),
      );
    }
    if (category === ItemCategory.WEAPON && weaponType) {
      if (magicalTypes === null) return undefined;
      return getItemOptionGroup(
        { category: ItemCategory.WEAPON, slot: null, weaponType: weaponType as WeaponType },
        magicalTypes,
      );
    }
    return null;
  }, [category, slot, weaponType, magicalTypes]);

  // Solo se toca optionDefs/optionSelections cuando el grupo resuelve a algo
  // concreto: si pasa a null (sin options) o undefined (aún resolviendo), no
  // se cambia nada — los filtros de option se quedan como estén, solo se
  // deshabilitan en el render (ver `groupHasOptions`). Tampoco se pide nada
  // si la función está apagada desde /admin.
  useEffect(() => {
    if (!optionsFeatureAvailable || optionGroup === null || optionGroup === undefined) return;
    getOptionChoices(optionGroup).then((defs) => {
      setOptionDefs(defs);
      setOptionSelections((prev) =>
        prev.map((sel) =>
          !sel.defId || defs.some((d) => d.id === sel.defId) ? sel : { defId: "", min: "", max: "" },
        ),
      );
    });
  }, [optionGroup, optionsFeatureAvailable]);

  const groupHasOptions = optionGroup !== null && optionGroup !== undefined;

  function handleOptionSelectChange(index: number, defId: string) {
    setOptionSelections((prev) => {
      const next = [...prev];
      next[index] = { defId, min: "", max: "" };
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

    // Los filtros de option deshabilitados (categoría sin options) no se
    // aplican, aunque el usuario los tenga rellenados en pantalla.
    optionSelections.forEach((sel, i) => {
      const n = i + 1;
      const defId = optionsFeatureAvailable && groupHasOptions ? sel.defId : "";
      setOrDelete(params, `option${n}DefId`, defId);
      setOrDelete(params, `option${n}Min`, defId && sel.min !== "" ? String(sel.min) : "");
      setOrDelete(params, `option${n}Max`, defId && sel.max !== "" ? String(sel.max) : "");
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

  function resetFilters() {
    setQ("");
    setType("");
    setCategory("");
    setSlot("");
    setWeaponType("");
    setOptionSelections(emptyOptionFilterSelections());
    setOptionDefs([]);
    setRefineMin("");
    setRefineMax("");
    setCardSlotsMin("");
    setCardSlotsMax("");
    setMinPrice("");
    setMaxPrice("");
    const params = new URLSearchParams(searchParams.toString());
    const keys = [
      "q",
      "type",
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
      keys.push(`option${n}DefId`, `option${n}Min`, `option${n}Max`);
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

      {optionsFeatureAvailable && optionDefs.length > 0 && (
        <div className="flex w-full flex-col gap-2">
          <label className={labelClass}>Options</label>
          {Array.from({ length: MAX_OPTION_SLOTS }, (_, i) => i + 1).map((slotIndex) => {
            const index = slotIndex - 1;
            const sel = optionSelections[index];
            const defsForSlot = optionDefs.filter((d) => d.slotIndex === slotIndex);
            const selectedDef = defsForSlot.find((d) => d.id === sel.defId);

            return (
              <div key={slotIndex} className="flex items-center gap-2">
                <select
                  value={sel.defId}
                  disabled={!groupHasOptions}
                  onChange={(e) => handleOptionSelectChange(index, e.target.value)}
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
                  placeholder={selectedDef ? String(selectedDef.minValue) : "Mín"}
                  value={sel.min}
                  disabled={!sel.defId}
                  onChange={(e) =>
                    handleOptionMinChange(index, e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className={`w-20 ${inputBaseClass}`}
                />
                <input
                  type="number"
                  placeholder={selectedDef ? String(selectedDef.maxValue) : "Máx"}
                  value={sel.max}
                  disabled={!sel.defId}
                  onChange={(e) =>
                    handleOptionMaxChange(index, e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className={`w-20 ${inputBaseClass}`}
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
