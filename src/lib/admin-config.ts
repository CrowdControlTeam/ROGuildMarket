"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { loadMarketConfig } from "@/lib/market-config";

// El valor real de un secreto nunca sale del servidor una vez guardado —
// esto es lo único que llega al cliente para representarlo en el formulario.
function maskSecret(value: string): string {
  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}

export async function getMarketConfig() {
  await requireAdmin();

  const config = await loadMarketConfig();

  return {
    maxRefineLevel: config.maxRefineLevel,
    webhookEnabled: config.webhookEnabled,
    webhookUrlMasked: config.webhookUrl ? maskSecret(config.webhookUrl) : null,
    imageRecognitionEnabled: config.imageRecognitionEnabled,
    hasGeminiApiKey: !!process.env.GEMINI_API_KEY,
    maintenanceModeEnabled: config.maintenanceModeEnabled,
  };
}

const updateConfigSchema = z.object({
  maxRefineLevel: z.coerce.number().int().nonnegative(),
  webhookEnabled: z.boolean(),
  imageRecognitionEnabled: z.boolean(),
  maintenanceModeEnabled: z.boolean(),
  // Vacío = no tocar el valor ya guardado (patrón "enmascarado + reemplazar":
  // el formulario nunca recibe el valor real, así que no puede reenviarlo).
  webhookUrl: z.string().trim().optional(),
});

export async function updateMarketConfig(formData: FormData) {
  await requireAdmin();

  const parsed = updateConfigSchema.safeParse({
    maxRefineLevel: formData.get("maxRefineLevel"),
    webhookEnabled: formData.get("webhookEnabled") === "on",
    imageRecognitionEnabled: formData.get("imageRecognitionEnabled") === "on",
    maintenanceModeEnabled: formData.get("maintenanceModeEnabled") === "on",
    webhookUrl: formData.get("webhookUrl") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  await prisma.marketConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      maxRefineLevel: parsed.data.maxRefineLevel,
      webhookEnabled: parsed.data.webhookEnabled,
      imageRecognitionEnabled: parsed.data.imageRecognitionEnabled,
      maintenanceModeEnabled: parsed.data.maintenanceModeEnabled,
      webhookUrl: parsed.data.webhookUrl ?? null,
    },
    update: {
      maxRefineLevel: parsed.data.maxRefineLevel,
      webhookEnabled: parsed.data.webhookEnabled,
      imageRecognitionEnabled: parsed.data.imageRecognitionEnabled,
      maintenanceModeEnabled: parsed.data.maintenanceModeEnabled,
      ...(parsed.data.webhookUrl ? { webhookUrl: parsed.data.webhookUrl } : {}),
    },
  });

  revalidatePath("/admin");
}
