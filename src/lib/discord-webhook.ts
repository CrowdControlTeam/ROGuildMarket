import { DISCORD_EMBED_COLOR } from "@/lib/discord-colors";

type ListingWebhookPayload = {
  itemName: string;
  itemIconUrl: string; // absoluta
  price: number;
  quantity: number;
  sellerUsername: string;
  sellerAvatarUrl: string | null;
  listingUrl: string; // absoluta
};

// Un fallo aquí nunca debe tumbar la publicación en sí (ya se guardó en la
// DB): se registra el error y ya está, sin reintentos.
export async function sendListingCreatedWebhook(payload: ListingWebhookPayload) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("DISCORD_WEBHOOK_URL no configurado; no se envía notificación.");
    return;
  }

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
            value: `${payload.price.toLocaleString()} z`,
            inline: true,
          },
          { name: "Cantidad", value: String(payload.quantity), inline: true },
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
