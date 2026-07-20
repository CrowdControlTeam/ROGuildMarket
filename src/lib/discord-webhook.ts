import { DISCORD_EMBED_COLOR } from "@/lib/discord-colors";
import { formatPrice } from "@/lib/price";
import { loadMarketConfig } from "@/lib/market-config";

type ListingWebhookPayload = {
  itemName: string;
  itemIconUrl: string; // absoluta
  price: number;
  quantity: number;
  sellerUsername: string;
  sellerAvatarUrl: string | null;
  listingUrl: string; // absoluta
  options?: { label: string; value: number }[];
};

// Un fallo aquí nunca debe tumbar la publicación en sí (ya se guardó en la
// DB): se registra el error y ya está, sin reintentos.
export async function sendListingCreatedWebhook(payload: ListingWebhookPayload) {
  const config = await loadMarketConfig();
  // Configurable desde /admin en vez de una variable de entorno — hace
  // falta URL Y el toggle activo, si falta cualquiera de los dos no se
  // manda nada (ver src/lib/market-config.ts).
  if (!config.webhookEnabled || !config.webhookUrl) return;
  const webhookUrl = config.webhookUrl;

  const body = {
    embeds: [
      {
        title: `Nueva venta: ${payload.itemName}`,
        url: payload.listingUrl,
        color: DISCORD_EMBED_COLOR.SALE,
        thumbnail: { url: payload.itemIconUrl },
        author: {
          name: payload.sellerUsername,
          icon_url: payload.sellerAvatarUrl ?? undefined,
        },
        fields: [
          {
            name: "Precio",
            value: formatPrice(payload.price),
            inline: true,
          },
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
