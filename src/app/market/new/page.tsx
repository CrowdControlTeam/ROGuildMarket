import { redirect } from "next/navigation";
import { requireSession } from "@/lib/guard";
import { isImageRecognitionAvailable } from "@/lib/item-recognition";
import { loadMarketConfig } from "@/lib/market-config";
import { Panel } from "@/components/Panel";
import { BackLink } from "@/components/BackLink";
import { NewListingForm } from "./NewListingForm";

export default async function NewListingPage() {
  const session = await requireSession();

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) redirect("/market");

  const recognitionEnabled = await isImageRecognitionAvailable();

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <BackLink href="/market" label="Volver al mercado" />
      <Panel title="Nueva venta">
        <NewListingForm recognitionEnabled={recognitionEnabled} />
      </Panel>
    </main>
  );
}
