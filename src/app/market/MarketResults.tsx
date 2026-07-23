"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { loadMoreListings } from "@/lib/market-actions";
import type { MarketFilters } from "@/lib/market";
import { buttonClass } from "@/lib/ui";
import { formatPrice, priceColorClass } from "@/lib/price";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { listingTypeLabel, LISTING_TYPE_BADGE_CLASS, formatOptionAmount } from "@/lib/market-labels";
import { UserMention } from "@/components/UserMention";

type Item = { id: string; name: string; iconUrl: string };
type Poster = { id: string; username: string };
type ListingOption = { slotIndex: number; value: number; def: { label: string } };
type Listing = {
  id: string;
  type: "SALE" | "TRADE" | "BUY";
  quantity: number;
  quantitySold: number;
  price: number | null;
  refineLevel: number;
  cardSlots: number;
  item: Item;
  poster: Poster;
  options: ListingOption[];
};

export function MarketResults({
  initialListings,
  initialCursor,
  filters,
  currentUserId,
  dmAvailable = false,
}: {
  initialListings: Listing[];
  initialCursor: string | null;
  filters: Omit<MarketFilters, "cursor">;
  currentUserId: string;
  dmAvailable?: boolean;
}) {
  const [listings, setListings] = useState(initialListings);
  const [cursor, setCursor] = useState(initialCursor);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("market");

  function loadMore() {
    startTransition(async () => {
      if (!cursor) return;
      const result = await loadMoreListings({ ...filters, cursor });
      setListings((prev) => [...prev, ...result.listings]);
      setCursor(result.nextCursor);
    });
  }

  if (listings.length === 0) {
    return (
      <p className="text-ro-text-light/70">
        No hay publicaciones que coincidan con la búsqueda.
      </p>
    );
  }

  return (
    <div>
      <ul className="flex flex-col gap-3">
        {listings.map((listing) => (
          <li key={listing.id}>
            <Link
              href={`/market/${listing.id}`}
              className="flex items-center gap-4 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 text-ro-text transition-colors hover:border-ro-gold"
            >
              <Image
                src={listing.item.iconUrl}
                alt={listing.item.name}
                width={40}
                height={40}
              />
              <div className="flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  {formatItemDisplayName(listing.item.name, listing.refineLevel, listing.cardSlots)}
                  {!filters.type && (
                    <span
                      className={`rounded border px-1.5 py-0.5 text-xs font-normal ${LISTING_TYPE_BADGE_CLASS[listing.type]}`}
                    >
                      {listingTypeLabel(t, listing.type)}
                    </span>
                  )}
                </p>
                <p className="text-sm text-ro-text-muted">
                  {listing.type !== "BUY" && `x${listing.quantity - listing.quantitySold} disponibles · `}
                  {listing.type === "BUY" ? "buscado por" : "vendido por"}{" "}
                  <UserMention
                    userId={listing.poster.id}
                    username={listing.poster.username}
                    viewerId={currentUserId}
                    item={listing.item}
                    dmAvailable={dmAvailable}
                  />
                </p>
                {listing.options.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {listing.options.map((o) => (
                      <span
                        key={o.slotIndex}
                        className="rounded border border-ro-gold-dark/50 bg-ro-gold/10 px-1.5 py-0.5 text-xs text-ro-text-muted"
                      >
                        {o.def.label} {formatOptionAmount(o.value, listing.type === "BUY")}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              {listing.type !== "TRADE" && listing.price !== null && (
                <p className={`font-bold ${priceColorClass(listing.price)}`}>
                  {listing.type === "BUY" ? "hasta " : ""}
                  {formatPrice(listing.price)}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {cursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isPending}
          className={`mt-4 w-full ${buttonClass("secondary")}`}
        >
          {isPending ? "Cargando..." : "Cargar más"}
        </button>
      )}
    </div>
  );
}
