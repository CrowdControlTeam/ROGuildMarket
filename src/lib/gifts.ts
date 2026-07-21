"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { loadMarketConfig } from "@/lib/market-config";
import { sendDirectMessage } from "@/lib/discord-bot";
import { DISCORD_EMBED_COLOR } from "@/lib/discord-colors";
import { isRefineEligible, loadMaxRefineLevel } from "@/lib/refine";
import { getMaxCardSlots, formatItemDisplayName } from "@/lib/card-slots-constants";

// El destinatario solo se puede elegir entre usuarios que ya han iniciado
// sesión alguna vez (los únicos de los que hay registro en User) — mismo
// patrón de búsqueda que searchItems, pero sobre username.
export async function searchUsers(query: string) {
  const session = await requireSession();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  return prisma.user.findMany({
    where: {
      username: { contains: trimmed, mode: "insensitive" },
      id: { not: session.user.discordId },
    },
    orderBy: { username: "asc" },
    take: 20,
    select: { id: true, username: true, avatarUrl: true },
  });
}

const sendGiftSchema = z.object({
  itemId: z.string().min(1, "Selecciona un item"),
  recipientId: z.string().min(1, "Selecciona un destinatario"),
  quantity: z.coerce.number().int().positive("La cantidad debe ser mayor que 0"),
});

export async function sendGift(formData: FormData) {
  const session = await requireSession();

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) {
    throw new Error("El mercado está en mantenimiento; inténtalo más tarde.");
  }

  const parsed = sendGiftSchema.safeParse({
    itemId: formData.get("itemId"),
    recipientId: formData.get("recipientId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (parsed.data.recipientId === session.user.discordId) {
    throw new Error("No puedes regalarte un item a ti mismo");
  }

  const [item, recipient] = await Promise.all([
    prisma.item.findUnique({ where: { id: parsed.data.itemId } }),
    prisma.user.findUnique({ where: { id: parsed.data.recipientId } }),
  ]);
  if (!item) throw new Error("El item seleccionado no existe");
  if (!recipient) throw new Error("El destinatario seleccionado no existe");

  const refineEligible = isRefineEligible(item);
  let refineLevel = 0;
  if (refineEligible) {
    const rawRefine = formData.get("refineLevel");
    refineLevel = typeof rawRefine === "string" && rawRefine !== "" ? Number(rawRefine) : 0;
    if (!Number.isInteger(refineLevel) || refineLevel < 0) {
      throw new Error("El refine debe ser un número entero positivo");
    }
    const maxRefineLevel = await loadMaxRefineLevel();
    if (refineLevel > maxRefineLevel) {
      throw new Error(`El refine no puede ser mayor que +${maxRefineLevel}`);
    }
  }

  const maxCardSlots = getMaxCardSlots(item);
  let cardSlots = 0;
  if (maxCardSlots > 0) {
    const rawCardSlots = formData.get("cardSlots");
    cardSlots = typeof rawCardSlots === "string" && rawCardSlots !== "" ? Number(rawCardSlots) : 0;
    if (!Number.isInteger(cardSlots) || cardSlots < 0) {
      throw new Error("Los slots deben ser un número entero positivo");
    }
    if (cardSlots > maxCardSlots) {
      throw new Error(`Este item admite como máximo ${maxCardSlots} slots`);
    }
  }

  const gift = await prisma.gift.create({
    data: {
      senderId: session.user.discordId,
      recipientId: parsed.data.recipientId,
      itemId: parsed.data.itemId,
      quantity: parsed.data.quantity,
      refineLevel,
      cardSlots,
    },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const itemName = formatItemDisplayName(item.name, refineLevel, cardSlots);
  await sendDirectMessage(parsed.data.recipientId, {
    title: `${session.user.username} te ha regalado ${itemName}`,
    url: `${appUrl}/market/gifts`,
    color: DISCORD_EMBED_COLOR.GIFT,
    itemIconUrl: `${appUrl}${item.iconUrl}`,
    fields: [{ name: "Cantidad", value: String(parsed.data.quantity), inline: true }],
  });

  revalidatePath("/market/gifts");
  return { id: gift.id };
}

export async function getMyGifts() {
  const session = await requireSession();

  return prisma.gift.findMany({
    where: {
      OR: [{ senderId: session.user.discordId }, { recipientId: session.user.discordId }],
    },
    orderBy: { createdAt: "desc" },
    include: { item: true, sender: true, recipient: true },
  });
}
