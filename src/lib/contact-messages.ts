"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { sendDirectMessage, isDmFeatureAvailable } from "@/lib/discord-bot";
import { DISCORD_EMBED_COLOR } from "@/lib/discord-colors";

// Mensaje libre desde un nombre clicable (ver UserMention.tsx) — a
// diferencia del resto de DMs (compra, trade aceptado, regalo, todas
// disparadas por una transacción real ya guardada), este lo escribe la
// propia persona, así que se revalida todo server-side: el nombre/icono
// del item NUNCA se toma de lo que mande el cliente, se resuelve aquí a
// partir de itemId, igual que createListing/sendGift con el resto de
// campos del formulario.
export async function sendContactMessage(formData: FormData) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const tDiscord = await getTranslations("discord");

  if (!(await isDmFeatureAvailable())) {
    throw new Error(t("dmNotAvailable"));
  }

  const sendContactMessageSchema = z.object({
    recipientId: z.string().min(1),
    itemId: z.string().min(1),
    message: z.string().trim().min(1, t("writeMessage")).max(500, t("maxCharacters")),
  });

  const parsed = sendContactMessageSchema.safeParse({
    recipientId: formData.get("recipientId"),
    itemId: formData.get("itemId"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? t("invalidData"));
  }
  if (parsed.data.recipientId === session.user.discordId) {
    throw new Error(t("cannotMessageSelf"));
  }

  const [recipient, item] = await Promise.all([
    prisma.user.findUnique({ where: { id: parsed.data.recipientId } }),
    prisma.item.findUnique({ where: { id: parsed.data.itemId } }),
  ]);
  if (!recipient) throw new Error(t("userNotFound"));
  if (!item) throw new Error(t("itemNotFound"));

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendDirectMessage(parsed.data.recipientId, {
    title: tDiscord("dm.contactMessage", { username: session.user.username, item: item.name }),
    color: DISCORD_EMBED_COLOR.MESSAGE,
    itemIconUrl: `${appUrl}${item.iconUrl}`,
    fields: [{ name: tDiscord("fields.message"), value: parsed.data.message, inline: false }],
  });
}
