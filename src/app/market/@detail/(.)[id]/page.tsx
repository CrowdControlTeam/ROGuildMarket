import { DetailPanel } from "../../DetailPanel";
import { ListingDetailContent } from "../../ListingDetailContent";

// Intercepta la navegación de cliente desde la lista de resultados
// (MarketResults.tsx, <Link href={`/market/${listing.id}`}>) y abre la
// ficha en el panel en vez de navegar a la página completa — una visita
// directa o recarga sigue resolviendo a market/[id]/page.tsx normal, eso
// es justo lo que da la convención (.) de Next.js, sin nada que hacer aquí
// para distinguir los dos casos.
export default async function InterceptedListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <DetailPanel>
      <ListingDetailContent id={id} />
    </DetailPanel>
  );
}
