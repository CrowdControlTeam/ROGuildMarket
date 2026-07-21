import { ItemCategory, EquipSlot, ItemOptionGroup, WeaponType, BuyRequestStatus } from "@prisma/client";

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

export const BUY_REQUEST_STATUS_LABELS: Record<BuyRequestStatus, string> = {
  ACTIVE: "Activa",
  FULFILLED: "Cumplida",
  CANCELLED: "Cancelada",
};
