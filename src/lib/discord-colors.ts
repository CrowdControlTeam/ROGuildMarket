// Color del borde lateral de los embeds de Discord, según el tipo de
// transacción del mercado. Esquema acordado con el usuario (icono
// Buy/Sell/Trade/Gift del juego): verde = petición de compra, amarillo =
// venta, azul = trade, rojo = regalo.
//
// Por ahora solo se usa SALE (Fase 1.7). BUY_REQUEST y TRADE se usarán en la
// Fase 3 (BuyRequest, TradeOffer); GIFT queda de referencia — los regalos no
// se anuncian por webhook público (ver spec 2.6/2.7), solo quedan en el
// historial.
export const DISCORD_EMBED_COLOR = {
  SALE: 0xf2b90c,
  BUY_REQUEST: 0x57c84d,
  TRADE: 0x3b82f6,
  GIFT: 0xe0245e,
} as const;
