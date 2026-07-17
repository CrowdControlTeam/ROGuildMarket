import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { Panel } from "@/components/Panel";
import { BackLink } from "@/components/BackLink";
import { MarkSoldButton } from "./MarkSoldButton";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activa",
  SOLD: "Vendida",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { item: true, seller: true },
  });
  if (!listing) notFound();

  const isSeller = listing.sellerId === session.user.discordId;

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
            <h1 className="font-heading text-sm text-ro-text">
              {listing.item.name}
            </h1>
            <p className="mt-1 text-sm text-ro-text-muted">
              {STATUS_LABEL[listing.status]}
            </p>
          </div>
        </div>

        <dl className="mt-6 flex flex-col gap-2 text-sm">
          <div className="flex justify-between border-b border-ro-panel-border/30 pb-2">
            <dt className="text-ro-text-muted">Cantidad</dt>
            <dd>{listing.quantity}</dd>
          </div>
          <div className="flex justify-between border-b border-ro-panel-border/30 pb-2">
            <dt className="text-ro-text-muted">Precio</dt>
            <dd className="font-bold text-ro-gold-dark">
              {listing.price.toLocaleString()} z
            </dd>
          </div>
          <div className="flex justify-between border-b border-ro-panel-border/30 pb-2">
            <dt className="text-ro-text-muted">Vendedor</dt>
            <dd>{listing.seller.username}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ro-text-muted">Publicado</dt>
            <dd>{listing.createdAt.toLocaleString()}</dd>
          </div>
        </dl>

        {isSeller && listing.status === "ACTIVE" && (
          <div className="mt-6">
            <MarkSoldButton listingId={listing.id} />
          </div>
        )}
      </Panel>
    </main>
  );
}
