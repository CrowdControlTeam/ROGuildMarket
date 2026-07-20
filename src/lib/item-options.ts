import { WeaponType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadMarketConfig } from "@/lib/market-config";

export { MAX_OPTION_SLOTS, getItemOptionGroup } from "@/lib/item-options-constants";

// Carga una sola vez por request y reutilizar entre varias llamadas a
// getItemOptionGroup — evita una query por item al resolver listados.
export async function loadMagicalWeaponTypes(): Promise<Set<WeaponType>> {
  const rows = await prisma.magicalWeaponType.findMany({ select: { type: true } });
  return new Set(rows.map((r) => r.type));
}

export async function getOptionsCatalogCount(): Promise<number> {
  return prisma.itemOptionDef.count();
}

// Hace falta el toggle activo (configurable en /admin) Y que el catálogo
// tenga filas — pensado para cuando el mercado sirva varias versiones de RO
// y alguna todavía no tenga su catálogo de options importado: activar el
// toggle sin catálogo no debe simular que la función funciona.
export async function isOptionsFeatureAvailable(): Promise<boolean> {
  const [{ optionsEnabled }, catalogCount] = await Promise.all([
    loadMarketConfig(),
    getOptionsCatalogCount(),
  ]);
  return optionsEnabled && catalogCount > 0;
}
