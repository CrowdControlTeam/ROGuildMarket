// Lector interno de MarketConfig, sin "use server": a diferencia de
// src/lib/admin-config.ts (que sí expone server actions llamables desde
// cliente), este módulo nunca debe ser invocable directamente desde el
// navegador — devuelve valores en crudo (incluida la URL real del webhook),
// así que solo lo importan otros módulos server-only (discord-webhook.ts,
// listings.ts, item-recognition.ts, páginas server component).
import { prisma } from "@/lib/prisma";
import { DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";
import { DEFAULT_GEMINI_MODEL, isGeminiModel, type GeminiModel } from "@/lib/gemini-model-constants";
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from "@/lib/locale-constants";

export type MarketConfigValues = {
  maxRefineLevel: number;
  webhookUrl: string | null;
  webhookEnabled: boolean;
  imageRecognitionEnabled: boolean;
  geminiModel: GeminiModel;
  dmNotificationsEnabled: boolean;
  maintenanceModeEnabled: boolean;
  optionsEnabled: boolean;
  adminRoleIds: string[];
  locale: AppLocale;
};

// Si la fila (id=1) todavía no existe, se cae a los valores conservadores
// por defecto en vez de romper — mismo patrón que loadMaxRefineLevel.
export async function loadMarketConfig(): Promise<MarketConfigValues> {
  const config = await prisma.marketConfig.findUnique({ where: { id: 1 } });
  return {
    maxRefineLevel: config?.maxRefineLevel ?? DEFAULT_MAX_REFINE_LEVEL,
    webhookUrl: config?.webhookUrl ?? null,
    webhookEnabled: config?.webhookEnabled ?? false,
    imageRecognitionEnabled: config?.imageRecognitionEnabled ?? false,
    // Por si el valor guardado dejara de ser una opción soportada (se quita
    // del desplegable más adelante) — se cae al default en vez de mandarle
    // a Gemini un modelo que ya no ofrecemos.
    geminiModel: config?.geminiModel && isGeminiModel(config.geminiModel) ? config.geminiModel : DEFAULT_GEMINI_MODEL,
    dmNotificationsEnabled: config?.dmNotificationsEnabled ?? true,
    maintenanceModeEnabled: config?.maintenanceModeEnabled ?? false,
    optionsEnabled: config?.optionsEnabled ?? true,
    adminRoleIds: config?.adminRoleIds ?? [],
    // Mismo criterio que geminiModel: si el valor guardado dejara de estar
    // soportado, se cae al default en vez de pedirle a next-intl un locale
    // sin fichero de mensajes.
    locale: config?.locale && isAppLocale(config.locale) ? config.locale : DEFAULT_LOCALE,
  };
}
