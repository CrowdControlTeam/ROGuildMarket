"use server";

import { z } from "zod";
import { ItemOptionGroup, ListingType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { sendListingCreatedWebhook } from "@/lib/discord-webhook";
import { sendDirectMessage } from "@/lib/discord-bot";
import { DISCORD_EMBED_COLOR } from "@/lib/discord-colors";
import { formatPrice } from "@/lib/price";
import {
  MAX_OPTION_SLOTS,
  getItemOptionGroup,
  loadMagicalWeaponTypes,
  isOptionsFeatureAvailable,
} from "@/lib/item-options";
import { isRefineEligible, loadMaxRefineLevel } from "@/lib/refine";
import { getMaxCardSlots, formatItemDisplayName } from "@/lib/card-slots-constants";
import { loadMarketConfig } from "@/lib/market-config";

export async function searchItems(query: string) {
  await requireSession();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const items = await prisma.item.findMany({
    where: { name: { contains: trimmed, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: 20,
    select: {
      id: true,
      name: true,
      iconUrl: true,
      category: true,
      slot: true,
      weaponType: true,
    },
  });

  const [magicalTypes, optionsAvailable] = await Promise.all([
    loadMagicalWeaponTypes(),
    isOptionsFeatureAvailable(),
  ]);
  return items.map((item) => ({
    ...item,
    optionGroup: optionsAvailable ? getItemOptionGroup(item, magicalTypes) : null,
  }));
}

// Para que el filtro de mercado (client component, sin acceso directo a
// Prisma) pueda saber si debe mostrar la sección de options en absoluto —
// mismo patrón que getMagicalWeaponTypes/getMaxRefineLevel.
export async function getOptionsFeatureAvailable() {
  await requireSession();
  return isOptionsFeatureAvailable();
}

// Para que el filtro de mercado pueda resolver el ItemOptionGroup en
// cliente (necesita saber qué tipos de arma cuentan como mágicos) sin
// duplicar la tabla ahí.
export async function getMagicalWeaponTypes() {
  await requireSession();
  const magicalTypes = await loadMagicalWeaponTypes();
  return Array.from(magicalTypes);
}

export async function getMaxRefineLevel() {
  await requireSession();
  return loadMaxRefineLevel();
}

// Devuelve el catálogo de options posibles de un grupo, ya ordenado por
// slot posicional — el formulario filtra por slotIndex en cliente.
export async function getOptionChoices(group: ItemOptionGroup) {
  await requireSession();
  return prisma.itemOptionDef.findMany({
    where: { group },
    orderBy: [{ slotIndex: "asc" }, { label: "asc" }],
  });
}

const createListingSchema = z.object({
  itemId: z.string().min(1, "Selecciona un item"),
  type: z.enum(ListingType).default("SALE"),
  quantity: z.coerce.number().int().positive("La cantidad debe ser mayor que 0"),
});

// Las options van en campos planos option1DefId/option1Value, etc. (mismo
// estilo que el resto del form, sin arrays anidados en FormData). Parar en
// el primer slot vacío garantiza que siempre ocupen las posiciones desde 1
// en adelante sin huecos, sin necesidad de validarlo aparte.
function parseOptionsFromFormData(formData: FormData) {
  const options: { slotIndex: number; defId: string; value: number }[] = [];
  for (let slotIndex = 1; slotIndex <= MAX_OPTION_SLOTS; slotIndex++) {
    const defId = formData.get(`option${slotIndex}DefId`);
    if (!defId) break;
    const rawValue = formData.get(`option${slotIndex}Value`);
    if (typeof defId !== "string" || typeof rawValue !== "string") {
      throw new Error("Datos de option inválidos");
    }
    const value = Number(rawValue);
    if (!Number.isInteger(value)) {
      throw new Error("El valor de la option debe ser un número entero");
    }
    options.push({ slotIndex, defId, value });
  }
  return options;
}

export async function createListing(formData: FormData) {
  const session = await requireSession();

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) {
    throw new Error("El mercado está en mantenimiento; inténtalo más tarde.");
  }

  const parsed = createListingSchema.safeParse({
    itemId: formData.get("itemId"),
    type: formData.get("type") || "SALE",
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  // El precio no aplica a un trade (se intercambia por otro item, nunca
  // por zeny fijo — ver TradeOffer.zenyOffered para la compensación
  // opcional en la oferta). En SALE es el precio de venta; en BUY el mismo
  // campo significa "precio máximo que pagaría" — mismo campo, doble
  // sentido según `type` (ver comentario en schema.prisma).
  let price: number | null = null;
  if (parsed.data.type === "SALE" || parsed.data.type === "BUY") {
    const pricedParsed = z.coerce
      .number()
      .int()
      .positive("El precio debe ser mayor que 0")
      .safeParse(formData.get("price"));
    if (!pricedParsed.success) {
      throw new Error(pricedParsed.error.issues[0]?.message ?? "Precio inválido");
    }
    price = pricedParsed.data;
  }

  const item = await prisma.item.findUnique({
    where: { id: parsed.data.itemId },
  });
  if (!item) throw new Error("El item seleccionado no existe");

  const [magicalTypes, optionsAvailable] = await Promise.all([
    loadMagicalWeaponTypes(),
    isOptionsFeatureAvailable(),
  ]);
  const optionGroup = optionsAvailable ? getItemOptionGroup(item, magicalTypes) : null;

  const rawOptions = parseOptionsFromFormData(formData);
  if (rawOptions.length > 0 && !optionGroup) {
    throw new Error("Este item no admite random options");
  }
  // Una petición de compra describe lo que se quiere comprar, no una
  // instancia física concreta — no tiene sentido pedir un roll exacto de
  // options ahí (a diferencia de SALE/TRADE, que sí representan un
  // ejemplar real).
  if (rawOptions.length > 0 && parsed.data.type === "BUY") {
    throw new Error("Una petición de compra no admite random options");
  }

  // defsById también se reutiliza para el webhook más abajo, sin otra query.
  const defsById = new Map<string, { id: string; label: string; group: ItemOptionGroup; slotIndex: number; minValue: number; maxValue: number }>();
  if (optionGroup && rawOptions.length > 0) {
    const defs = await prisma.itemOptionDef.findMany({
      where: { id: { in: rawOptions.map((o) => o.defId) } },
    });
    for (const def of defs) defsById.set(def.id, def);

    for (const raw of rawOptions) {
      const def = defsById.get(raw.defId);
      if (!def || def.group !== optionGroup || def.slotIndex !== raw.slotIndex) {
        throw new Error("Option inválida para este item");
      }
      if (raw.value < def.minValue || raw.value > def.maxValue) {
        throw new Error(
          `El valor de "${def.label}" debe estar entre ${def.minValue} y ${def.maxValue}`,
        );
      }
    }
  }

  // Un item con random options es una instancia única (el roll de options
  // no es igual entre copias) — no tiene sentido apilar cantidad > 1. Solo
  // aplica a SALE (representa un ejemplar real); en BUY no describe una
  // instancia, así que un item option-eligible no fuerza nada ahí. Se
  // fuerza aquí también (no solo ocultando el campo en el form) porque no
  // hay que confiar en lo que mande el cliente. El refine, en cambio, sí
  // admite varias copias al mismo nivel (ver decisión con el usuario).
  // Un trade tampoco admite cantidad > 1: TradeOffer no lleva cuánto del
  // listing original se lleva a cambio, aceptar una oferta cierra el
  // listing entero.
  const forcesQuantityOne =
    parsed.data.type === "TRADE" || (parsed.data.type === "SALE" && optionGroup !== null);
  const quantity = forcesQuantityOne ? 1 : parsed.data.quantity;

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

  const listing = await prisma.listing.create({
    data: {
      posterId: session.user.discordId,
      itemId: parsed.data.itemId,
      type: parsed.data.type,
      quantity,
      price,
      refineLevel,
      cardSlots,
      options:
        rawOptions.length > 0
          ? {
              create: rawOptions.map((o) => ({
                slotIndex: o.slotIndex,
                defId: o.defId,
                value: o.value,
              })),
            }
          : undefined,
    },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendListingCreatedWebhook({
    itemName: formatItemDisplayName(item.name, refineLevel, cardSlots),
    itemIconUrl: `${appUrl}${item.iconUrl}`,
    type: listing.type,
    price: listing.price,
    quantity: listing.quantity,
    posterUsername: session.user.username,
    posterAvatarUrl: session.user.avatarUrl,
    listingUrl: `${appUrl}/market/${listing.id}`,
    options: rawOptions.map((o) => ({
      label: defsById.get(o.defId)!.label,
      value: o.value,
    })),
  });

  revalidatePath("/market");
  return { id: listing.id };
}

// Quien publica cierra la publicación con stock restante sin vender (p.ej.
// lo vendió fuera de la web), o retira una petición de compra que ya no
// quiere. SOLD queda reservado para cuando se agota por compras hechas
// aquí (SALE, ver purchaseListing) o se marca cumplida a mano (BUY, ver
// fulfillListing) o se acepta una oferta (TRADE, ver trade-offers.ts).
export async function cancelListing(listingId: string) {
  const session = await requireSession();

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });
  if (!listing) throw new Error("Publicación no encontrada");
  if (listing.posterId !== session.user.discordId) {
    throw new Error("Solo quien la publicó puede cancelarla");
  }
  if (listing.status !== "ACTIVE") {
    throw new Error("Esta publicación ya no está activa");
  }

  await prisma.listing.update({
    where: { id: listingId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/market");
  revalidatePath(`/market/${listingId}`);
}

// Cierre manual de una petición de compra (type=BUY) cuando ya se ha
// resuelto fuera de la app (Discord, en persona) — sin oferta/aceptación
// dentro de la app (norma 2.4 del plan, deliberadamente simple v1). Se
// reutiliza ListingStatus.SOLD, la UI lo muestra como "Cumplida".
export async function fulfillListing(listingId: string) {
  const session = await requireSession();

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });
  if (!listing) throw new Error("Publicación no encontrada");
  if (listing.type !== "BUY") {
    throw new Error("Solo una petición de compra se puede marcar como cumplida a mano");
  }
  if (listing.posterId !== session.user.discordId) {
    throw new Error("Solo quien la publicó puede marcarla como cumplida");
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

const purchaseSchema = z.object({
  quantity: z.coerce.number().int().positive("La cantidad debe ser mayor que 0"),
});

export async function purchaseListing(listingId: string, formData: FormData) {
  const session = await requireSession();

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) {
    throw new Error("El mercado está en mantenimiento; inténtalo más tarde.");
  }

  const parsed = purchaseSchema.safeParse({
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const { quantity } = parsed.data;

  const { listing, unitPrice } = await prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({ where: { id: listingId }, include: { item: true } });
    if (!listing) throw new Error("Publicación no encontrada");
    if (listing.posterId === session.user.discordId) {
      throw new Error("No puedes comprar tu propia publicación");
    }
    if (listing.status !== "ACTIVE") {
      throw new Error("Esta publicación ya no está activa");
    }
    if (listing.type !== "SALE" || listing.price === null) {
      throw new Error("Esta publicación no es una venta directa");
    }
    const unitPrice = listing.price;

    const remaining = listing.quantity - listing.quantitySold;
    if (quantity > remaining) {
      throw new Error(`Solo quedan ${remaining} unidades disponibles`);
    }

    await tx.purchase.create({
      data: {
        listingId,
        buyerId: session.user.discordId,
        quantity,
        unitPrice,
      },
    });

    const newSold = listing.quantitySold + quantity;
    await tx.listing.update({
      where: { id: listingId },
      data: {
        quantitySold: newSold,
        status: newSold >= listing.quantity ? "SOLD" : "ACTIVE",
      },
    });

    return { listing, unitPrice };
  });

  // Fuera de la transacción a propósito: una llamada de red no debe alargar
  // el bloqueo de DB, y un fallo de DM (norma 2.10) nunca debe deshacer una
  // compra que ya se confirmó.
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendDirectMessage(listing.posterId, {
    title: `${session.user.username} ha comprado tu ${formatItemDisplayName(listing.item.name, listing.refineLevel, listing.cardSlots)}`,
    url: `${appUrl}/market/${listingId}`,
    color: DISCORD_EMBED_COLOR.SALE,
    itemIconUrl: `${appUrl}${listing.item.iconUrl}`,
    fields: [
      { name: "Cantidad", value: String(quantity), inline: true },
      { name: "Precio total", value: formatPrice(quantity * unitPrice), inline: true },
    ],
  });

  revalidatePath("/market");
  revalidatePath(`/market/${listingId}`);
}
