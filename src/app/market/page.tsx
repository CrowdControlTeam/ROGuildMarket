import { z } from "zod";
import { ItemCategory, EquipSlot, WeaponType, ListingType } from "@prisma/client";
import { getListings, isMarketSort, type MarketFilters as MarketFiltersType } from "@/lib/market";
import { requireSession } from "@/lib/guard";
import { loadMarketConfig } from "@/lib/market-config";
import { isDmFeatureAvailable } from "@/lib/discord-bot";
import { Panel } from "@/components/Panel";
import { MarketFilters } from "./MarketFilters";
import { MarketResults } from "./MarketResults";
import { SortSelect } from "./SortSelect";

const searchParamsSchema = z.object({
  q: z.string().trim().min(1).optional(),
  category: z.enum(ItemCategory).optional(),
  slot: z.enum(EquipSlot).optional(),
  weaponType: z.enum(WeaponType).optional(),
  type: z.enum(ListingType).optional(),
  option1DefId: z.string().trim().min(1).optional(),
  option1Min: z.coerce.number().int().optional(),
  option1Max: z.coerce.number().int().optional(),
  option2DefId: z.string().trim().min(1).optional(),
  option2Min: z.coerce.number().int().optional(),
  option2Max: z.coerce.number().int().optional(),
  option3DefId: z.string().trim().min(1).optional(),
  option3Min: z.coerce.number().int().optional(),
  option3Max: z.coerce.number().int().optional(),
  refineMin: z.coerce.number().int().nonnegative().optional(),
  refineMax: z.coerce.number().int().nonnegative().optional(),
  cardSlotsMin: z.coerce.number().int().nonnegative().optional(),
  cardSlotsMax: z.coerce.number().int().nonnegative().optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  sort: z
    .string()
    .optional()
    .transform((v) => (v && isMarketSort(v) ? v : "newest")),
});

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const raw = await searchParams;
  const parsed = searchParamsSchema.safeParse({
    q: firstValue(raw.q),
    category: firstValue(raw.category),
    slot: firstValue(raw.slot),
    weaponType: firstValue(raw.weaponType),
    type: firstValue(raw.type),
    option1DefId: firstValue(raw.option1DefId),
    option1Min: firstValue(raw.option1Min),
    option1Max: firstValue(raw.option1Max),
    option2DefId: firstValue(raw.option2DefId),
    option2Min: firstValue(raw.option2Min),
    option2Max: firstValue(raw.option2Max),
    option3DefId: firstValue(raw.option3DefId),
    option3Min: firstValue(raw.option3Min),
    option3Max: firstValue(raw.option3Max),
    refineMin: firstValue(raw.refineMin),
    refineMax: firstValue(raw.refineMax),
    cardSlotsMin: firstValue(raw.cardSlotsMin),
    cardSlotsMax: firstValue(raw.cardSlotsMax),
    minPrice: firstValue(raw.minPrice),
    maxPrice: firstValue(raw.maxPrice),
    sort: firstValue(raw.sort),
  });

  const filters: MarketFiltersType = parsed.success
    ? parsed.data
    : { sort: "newest" };

  const { listings, nextCursor } = await getListings(filters);
  const { maintenanceModeEnabled } = await loadMarketConfig();
  const dmAvailable = await isDmFeatureAvailable();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      {maintenanceModeEnabled && (
        <p className="mb-4 rounded-md border-2 border-ro-gold-dark bg-ro-gold/10 px-4 py-2 text-sm text-ro-text">
          El mercado está en modo mantenimiento
          {session.user.isAdmin
            ? " (como administrador, sí puedes publicar y comprar)."
            : ": no se puede crear ventas ni comprar por ahora."}
        </p>
      )}
      <h1 className="mb-6 font-heading text-lg text-ro-gold">Mercado</h1>

      <Panel className="mb-6">
        <MarketFilters />
      </Panel>

      <SortSelect />
      {/* key fuerza a remontar el componente cuando cambian los filtros/orden:
          sin esto, su useState(initialListings) se queda con la primera
          respuesta del servidor y no ve las nuevas props tras un router.push. */}
      <MarketResults
        key={JSON.stringify(filters)}
        initialListings={listings}
        initialCursor={nextCursor}
        filters={filters}
        currentUserId={session.user.discordId}
        dmAvailable={dmAvailable}
      />
    </main>
  );
}

function firstValue(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
