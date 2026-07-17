"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { sendListingCreatedWebhook } from "@/lib/discord-webhook";

export async function searchItems(query: string) {
  await requireSession();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  return prisma.item.findMany({
    where: { name: { contains: trimmed, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, iconUrl: true, category: true },
  });
}

const createListingSchema = z.object({
  itemId: z.string().min(1, "Selecciona un item"),
  quantity: z.coerce.number().int().positive("La cantidad debe ser mayor que 0"),
  price: z.coerce.number().int().positive("El precio debe ser mayor que 0"),
});

export async function createListing(formData: FormData) {
  const session = await requireSession();

  const parsed = createListingSchema.safeParse({
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
    price: formData.get("price"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const item = await prisma.item.findUnique({
    where: { id: parsed.data.itemId },
  });
  if (!item) throw new Error("El item seleccionado no existe");

  const listing = await prisma.listing.create({
    data: {
      sellerId: session.user.discordId,
      itemId: parsed.data.itemId,
      quantity: parsed.data.quantity,
      price: parsed.data.price,
    },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendListingCreatedWebhook({
    itemName: item.name,
    itemIconUrl: `${appUrl}${item.iconUrl}`,
    price: listing.price,
    quantity: listing.quantity,
    sellerUsername: session.user.username,
    sellerAvatarUrl: session.user.avatarUrl,
    listingUrl: `${appUrl}/market/${listing.id}`,
  });

  revalidatePath("/market");
  return { id: listing.id };
}

export async function markListingSold(listingId: string) {
  const session = await requireSession();

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });
  if (!listing) throw new Error("Publicación no encontrada");
  if (listing.sellerId !== session.user.discordId) {
    throw new Error("Solo el vendedor puede marcar la publicación como vendida");
  }
  if (listing.status !== "ACTIVE") {
    throw new Error("Esta publicación ya no está activa");
  }

  await prisma.listing.update({
    where: { id: listingId },
    data: { status: "SOLD" },
  });

  revalidatePath("/market");
  revalidatePath(`/market/${listingId}`);
}
