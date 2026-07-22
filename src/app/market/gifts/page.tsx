import Image from "next/image";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { requireSession } from "@/lib/guard";
import { getMyGifts } from "@/lib/gifts";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { UserMention } from "@/components/UserMention";
import { isDmFeatureAvailable } from "@/lib/discord-bot";
import { formatOptionAmount } from "@/lib/market-labels";

export default async function GiftsPage() {
  const session = await requireSession();
  const gifts = await getMyGifts();
  const dmAvailable = await isDmFeatureAvailable();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 font-heading text-lg text-ro-gold">Regalos</h1>

      {gifts.length === 0 ? (
        <p className="text-ro-text-light/70">Todavía no has enviado ni recibido ningún regalo.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {gifts.map((gift) => {
            const isSender = gift.senderId === session.user.discordId;
            return (
              <li
                key={gift.id}
                className="flex items-center gap-4 rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 text-ro-text"
              >
                {isSender ? (
                  <ArrowUpRight
                    className="shrink-0 text-ro-text-muted"
                    size={20}
                    aria-label="Enviado"
                    role="img"
                  >
                    <title>Enviado</title>
                  </ArrowUpRight>
                ) : (
                  <ArrowDownLeft
                    className="shrink-0 text-green-700"
                    size={20}
                    aria-label="Recibido"
                    role="img"
                  >
                    <title>Recibido</title>
                  </ArrowDownLeft>
                )}
                <Image src={gift.item.iconUrl} alt={gift.item.name} width={40} height={40} />
                <div className="flex-1">
                  <p className="font-semibold">
                    {formatItemDisplayName(gift.item.name, gift.refineLevel, gift.cardSlots)}
                    {gift.quantity > 1 && ` x${gift.quantity}`}
                  </p>
                  {gift.options.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {gift.options.map((o) => (
                        <span
                          key={o.slotIndex}
                          className="rounded border border-ro-gold-dark/50 bg-ro-gold/10 px-1.5 py-0.5 text-xs text-ro-text-muted"
                        >
                          {o.def.label} {formatOptionAmount(o.value, false)}
                        </span>
                      ))}
                    </p>
                  )}
                  <p className="text-sm text-ro-text-muted">
                    {isSender ? (
                      <>
                        Enviado a{" "}
                        <UserMention
                          userId={gift.recipientId}
                          username={gift.recipient.username}
                          viewerId={session.user.discordId}
                          item={gift.item}
                          dmAvailable={dmAvailable}
                        />
                      </>
                    ) : (
                      <>
                        Recibido de{" "}
                        <UserMention
                          userId={gift.senderId}
                          username={gift.sender.username}
                          viewerId={session.user.discordId}
                          item={gift.item}
                          dmAvailable={dmAvailable}
                        />
                      </>
                    )}
                  </p>
                </div>
                <span className="text-xs text-ro-text-muted">{gift.createdAt.toLocaleDateString()}</span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
