"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { loadMoreListings } from "@/lib/market-actions";
import type { MarketFilters } from "@/lib/market";
import { buttonClass } from "@/lib/ui";

type Item = { id: string; name: string; iconUrl: string };
type Seller = { id: string; username: string };
type Listing = {
  id: string;
  quantity: number;
  price: number;
  item: Item;
  seller: Seller;
};

export function MarketResults({
  initialListings,
  initialCursor,
  filters,
}: {
  initialListings: Listing[];
  initialCursor: string | null;
  filters: Omit<MarketFilters, "cursor">;
}) {
  const [listings, setListings] = useState(initialListings);
  const [cursor, setCursor] = useState(initialCursor);
  const [isPending, startTransition] = useTransition();

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
                <p className="font-semibold">{listing.item.name}</p>
                <p className="text-sm text-ro-text-muted">
                  x{listing.quantity} · vendido por {listing.seller.username}
                </p>
              </div>
              <p className="font-bold text-ro-gold-dark">
                {listing.price.toLocaleString()} z
              </p>
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
