import { DISCORD_EMBED_COLOR } from "@/lib/discord-colors";
import { formatPrice } from "@/lib/price";
import { loadMarketConfig } from "@/lib/market-config";

type ListingWebhookPayload = {
  itemName: string;
  itemIconUrl: string; // absoluta
  type: "SALE" | "TRADE";
  price: number | null; // null cuando type = TRADE
  quantity: number;
  sellerUsername: string;
  sellerAvatarUrl: string | null;
  listingUrl: string; // absoluta
  options?: { label: string; value: number }[];
};

export async function sendListingCreatedWebhook(payload: ListingWebhookPayload) {
  const config = await loadMarketConfig();
  // Configurable desde /admin en vez de una variable de entorno — hace
  // falta URL Y el toggle activo, si falta cualquiera de los dos no se
  // manda nada (ver src/lib/market-config.ts).
  if (!config.webhookEnabled || !config.webhookUrl) return;
  const webhookUrl = config.webhookUrl;
  const isTrade = payload.type === "TRADE";

  const body = {
    embeds: [
      {
        title: `${isTrade ? "Nuevo intercambio" : "Nueva venta"}: ${payload.itemName}`,
        url: payload.listingUrl,
        color: isTrade ? DISCORD_EMBED_COLOR.TRADE : DISCORD_EMBED_COLOR.SALE,
        thumbnail: { url: payload.itemIconUrl },
        author: {
          name: payload.sellerUsername,
          icon_url: payload.sellerAvatarUrl ?? undefined,
        },
        fields: [
          ...(isTrade
            ? []
            : [{ name: "Precio", value: formatPrice(payload.price!), inline: true }]),
          { name: "Cantidad", value: String(payload.quantity), inline: true },
          ...(payload.options && payload.options.length > 0
            ? [
                {
                  name: "Options",
                  value: payload.options.map((o) => `${o.label}: +${o.value}`).join("\n"),
                  inline: false,
                },
              ]
            : []),
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  await postWebhook(webhookUrl, body);
}

type BuyRequestWebhookPayload = {
  itemName: string;
  itemIconUrl: string; // absoluta
  maxPrice: number;
  quantity: number;
  buyerUsername: string;
  buyerAvatarUrl: string | null;
  requestUrl: string; // absoluta
};

export async function sendBuyRequestCreatedWebhook(payload: BuyRequestWebhookPayload) {
  const config = await loadMarketConfig();
  if (!config.webhookEnabled || !config.webhookUrl) return;

  const body = {
    embeds: [
      {
        title: `Petición de compra: ${payload.itemName}`,
        url: payload.requestUrl,
        color: DISCORD_EMBED_COLOR.BUY_REQUEST,
        thumbnail: { url: payload.itemIconUrl },
        author: {
          name: payload.buyerUsername,
          icon_url: payload.buyerAvatarUrl ?? undefined,
        },
        fields: [
          { name: "Pago hasta", value: formatPrice(payload.maxPrice), inline: true },
          { name: "Cantidad", value: String(payload.quantity), inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  await postWebhook(config.webhookUrl, body);
}

// Un fallo aquí nunca debe tumbar la publicación en sí (ya se guardó en la
// DB): se registra el error y ya está, sin reintentos.
async function postWebhook(webhookUrl: string, body: unknown) {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(
        `Webhook de Discord respondió ${res.status}: ${await res.text()}`,
      );
    }
  } catch (err) {
    console.error("Error enviando webhook de Discord:", err);
  }
}
