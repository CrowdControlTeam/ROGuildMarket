import Link from "next/link";
import Image from "next/image";
import { requireSession } from "@/lib/guard";
import { getBuyRequests } from "@/lib/buy-requests";
import { buttonClass } from "@/lib/ui";
import { formatPrice, priceColorClass } from "@/lib/price";
import { UserMention } from "@/components/UserMention";
import { BuyRequestSearch } from "./BuyRequestSearch";

export default async function BuyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const raw = await searchParams;
  const q = Array.isArray(raw.q) ? raw.q[0] : raw.q;

  const buyRequests = await getBuyRequests(q);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-lg text-ro-gold">Peticiones de compra</h1>
        <Link href="/market/buy-requests/new" className={buttonClass("primary")}>
          Nueva petición
        </Link>
      </div>

      <BuyRequestSearch />

      {buyRequests.length === 0 ? (
        <p className="text-ro-text-light/70">No hay peticiones de compra activas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {buyRequests.map((req) => (
            <li key={req.id}>
              <Link
                href={`/market/${req.id}`}
                className="flex items-center gap-4 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 text-ro-text transition-colors hover:border-ro-gold"
              >
                <Image src={req.item.iconUrl} alt={req.item.name} width={40} height={40} />
                <div className="flex-1">
                  <p className="font-semibold">{req.item.name}</p>
                  <p className="text-sm text-ro-text-muted">
                    x{req.quantity} · buscado por{" "}
                    <UserMention
                      userId={req.posterId}
                      username={req.poster.username}
                      viewerId={session.user.discordId}
                    />
                  </p>
                </div>
                {req.price !== null && (
                  <span className={`font-bold ${priceColorClass(req.price)}`}>
                    hasta {formatPrice(req.price)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
