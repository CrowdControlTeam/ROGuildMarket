import { WeaponType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export { MAX_OPTION_SLOTS, getItemOptionGroup } from "@/lib/item-options-constants";

// Carga una sola vez por request y reutilizar entre varias llamadas a
// getItemOptionGroup — evita una query por item al resolver listados.
export async function loadMagicalWeaponTypes(): Promise<Set<WeaponType>> {
  const rows = await prisma.magicalWeaponType.findMany({ select: { type: true } });
  return new Set(rows.map((r) => r.type));
}
