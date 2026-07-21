"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { loadMarketConfig } from "@/lib/market-config";
import { sendBuyRequestCreatedWebhook } from "@/lib/discord-webhook";

const createBuyRequestSchema = z.object({
  itemId: z.string().min(1, "Selecciona un item"),
  quantity: z.coerce.number().int().positive("La cantidad debe ser mayor que 0"),
  maxPrice: z.coerce.number().int().positive("El precio debe ser mayor que 0"),
});

export async function createBuyRequest(formData: FormData) {
  const session = await requireSession();

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) {
    throw new Error("El mercado está en mantenimiento; inténtalo más tarde.");
  }

  const parsed = createBuyRequestSchema.safeParse({
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
    maxPrice: formData.get("maxPrice"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const item = await prisma.item.findUnique({ where: { id: parsed.data.itemId } });
  if (!item) throw new Error("El item seleccionado no existe");

  const buyRequest = await prisma.buyRequest.create({
    data: {
      buyerId: session.user.discordId,
      itemId: parsed.data.itemId,
      quantity: parsed.data.quantity,
      maxPrice: parsed.data.maxPrice,
    },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendBuyRequestCreatedWebhook({
    itemName: item.name,
    itemIconUrl: `${appUrl}${item.iconUrl}`,
    maxPrice: parsed.data.maxPrice,
    quantity: parsed.data.quantity,
    buyerUsername: session.user.username,
    buyerAvatarUrl: session.user.avatarUrl,
    requestUrl: `${appUrl}/market/buy-requests/${buyRequest.id}`,
  });

  revalidatePath("/market/buy-requests");
  return { id: buyRequest.id };
}

// Sin oferta/aceptación dentro de la app (v1 deliberadamente simple, ver
// nota en el schema) — el propio comprador cierra la petición a mano según
// cómo se resuelva fuera de la app.
async function closeBuyRequest(id: string, status: "FULFILLED" | "CANCELLED") {
  const session = await requireSession();

  const req = await prisma.buyRequest.findUnique({ where: { id } });
  if (!req) throw new Error("Petición no encontrada");
  if (req.buyerId !== session.user.discordId) {
    throw new Error("Solo quien la publicó puede cerrarla");
  }
  if (req.status !== "ACTIVE") {
    throw new Error("Esta petición ya no está activa");
  }

  await prisma.buyRequest.update({ where: { id }, data: { status } });
  revalidatePath("/market/buy-requests");
  revalidatePath(`/market/buy-requests/${id}`);
}

export async function cancelBuyRequest(id: string) {
  await closeBuyRequest(id, "CANCELLED");
}

export async function fulfillBuyRequest(id: string) {
  await closeBuyRequest(id, "FULFILLED");
}

export async function getBuyRequests(query?: string) {
  await requireSession();
  const trimmed = query?.trim();

  return prisma.buyRequest.findMany({
    where: {
      status: "ACTIVE",
      ...(trimmed && trimmed.length >= 2
        ? { item: { name: { contains: trimmed, mode: "insensitive" } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { item: true, buyer: true },
  });
}
