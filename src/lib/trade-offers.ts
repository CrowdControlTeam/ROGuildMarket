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

const createTradeOfferSchema = z.object({
  itemId: z.string().min(1, "Selecciona un item"),
  quantity: z.coerce.number().int().positive("La cantidad debe ser mayor que 0"),
  zenyOffered: z.coerce.number().int().nonnegative("El zeny no puede ser negativo"),
});

export async function createTradeOffer(listingId: string, formData: FormData) {
  const session = await requireSession();

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) {
    throw new Error("El mercado está en mantenimiento; inténtalo más tarde.");
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error("Publicación no encontrada");
  if (listing.type !== "TRADE") throw new Error("Esta publicación no es un intercambio");
  if (listing.status !== "ACTIVE") throw new Error("Esta publicación ya no está activa");
  if (listing.posterId === session.user.discordId) {
    throw new Error("No puedes ofertar en tu propia publicación");
  }

  const parsed = createTradeOfferSchema.safeParse({
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
    zenyOffered: formData.get("zenyOffered") || 0,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const item = await prisma.item.findUnique({ where: { id: parsed.data.itemId } });
  if (!item) throw new Error("El item seleccionado no existe");

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

  await prisma.tradeOffer.create({
    data: {
      listingId,
      offererId: session.user.discordId,
      itemId: parsed.data.itemId,
      quantity: parsed.data.quantity,
      refineLevel,
      cardSlots,
      zenyOffered: parsed.data.zenyOffered,
    },
  });

  revalidatePath(`/market/${listingId}`);
}

// Ownership + estado se comparten entre aceptar/rechazar/cancelar — solo
// cambia quién puede hacerlo y a qué estado se mueve.
async function loadOwnedPendingOffer(offerId: string, expectedOwnerField: "posterId" | "offererId", discordId: string) {
  const offer = await prisma.tradeOffer.findUnique({
    where: { id: offerId },
    include: { listing: { include: { item: true } }, item: true, offerer: true },
  });
  if (!offer) throw new Error("Oferta no encontrada");
  if (offer.status !== "PENDING") throw new Error("Esta oferta ya no está pendiente");

  const ownerId = expectedOwnerField === "posterId" ? offer.listing.posterId : offer.offererId;
  if (ownerId !== discordId) throw new Error("No tienes permiso sobre esta oferta");

  return offer;
}

export async function acceptTradeOffer(offerId: string) {
  const session = await requireSession();

  const offer = await loadOwnedPendingOffer(offerId, "posterId", session.user.discordId);

  await prisma.$transaction(async (tx) => {
    await tx.tradeOffer.update({ where: { id: offerId }, data: { status: "ACCEPTED" } });
    // El resto de ofertas pendientes del mismo listing quedan rechazadas
    // automáticamente: el listing solo puede cerrarse con una.
    await tx.tradeOffer.updateMany({
      where: { listingId: offer.listingId, status: "PENDING", id: { not: offerId } },
      data: { status: "REJECTED" },
    });
    // Se reutiliza ListingStatus.SOLD para "cerrado" también en trades (no
    // hay Purchase asociada: Purchase.unitPrice es obligatorio y no encaja
    // con un intercambio) — la UI muestra "Intercambiada" en vez de
    // "Vendida" cuando type = TRADE, ver STATUS_LABEL en market/[id]/page.tsx.
    await tx.listing.update({ where: { id: offer.listingId }, data: { status: "SOLD" } });
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const listingItemName = formatItemDisplayName(
    offer.listing.item.name,
    offer.listing.refineLevel,
    offer.listing.cardSlots,
  );
  const offeredItemName = formatItemDisplayName(offer.item.name, offer.refineLevel, offer.cardSlots);
  const zenyField = offer.zenyOffered > 0
    ? [{ name: "Zeny incluido", value: String(offer.zenyOffered), inline: true }]
    : [];

  // Norma 2.10 del plan: en un trade ambas partes reciben algo, así que a
  // diferencia de una compra normal (donde solo se notifica al vendedor,
  // que es pasivo) aquí se manda un DM a cada lado — el que acepta ya sabe
  // que ha aceptado, pero no tiene constancia por Discord de lo recibido.
  await sendDirectMessage(offer.offererId, {
    title: `${session.user.username} ha aceptado tu oferta de intercambio por su ${listingItemName}`,
    url: `${appUrl}/market/${offer.listingId}`,
    color: DISCORD_EMBED_COLOR.TRADE,
    itemIconUrl: `${appUrl}${offer.listing.item.iconUrl}`,
    fields: [{ name: "Tu oferta", value: offeredItemName, inline: true }, ...zenyField],
  });
  await sendDirectMessage(session.user.discordId, {
    title: `Has aceptado la oferta de ${offer.offerer.username} por tu ${listingItemName}`,
    url: `${appUrl}/market/${offer.listingId}`,
    color: DISCORD_EMBED_COLOR.TRADE,
    itemIconUrl: `${appUrl}${offer.item.iconUrl}`,
    fields: [{ name: "Has recibido", value: offeredItemName, inline: true }, ...zenyField],
  });

  revalidatePath(`/market/${offer.listingId}`);
  revalidatePath("/market");
}

export async function rejectTradeOffer(offerId: string) {
  const session = await requireSession();
  const offer = await loadOwnedPendingOffer(offerId, "posterId", session.user.discordId);

  await prisma.tradeOffer.update({ where: { id: offerId }, data: { status: "REJECTED" } });
  revalidatePath(`/market/${offer.listingId}`);
}

export async function cancelTradeOffer(offerId: string) {
  const session = await requireSession();
  const offer = await loadOwnedPendingOffer(offerId, "offererId", session.user.discordId);

  await prisma.tradeOffer.update({ where: { id: offerId }, data: { status: "CANCELLED" } });
  revalidatePath(`/market/${offer.listingId}`);
}
