import { requireSession } from "@/lib/guard";
import { Panel } from "@/components/Panel";
import { BackLink } from "@/components/BackLink";
import { NewListingForm } from "./NewListingForm";

export default async function NewListingPage() {
  await requireSession();

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <BackLink href="/market" label="Volver al mercado" />
      <Panel title="Nueva venta">
        <NewListingForm />
      </Panel>
    </main>
  );
}
