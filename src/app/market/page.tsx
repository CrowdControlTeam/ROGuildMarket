import Link from "next/link";
import { z } from "zod";
import { ItemCategory, EquipSlot } from "@prisma/client";
import { getListings, isMarketSort, type MarketFilters as MarketFiltersType } from "@/lib/market";
import { requireSession } from "@/lib/guard";
import { Panel } from "@/components/Panel";
import { buttonClass } from "@/lib/ui";
import { MarketFilters } from "./MarketFilters";
import { MarketResults } from "./MarketResults";
import { SortSelect } from "./SortSelect";

const searchParamsSchema = z.object({
  q: z.string().trim().min(1).optional(),
  category: z.enum(ItemCategory).optional(),
  slot: z.enum(EquipSlot).optional(),
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
  await requireSession();
  const raw = await searchParams;
  const parsed = searchParamsSchema.safeParse({
    q: firstValue(raw.q),
    category: firstValue(raw.category),
    slot: firstValue(raw.slot),
    minPrice: firstValue(raw.minPrice),
    maxPrice: firstValue(raw.maxPrice),
    sort: firstValue(raw.sort),
  });

  const filters: MarketFiltersType = parsed.success
    ? parsed.data
    : { sort: "newest" };

  const { listings, nextCursor } = await getListings(filters);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-lg text-ro-gold">Mercado</h1>
        <Link href="/market/new" className={buttonClass("primary")}>
          Nueva venta
        </Link>
      </div>

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
      />
    </main>
  );
}

function firstValue(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
