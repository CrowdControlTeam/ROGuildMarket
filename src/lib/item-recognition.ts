"use server";

import { ItemCategory, EquipSlot, WeaponType, ItemOptionGroup } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import {
  MAX_OPTION_SLOTS,
  getItemOptionGroup,
  loadMagicalWeaponTypes,
  isOptionsFeatureAvailable,
} from "@/lib/item-options";
import { isRefineEligible, loadMaxRefineLevel } from "@/lib/refine";
import { getMaxCardSlots } from "@/lib/card-slots-constants";
import { findBestMatch } from "@/lib/fuzzy-match";
import { loadMarketConfig } from "@/lib/market-config";

// Hace falta el toggle activo (configurable en /admin) Y la variable de
// entorno GEMINI_API_KEY seteada — la key nunca se guarda en base de datos.
// El caller (la página del formulario de venta) usa esto para decidir si
// renderiza el bloque de reconocimiento, no solo si lo deshabilita.
export async function isImageRecognitionAvailable(): Promise<boolean> {
  await requireSession();
  const config = await loadMarketConfig();
  return config.imageRecognitionEnabled && !!process.env.GEMINI_API_KEY;
}

// El flash "grande" en vez de flash-lite: verificado con una captura real
// que flash-lite no distingue de forma fiable los iconos de slot con relleno
// (color = slot real) de los de relleno gris plano (solo relleno hasta el
// máximo de la categoría) — devolvía 0 en vez de 2. El resto de la
// extracción (nombre, refine, options) ya iba igual de bien con cualquiera
// de los dos, así que se sube de modelo por este detalle concreto.
const GEMINI_MODEL = "gemini-flash-latest";

// Umbrales deliberadamente permisivos: un OCR/lectura de la IA no va a ser
// perfecto, pero solo hace falta acercarse lo suficiente a UNA entrada real
// del catálogo (nombres de item y labels de option son bastante distintos
// entre sí dentro de un mismo pool). Si no llega al umbral, se deja sin
// rellenar en vez de arriesgar un match incorrecto.
const NAME_MATCH_THRESHOLD = 0.5;
const OPTION_LABEL_MATCH_THRESHOLD = 0.6;

const PROMPT = `You are looking at a screenshot of an item tooltip from the MMORPG Ragnarok Online.
Extract the following as JSON:
- itemName: the base item name as shown, WITHOUT any refine level prefix (e.g. "+7") and WITHOUT any slot count suffix (e.g. "[4]"). Null if you cannot read a name at all.
- refineLevel: the refine level shown as a "+N" prefix before the item name, as an integer. 0 if there is no such prefix.
- cardSlots: the number of card slots (sockets) the item actually has, as an integer. This is sometimes shown as a "[N]" suffix right after the item name. It can also be shown as a row of small diamond-shaped icons near the bottom of the tooltip. That row always shows the item category's maximum possible slots, padded with extra plain flat-grey diamonds — it can show MORE icons than the item actually has. Read the row strictly left to right: count only the leading icons that have any color/tint (pink, white, purple, etc.) and stop counting the moment you reach the first plain flat-grey icon, even if there are more icons after it — everything from that point on is just padding, never slots. 0 if there is no slot indicator at all.
- options: the "random option" bonus lines shown on the tooltip — extra rolled stat bonuses, usually listed separately from the item's fixed base stats/description, in the exact top-to-bottom order they appear. For each one, return the stat label text (without its numeric value) and its numeric value as an integer. Empty array if there are none.
Respond with only the JSON object, no extra commentary.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    itemName: { type: "STRING", nullable: true },
    refineLevel: { type: "INTEGER" },
    cardSlots: { type: "INTEGER" },
    options: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          value: { type: "INTEGER" },
        },
        required: ["label", "value"],
      },
    },
  },
  required: ["itemName", "refineLevel", "cardSlots", "options"],
};

type GeminiExtraction = {
  itemName: string | null;
  refineLevel: number;
  cardSlots: number;
  options: { label: string; value: number }[];
};

function isRawOption(value: unknown): value is { label: string; value: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).label === "string" &&
    Number.isInteger((value as Record<string, unknown>).value)
  );
}

async function callGemini(base64: string, mimeType: string): Promise<GeminiExtraction> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("El reconocimiento por captura no está configurado (falta GEMINI_API_KEY)");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: PROMPT }, { inlineData: { mimeType, data: base64 } }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Gemini respondió con error (${res.status})`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Respuesta de Gemini sin contenido");
  }

  const parsed = JSON.parse(text);
  return {
    itemName: typeof parsed.itemName === "string" ? parsed.itemName : null,
    refineLevel: Number.isInteger(parsed.refineLevel) ? parsed.refineLevel : 0,
    cardSlots: Number.isInteger(parsed.cardSlots) ? parsed.cardSlots : 0,
    options: Array.isArray(parsed.options) ? parsed.options.filter(isRawOption) : [],
  };
}

export type RecognitionResult =
  | {
      status: "matched";
      item: {
        id: string;
        name: string;
        iconUrl: string;
        category: ItemCategory;
        slot: EquipSlot | null;
        weaponType: WeaponType | null;
        optionGroup: ItemOptionGroup | null;
      };
      refineLevel: number;
      cardSlots: number;
      options: { slotIndex: number; defId: string; value: number }[];
    }
  | { status: "no_match"; detectedName: string | null }
  | { status: "error"; message: string };

// Nunca se confía en la respuesta de la IA tal cual: el nombre de item y
// cada option se re-validan por similitud contra el catálogo real (ver
// src/lib/fuzzy-match.ts), y solo lo que supera el umbral llega al
// formulario — que además deja todo editable antes de publicar.
export async function recognizeItemFromScreenshot(formData: FormData): Promise<RecognitionResult> {
  await requireSession();

  // No confiar solo en que el cliente no muestre el bloque: si lo
  // desactivan desde /admin mientras alguien tiene el formulario abierto,
  // la llamada también debe rechazarse aquí.
  const config = await loadMarketConfig();
  if (!config.imageRecognitionEnabled || !process.env.GEMINI_API_KEY) {
    return { status: "error", message: "El reconocimiento por captura no está activo" };
  }

  const file = formData.get("screenshot");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "No se ha recibido ninguna imagen" };
  }

  let extraction: GeminiExtraction;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    extraction = await callGemini(buffer.toString("base64"), file.type || "image/png");
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Error inesperado al reconocer la imagen",
    };
  }

  if (!extraction.itemName) {
    return { status: "no_match", detectedName: null };
  }

  const candidates = await prisma.item.findMany({
    select: { id: true, name: true, iconUrl: true, category: true, slot: true, weaponType: true },
  });

  const matchedItem = findBestMatch(extraction.itemName, candidates, (c) => c.name, NAME_MATCH_THRESHOLD);
  if (!matchedItem) {
    return { status: "no_match", detectedName: extraction.itemName };
  }

  const [magicalTypes, optionsAvailable] = await Promise.all([
    loadMagicalWeaponTypes(),
    isOptionsFeatureAvailable(),
  ]);
  const optionGroup = optionsAvailable ? getItemOptionGroup(matchedItem, magicalTypes) : null;

  let refineLevel = 0;
  if (isRefineEligible(matchedItem)) {
    const maxRefineLevel = await loadMaxRefineLevel();
    refineLevel = Math.min(Math.max(extraction.refineLevel, 0), maxRefineLevel);
  }

  const maxCardSlots = getMaxCardSlots(matchedItem);
  const cardSlots = maxCardSlots > 0 ? Math.min(Math.max(extraction.cardSlots, 0), maxCardSlots) : 0;

  const options: { slotIndex: number; defId: string; value: number }[] = [];
  if (optionGroup) {
    const defs = await prisma.itemOptionDef.findMany({ where: { group: optionGroup } });
    for (let i = 0; i < extraction.options.length && i < MAX_OPTION_SLOTS; i++) {
      const slotIndex = i + 1;
      const defsForSlot = defs.filter((d) => d.slotIndex === slotIndex);
      const detected = extraction.options[i];
      const matchedDef = findBestMatch(detected.label, defsForSlot, (d) => d.label, OPTION_LABEL_MATCH_THRESHOLD);
      // Las options ocupan las posiciones desde el slot 1 sin huecos (mismo
      // invariante que el formulario manual) — si un slot no matchea bien,
      // se corta aquí en vez de dejar un hueco a mitad.
      if (!matchedDef) break;
      const value = Math.min(Math.max(detected.value, matchedDef.minValue), matchedDef.maxValue);
      options.push({ slotIndex, defId: matchedDef.id, value });
    }
  }

  return {
    status: "matched",
    item: { ...matchedItem, optionGroup },
    refineLevel,
    cardSlots,
    options,
  };
}
