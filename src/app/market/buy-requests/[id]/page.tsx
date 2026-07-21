import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { Panel } from "@/components/Panel";
import { BackLink } from "@/components/BackLink";
import { formatPrice, priceColorClass } from "@/lib/price";
import { BUY_REQUEST_STATUS_LABELS } from "@/lib/market-labels";
import { UserMention } from "@/components/UserMention";
import { BuyRequestActions } from "./BuyRequestActions";

export default async function BuyRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const buyRequest = await prisma.buyRequest.findUnique({
    where: { id },
    include: { item: true, buyer: true },
  });
  if (!buyRequest) notFound();

  const isBuyer = buyRequest.buyerId === session.user.discordId;

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <BackLink href="/market/buy-requests" label="Volver a peticiones de compra" />
      <Panel>
        <div className="flex items-center gap-4">
          <Image src={buyRequest.item.iconUrl} alt={buyRequest.item.name} width={56} height={56} />
          <div>
            <h1 className="font-heading text-sm text-ro-text">{buyRequest.item.name}</h1>
            <p className="mt-1 text-sm text-ro-text-muted">
              {BUY_REQUEST_STATUS_LABELS[buyRequest.status]}
            </p>
          </div>
        </div>

        <dl className="mt-6 flex flex-col gap-2 text-sm">
          <div className="flex justify-between border-b border-ro-panel-border/30 pb-2">
            <dt className="text-ro-text-muted">Cantidad</dt>
            <dd>{buyRequest.quantity}</dd>
          </div>
          <div className="flex justify-between border-b border-ro-panel-border/30 pb-2">
            <dt className="text-ro-text-muted">Pago hasta</dt>
            <dd className={`font-bold ${priceColorClass(buyRequest.maxPrice)}`}>
              {formatPrice(buyRequest.maxPrice)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ro-text-muted">Comprador</dt>
            <dd>
              <UserMention
                userId={buyRequest.buyerId}
                username={buyRequest.buyer.username}
                viewerId={session.user.discordId}
                capitalize
              />
            </dd>
          </div>
        </dl>

        {buyRequest.status === "ACTIVE" && isBuyer && (
          <div className="mt-6">
            <BuyRequestActions buyRequestId={buyRequest.id} />
          </div>
        )}
      </Panel>
    </main>
  );
}
