// Lista curada de modelos soportados por el desplegable de /admin — no
// cualquier modelo de Gemini, solo los que tiene sentido ofrecer aquí.
// Archivo aparte (sin imports) para que tanto market-config.ts como
// item-recognition.ts y el panel de admin puedan usarlo sin ciclos.
export const GEMINI_MODEL_OPTIONS = [
  {
    value: "gemini-flash-latest",
    label: "Flash (recomendado)",
    description: "Detecta bien también el número de slots de carta a partir de los iconos del tooltip.",
  },
  {
    value: "gemini-flash-lite-latest",
    label: "Flash Lite",
    description: "Más barato y rápido, pero puede fallar contando los slots de carta (iconos pequeños).",
  },
] as const;

export type GeminiModel = (typeof GEMINI_MODEL_OPTIONS)[number]["value"];

export const DEFAULT_GEMINI_MODEL: GeminiModel = GEMINI_MODEL_OPTIONS[0].value;

const GEMINI_MODEL_VALUES = GEMINI_MODEL_OPTIONS.map((o) => o.value);

export function isGeminiModel(value: string): value is GeminiModel {
  return (GEMINI_MODEL_VALUES as string[]).includes(value);
}
