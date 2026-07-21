import { redirect } from "next/navigation";
import { requireSession } from "@/lib/guard";
import { loadMarketConfig } from "@/lib/market-config";
import { Panel } from "@/components/Panel";
import { BackLink } from "@/components/BackLink";
import { NewBuyRequestForm } from "./NewBuyRequestForm";

export default async function NewBuyRequestPage() {
  const session = await requireSession();

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) redirect("/market/buy-requests");

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <BackLink href="/market/buy-requests" label="Volver a peticiones de compra" />
      <Panel title="Nueva petición de compra">
        <NewBuyRequestForm />
      </Panel>
    </main>
  );
}
