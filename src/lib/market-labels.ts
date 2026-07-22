import {
  ItemCategory,
  EquipSlot,
  ItemOptionGroup,
  WeaponType,
  ListingType,
  TradeOfferStatus,
} from "@prisma/client";

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  WEAPON: "Arma",
  ARMOR: "Armadura",
  CARD: "Carta",
  CONSUMABLE: "Consumible",
  COSTUME: "Costume",
  PET: "Mascota",
  ENCHANT: "Encantamiento",
  ETC: "Miscelánea",
};

export const SLOT_LABELS: Record<EquipSlot, string> = {
  UPPER_HEADGEAR: "Casco superior",
  MID_HEADGEAR: "Casco medio",
  LOWER_HEADGEAR: "Casco inferior",
  ARMOR: "Cuerpo",
  SHIELD: "Escudo",
  GARMENT: "Prenda",
  FOOTGEAR: "Calzado",
  ACCESSORY: "Accesorio",
  WEAPON: "Arma",
};

export const WEAPON_TYPE_LABELS: Record<WeaponType, string> = {
  DAGGER: "Daga",
  ONE_HAND_SWORD: "Espada 1H",
  TWO_HAND_SWORD: "Espada 2H",
  ONE_HAND_SPEAR: "Lanza 1H",
  TWO_HAND_SPEAR: "Lanza 2H",
  ONE_HAND_AXE: "Hacha 1H",
  TWO_HAND_AXE: "Hacha 2H",
  MACE: "Maza",
  ROD: "Báculo",
  TWO_HAND_ROD: "Báculo 2H",
  BOW: "Arco",
  KNUCKLE: "Knuckle",
  INSTRUMENT: "Instrumento",
  WHIP: "Látigo",
  BOOK: "Libro",
  KATAR: "Katar",
  REVOLVER: "Revólver",
  RIFLE: "Rifle",
  GATLING_GUN: "Gatling",
  SHOTGUN: "Escopeta",
  GRENADE_LAUNCHER: "Lanzagranadas",
  FUUMA_SHURIKEN: "Fuuma Shuriken",
};

export const OPTION_GROUP_LABELS: Record<ItemOptionGroup, string> = {
  ARMOR: "Armadura",
  GARMENT: "Prenda",
  FOOTGEAR: "Calzado",
  WEAPON_PHYSICAL: "Arma física",
  WEAPON_MAGICAL: "Arma mágica",
};

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  SALE: "Venta",
  TRADE: "Intercambio",
  BUY: "Compra",
};

// Título de la vista filtrada por tipo — tanto la entrada del menú como el
// <h1> de /market cuando llega `?type=` usan este mismo texto (plural, a
// diferencia de LISTING_TYPE_LABELS que es singular para badges/desplegables),
// para que no puedan divergir entre los dos sitios sin querer.
export const MARKET_VIEW_TITLE: Record<ListingType, string> = {
  SALE: "Ventas",
  BUY: "Compras",
  TRADE: "Intercambios",
};

// Quien publica se llama distinto según el tipo — en BUY esa persona
// compra, no vende (ver comentario de Listing.posterId en schema.prisma).
export const POSTER_LABEL: Record<ListingType, string> = {
  SALE: "Vendedor",
  TRADE: "Vendedor",
  BUY: "Comprador",
};

// SOLD se reutiliza para "cerrado con éxito" en los tres tipos (ver
// comentarios en trade-offers.ts y listings.ts) — el texto mostrado
// cambia según qué significa cerrarse en cada uno.
export function listingStatusLabel(status: string, type: ListingType): string {
  if (status === "SOLD") {
    if (type === "TRADE") return "Intercambiada";
    if (type === "BUY") return "Cumplida";
    return "Vendida";
  }
  const labels: Record<string, string> = {
    ACTIVE: "Activa",
    CANCELLED: "Cancelada",
    EXPIRED: "Expirada",
  };
  return labels[status] ?? status;
}

// Badge de tipo en las cards/detalle. Mismos colores que
// DISCORD_EMBED_COLOR (ver discord-colors.ts) traducidos a Tailwind. Solo
// tiene sentido en la vista general "Mercado" (mezcla los 3 tipos) — en
// una vista ya filtrada por tipo (Ventas/Compras/Intercambios) el badge es
// redundante, así que el caller lo omite ahí (ver MarketResults.tsx).
export const LISTING_TYPE_BADGE: Record<ListingType, { label: string; className: string }> = {
  SALE: {
    label: "Venta",
    className: "border-ro-gold-dark/50 bg-ro-gold/10 text-ro-gold-dark",
  },
  TRADE: {
    label: "Intercambio",
    className: "border-blue-500/50 bg-blue-500/10 text-blue-600",
  },
  BUY: {
    label: "Compra",
    className: "border-green-600/50 bg-green-600/10 text-green-700",
  },
};

// SALE/TRADE/GIFT muestran el roll exacto de una instancia real ("+20");
// BUY muestra el mínimo que pide el comprador ("20+", sin usar el símbolo
// ≥ para no depender de que todo el mundo lo entienda) — ver comentario de
// ListingOption en schema.prisma sobre el doble sentido de `value` según
// el tipo. Solo el número: cada sitio decide cómo pegarlo al label (badge
// de mercado, campo del webhook, etc.).
export function formatOptionAmount(value: number, isMinimum: boolean): string {
  return isMinimum ? `${value}+` : `+${value}`;
}

export const OFFER_STATUS_LABEL: Record<TradeOfferStatus, string> = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
};
