"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { sendDirectMessage, isDmFeatureAvailable } from "@/lib/discord-bot";
import { DISCORD_EMBED_COLOR } from "@/lib/discord-colors";

const sendContactMessageSchema = z.object({
  recipientId: z.string().min(1),
  itemId: z.string().min(1),
  message: z.string().trim().min(1, "Escribe un mensaje").max(500, "Máximo 500 caracteres"),
});

// Mensaje libre desde un nombre clicable (ver UserMention.tsx) — a
// diferencia del resto de DMs (compra, trade aceptado, regalo, todas
// disparadas por una transacción real ya guardada), este lo escribe la
// propia persona, así que se revalida todo server-side: el nombre/icono
// del item NUNCA se toma de lo que mande el cliente, se resuelve aquí a
// partir de itemId, igual que createListing/sendGift con el resto de
// campos del formulario.
export async function sendContactMessage(formData: FormData) {
  const session = await requireSession();

  if (!(await isDmFeatureAvailable())) {
    throw new Error("Los mensajes directos no están disponibles ahora mismo");
  }

  const parsed = sendContactMessageSchema.safeParse({
    recipientId: formData.get("recipientId"),
    itemId: formData.get("itemId"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (parsed.data.recipientId === session.user.discordId) {
    throw new Error("No puedes enviarte un mensaje a ti mismo");
  }

  const [recipient, item] = await Promise.all([
    prisma.user.findUnique({ where: { id: parsed.data.recipientId } }),
    prisma.item.findUnique({ where: { id: parsed.data.itemId } }),
  ]);
  if (!recipient) throw new Error("El destinatario no existe");
  if (!item) throw new Error("El item seleccionado no existe");

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendDirectMessage(parsed.data.recipientId, {
    title: `${session.user.username} te ha escrito sobre ${item.name}`,
    color: DISCORD_EMBED_COLOR.MESSAGE,
    itemIconUrl: `${appUrl}${item.iconUrl}`,
    fields: [{ name: "Mensaje", value: parsed.data.message, inline: false }],
  });
}
