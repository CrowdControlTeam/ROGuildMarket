import { Prisma, ItemCategory, EquipSlot } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const SORT_OPTIONS = [
  { value: "newest", label: "Más recientes" },
  { value: "oldest", label: "Más antiguas" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "name_asc", label: "Nombre: A-Z" },
  { value: "name_desc", label: "Nombre: Z-A" },
] as const;

export type MarketSort = (typeof SORT_OPTIONS)[number]["value"];

const SORT_VALUES = SORT_OPTIONS.map((o) => o.value);

export function isMarketSort(value: string): value is MarketSort {
  return (SORT_VALUES as string[]).includes(value);
}

export type MarketFilters = {
  q?: string;
  category?: ItemCategory;
  slot?: EquipSlot;
  minPrice?: number;
  maxPrice?: number;
  sort: MarketSort;
  cursor?: string;
};

type Cursor = {
  id: string;
  price: number;
  name: string;
  createdAt: string; // ISO
};

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
    if (
      typeof parsed?.id === "string" &&
      typeof parsed?.price === "number" &&
      typeof parsed?.name === "string" &&
      typeof parsed?.createdAt === "string"
    ) {
      return parsed as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}

const PAGE_SIZE = 20;

function orderByFor(sort: MarketSort): Prisma.ListingOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "price_asc":
      return [{ price: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ price: "desc" }, { id: "asc" }];
    case "name_asc":
      return [{ item: { name: "asc" } }, { id: "asc" }];
    case "name_desc":
      return [{ item: { name: "desc" } }, { id: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

// Paginación por keyset (no OFFSET/LIMIT): comparamos con los valores del
// último elemento cargado en vez de contar páginas, para que el resultado
// no se descuadre si se publican o retiran items mientras se navega.
function cursorWhereFor(
  sort: MarketSort,
  cursor: Cursor | null,
): Prisma.ListingWhereInput | undefined {
  if (!cursor) return undefined;

  switch (sort) {
    case "oldest":
      return {
        OR: [
          { createdAt: { gt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { gt: cursor.id } },
        ],
      };
    case "price_asc":
      return {
        OR: [
          { price: { gt: cursor.price } },
          { price: cursor.price, id: { gt: cursor.id } },
        ],
      };
    case "price_desc":
      return {
        OR: [
          { price: { lt: cursor.price } },
          { price: cursor.price, id: { gt: cursor.id } },
        ],
      };
    case "name_asc":
      return {
        OR: [
          { item: { name: { gt: cursor.name } } },
          { item: { name: cursor.name }, id: { gt: cursor.id } },
        ],
      };
    case "name_desc":
      return {
        OR: [
          { item: { name: { lt: cursor.name } } },
          { item: { name: cursor.name }, id: { gt: cursor.id } },
        ],
      };
    case "newest":
    default:
      return {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { gt: cursor.id } },
        ],
      };
  }
}

export async function getListings(filters: MarketFilters) {
  const cursor = decodeCursor(filters.cursor);

  const needsSlotFilter =
    filters.slot &&
    (filters.category === ItemCategory.ARMOR ||
      filters.category === ItemCategory.CARD ||
      !filters.category);

  const where: Prisma.ListingWhereInput = {
    status: "ACTIVE",
    ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
      ? {
          price: {
            ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
            ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
          },
        }
      : {}),
    item: {
      ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" } } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(needsSlotFilter ? { slot: filters.slot } : {}),
    },
    AND: cursorWhereFor(filters.sort, cursor),
  };

  const listings = await prisma.listing.findMany({
    where,
    orderBy: orderByFor(filters.sort),
    take: PAGE_SIZE + 1,
    include: { item: true, seller: true },
  });

  const hasMore = listings.length > PAGE_SIZE;
  const page = hasMore ? listings.slice(0, PAGE_SIZE) : listings;
  const last = page.at(-1);

  const nextCursor =
    hasMore && last
      ? encodeCursor({
          id: last.id,
          price: last.price,
          name: last.item.name,
          createdAt: last.createdAt.toISOString(),
        })
      : null;

  return { listings: page, nextCursor };
}
