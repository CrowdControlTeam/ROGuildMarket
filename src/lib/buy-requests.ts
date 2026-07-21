"use server";

import { createListing, cancelListing, fulfillListing } from "@/lib/listings";
import { getListings } from "@/lib/market";

// Capa de compatibilidad mientras existan las páginas propias de
// /market/buy-requests (el refactor "listings" las sustituye por el
// formulario común y /market?type=BUY en los siguientes PRs) — por debajo
// ya no hay un modelo BuyRequest aparte, es un Listing normal con
// type=BUY (ver src/lib/listings.ts).

export async function createBuyRequest(formData: FormData) {
  const translated = new FormData();
  translated.set("itemId", String(formData.get("itemId") ?? ""));
  translated.set("quantity", String(formData.get("quantity") ?? ""));
  translated.set("price", String(formData.get("maxPrice") ?? ""));
  translated.set("type", "BUY");
  return createListing(translated);
}

export async function cancelBuyRequest(id: string) {
  await cancelListing(id);
}

export async function fulfillBuyRequest(id: string) {
  await fulfillListing(id);
}

export async function getBuyRequests(query?: string) {
  const { listings } = await getListings({ type: "BUY", q: query, sort: "newest" });
  return listings;
}
