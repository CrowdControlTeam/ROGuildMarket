import { redirect } from "next/navigation";
import { requireSession } from "@/lib/guard";
import { loadMarketConfig } from "@/lib/market-config";
import { Panel } from "@/components/Panel";
import { BackLink } from "@/components/BackLink";
import { NewGiftForm } from "./NewGiftForm";

export default async function NewGiftPage() {
  const session = await requireSession();

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) redirect("/market/gifts");

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <BackLink href="/market/gifts" label="Volver a regalos" />
      <Panel title="Regalar item">
        <NewGiftForm />
      </Panel>
    </main>
  );
}
