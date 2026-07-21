import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { Panel } from "@/components/Panel";
import { BackLink } from "@/components/BackLink";
import { formatPrice, priceColorClass } from "@/lib/price";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { OFFER_STATUS_LABEL } from "@/lib/market-labels";
import { labelClass } from "@/lib/ui";
import { UserMention } from "@/components/UserMention";
import { CancelListingButton } from "./CancelListingButton";
import { BuyForm } from "./BuyForm";
import { TradeOfferForm } from "./TradeOfferForm";
import { TradeOfferActions } from "./TradeOfferActions";

// SOLD se reutiliza también para trades cerrados (ver acceptTradeOffer en
// src/lib/trade-offers.ts) — "Vendida" no encaja ahí, de ahí la excepción.
function statusLabel(status: string, type: "SALE" | "TRADE") {
  if (status === "SOLD" && type === "TRADE") return "Intercambiada";
  const labels: Record<string, string> = {
    ACTIVE: "Activa",
    SOLD: "Vendida",
    CANCELLED: "Cancelada",
    EXPIRED: "Expirada",
  };
  return labels[status] ?? status;
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      item: true,
      seller: true,
      options: { include: { def: true }, orderBy: { slotIndex: "asc" } },
      tradeOffers: {
        include: { offerer: true, item: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!listing) notFound();

  const isSeller = listing.sellerId === session.user.discordId;
  const remaining = listing.quantity - listing.quantitySold;
  const isTrade = listing.type === "TRADE";
  const pendingOffers = listing.tradeOffers.filter((o) => o.status === "PENDING");
  const myOffers = listing.tradeOffers.filter((o) => o.offererId === session.user.discordId);

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <BackLink href="/market" label="Volver al mercado" />
      <Panel>
        <div className="flex items-center gap-4">
          <Image
            src={listing.item.iconUrl}
            alt={listing.item.name}
            width={56}
            height={56}
          />
          <div>
            <h1 className="flex items-center gap-2 font-heading text-sm text-ro-text">
              {formatItemDisplayName(listing.item.name, listing.refineLevel, listing.cardSlots)}
              {isTrade && (
                <span className="rounded border border-blue-500/50 bg-blue-500/10 px-1.5 py-0.5 text-xs font-normal text-blue-600">
                  Intercambio
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-ro-text-muted">
              {statusLabel(listing.status, listing.type)}
            </p>
          </div>
        </div>

        <dl className="mt-6 flex flex-col gap-2 text-sm">
          <div className="flex justify-between border-b border-ro-panel-border/30 pb-2">
            <dt className="text-ro-text-muted">Disponibles</dt>
            <dd>{remaining}</dd>
          </div>
          {!isTrade && listing.price !== null && (
            <div className="flex justify-between border-b border-ro-panel-border/30 pb-2">
              <dt className="text-ro-text-muted">Precio por unidad</dt>
              <dd className={`font-bold ${priceColorClass(listing.price)}`}>
                {formatPrice(listing.price)}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-b border-ro-panel-border/30 pb-2">
            <dt className="text-ro-text-muted">Vendedor</dt>
            <dd>
              <UserMention
                userId={listing.sellerId}
                username={listing.seller.username}
                viewerId={session.user.discordId}
                capitalize
              />
            </dd>
          </div>
          <div
            className={`flex justify-between ${
              listing.quantity > 1 ? "border-b border-ro-panel-border/30 pb-2" : ""
            }`}
          >
            <dt className="text-ro-text-muted">Publicado</dt>
            <dd>{listing.createdAt.toLocaleString()}</dd>
          </div>
          {/* Con 1 sola unidad, "Vendidos: 0 de 1" no aporta nada que
              "Disponibles" ya no diga. */}
          {listing.quantity > 1 && (
            <div className="flex justify-between">
              <dt className="text-ro-text-muted">Vendidos</dt>
              <dd>
                {listing.quantitySold} de {listing.quantity}
              </dd>
            </div>
          )}
        </dl>

        {listing.options.length > 0 && (
          <div className="mt-4">
            <p className={labelClass}>Options</p>
            <ul className="flex flex-col gap-1 text-sm">
              {listing.options.map((o) => (
                <li key={o.slotIndex} className="flex justify-between border-b border-ro-panel-border/30 pb-1">
                  <span className="text-ro-text-muted">{o.def.label}</span>
                  <span className="font-semibold">+{o.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {listing.status === "ACTIVE" && (
          <div className="mt-6">
            {isSeller ? (
              <CancelListingButton listingId={listing.id} />
            ) : isTrade ? (
              <TradeOfferForm listingId={listing.id} />
            ) : (
              listing.price !== null && (
                <BuyForm
                  listingId={listing.id}
                  remaining={remaining}
                  unitPrice={listing.price}
                />
              )
            )}
          </div>
        )}

        {isTrade && listing.status === "SOLD" && (
          <p className="mt-6 text-sm text-ro-text-muted">
            {(() => {
              const accepted = listing.tradeOffers.find((o) => o.status === "ACCEPTED");
              if (!accepted) return null;
              return (
                <>
                  Intercambiado con{" "}
                  <UserMention
                    userId={accepted.offererId}
                    username={accepted.offerer.username}
                    viewerId={session.user.discordId}
                  />{" "}
                  por {formatItemDisplayName(accepted.item.name, accepted.refineLevel, accepted.cardSlots)}
                  {accepted.quantity > 1 && ` x${accepted.quantity}`}
                  {accepted.zenyOffered > 0 && ` + ${formatPrice(accepted.zenyOffered)}`}
                </>
              );
            })()}
          </p>
        )}

        {isTrade && (isSeller ? pendingOffers.length > 0 : myOffers.length > 0) && (
          <div className="mt-6">
            <p className={labelClass}>{isSeller ? "Ofertas recibidas" : "Tus ofertas"}</p>
            <ul className="mt-2 flex flex-col gap-3">
              {(isSeller ? pendingOffers : myOffers).map((offer) => (
                <li key={offer.id} className="rounded-md border-2 border-ro-panel-border/30 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {formatItemDisplayName(offer.item.name, offer.refineLevel, offer.cardSlots)}
                      {offer.quantity > 1 && ` x${offer.quantity}`}
                    </span>
                    {!isSeller && (
                      <span className="text-xs text-ro-text-muted">
                        {OFFER_STATUS_LABEL[offer.status]}
                      </span>
                    )}
                  </div>
                  {isSeller && (
                    <p className="mt-1 text-ro-text-muted">
                      De{" "}
                      <UserMention
                        userId={offer.offererId}
                        username={offer.offerer.username}
                        viewerId={session.user.discordId}
                      />
                    </p>
                  )}
                  {offer.zenyOffered > 0 && (
                    <p className="mt-1 text-ro-text-muted">+ {formatPrice(offer.zenyOffered)}</p>
                  )}
                  {offer.status === "PENDING" && (
                    <div className="mt-2">
                      <TradeOfferActions offerId={offer.id} role={isSeller ? "seller" : "offerer"} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>
    </main>
  );
}
