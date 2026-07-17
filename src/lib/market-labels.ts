import { ItemCategory, EquipSlot } from "@prisma/client";

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
