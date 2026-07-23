import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getMarketConfig } from "@/lib/admin-config";
import { Panel } from "@/components/Panel";
import { BackLink } from "@/components/BackLink";
import { AdminConfigForm } from "./AdminConfigForm";

export default async function AdminPage() {
  await requireAdmin();
  const config = await getMarketConfig();
  const t = await getTranslations("admin");

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <BackLink href="/market" label={t("backToMarket")} />
      <Panel title={t("title")}>
        <AdminConfigForm config={config} />
      </Panel>
    </main>
  );
}
