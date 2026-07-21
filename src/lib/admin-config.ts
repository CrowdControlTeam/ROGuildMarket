"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { loadMarketConfig } from "@/lib/market-config";
import { getOptionsCatalogCount } from "@/lib/item-options";
import { fetchGuildRoles } from "@/lib/discord-bot";
import { GEMINI_MODEL_OPTIONS, isGeminiModel } from "@/lib/gemini-model-constants";

// El valor real de un secreto nunca sale del servidor una vez guardado —
// esto es lo único que llega al cliente para representarlo en el formulario.
function maskSecret(value: string): string {
  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}

export async function getMarketConfig() {
  await requireAdmin();

  const [config, optionsCatalogCount, guildRolesResult] = await Promise.all([
    loadMarketConfig(),
    getOptionsCatalogCount(),
    fetchGuildRoles(),
  ]);

  return {
    maxRefineLevel: config.maxRefineLevel,
    webhookEnabled: config.webhookEnabled,
    webhookUrlMasked: config.webhookUrl ? maskSecret(config.webhookUrl) : null,
    imageRecognitionEnabled: config.imageRecognitionEnabled,
    hasGeminiApiKey: !!process.env.GEMINI_API_KEY,
    geminiModel: config.geminiModel,
    geminiModelOptions: GEMINI_MODEL_OPTIONS,
    maintenanceModeEnabled: config.maintenanceModeEnabled,
    optionsEnabled: config.optionsEnabled,
    optionsCatalogCount,
    adminRoleIds: config.adminRoleIds,
    guildRolesResult,
  };
}

const updateConfigSchema = z.object({
  maxRefineLevel: z.coerce.number().int().nonnegative(),
  webhookEnabled: z.boolean(),
  imageRecognitionEnabled: z.boolean(),
  geminiModel: z.string().refine(isGeminiModel, "Modelo de Gemini no soportado"),
  maintenanceModeEnabled: z.boolean(),
  optionsEnabled: z.boolean(),
  // Vacío = no tocar el valor ya guardado (patrón "enmascarado + reemplazar":
  // el formulario nunca recibe el valor real, así que no puede reenviarlo).
  webhookUrl: z.string().trim().optional(),
});

// IDs de rol de Discord (snowflakes): solo dígitos. Se filtra en vez de
// rechazar todo el formulario por una línea mal pegada — es una lista de
// texto libre en el caso sin bot, conviene ser tolerante.
const SNOWFLAKE = /^\d{15,25}$/;

function parseAdminRoleIds(formData: FormData): string[] {
  // Modo con bot: <select multiple name="adminRoleIds"> manda varias
  // entradas con el mismo nombre. Modo sin bot: un único textarea con un
  // ID por línea/coma. Solo uno de los dos se renderiza a la vez, así que
  // no hay ambigüedad sobre cuál usar.
  const textarea = formData.get("adminRoleIdsText");
  const raw =
    typeof textarea === "string"
      ? textarea.split(/[\n,]/)
      : formData.getAll("adminRoleIds").filter((v): v is string => typeof v === "string");

  return Array.from(new Set(raw.map((id) => id.trim()).filter((id) => SNOWFLAKE.test(id))));
}

export async function updateMarketConfig(formData: FormData) {
  await requireAdmin();

  const parsed = updateConfigSchema.safeParse({
    maxRefineLevel: formData.get("maxRefineLevel"),
    webhookEnabled: formData.get("webhookEnabled") === "on",
    imageRecognitionEnabled: formData.get("imageRecognitionEnabled") === "on",
    geminiModel: formData.get("geminiModel"),
    maintenanceModeEnabled: formData.get("maintenanceModeEnabled") === "on",
    optionsEnabled: formData.get("optionsEnabled") === "on",
    webhookUrl: formData.get("webhookUrl") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const adminRoleIds = parseAdminRoleIds(formData);

  await prisma.marketConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      maxRefineLevel: parsed.data.maxRefineLevel,
      webhookEnabled: parsed.data.webhookEnabled,
      imageRecognitionEnabled: parsed.data.imageRecognitionEnabled,
      geminiModel: parsed.data.geminiModel,
      maintenanceModeEnabled: parsed.data.maintenanceModeEnabled,
      optionsEnabled: parsed.data.optionsEnabled,
      webhookUrl: parsed.data.webhookUrl ?? null,
      adminRoleIds,
    },
    update: {
      maxRefineLevel: parsed.data.maxRefineLevel,
      webhookEnabled: parsed.data.webhookEnabled,
      imageRecognitionEnabled: parsed.data.imageRecognitionEnabled,
      geminiModel: parsed.data.geminiModel,
      maintenanceModeEnabled: parsed.data.maintenanceModeEnabled,
      optionsEnabled: parsed.data.optionsEnabled,
      ...(parsed.data.webhookUrl ? { webhookUrl: parsed.data.webhookUrl } : {}),
      adminRoleIds,
    },
  });

  revalidatePath("/admin");
}
