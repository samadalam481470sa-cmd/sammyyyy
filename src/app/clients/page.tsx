import type { Metadata } from "next";

import { ClientCrm } from "@/components/client-crm";
import { PageHeader, StatTile } from "@/components/ui";
import { formatNumber, formatUsdCompact } from "@/lib/format";
import { getClientCrm } from "@/lib/client-queries";

export const metadata: Metadata = { title: "Insurance clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { clients, openFollowUps } = await getClientCrm();
  const totalPremium = clients.reduce(
    (sum, client) => sum + (client.annualPremiumUsd ?? 0),
    0,
  );
  const renewals = clients.filter(
    (client) => client.status === "RENEWAL_DUE",
  ).length;
  const atRisk = clients.filter((client) => client.status === "AT_RISK").length;
  const overdue = openFollowUps.filter(
    (followUp) => Date.parse(followUp.dueAt) < Date.now(),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insurance CRM"
        title="Clients & follow-ups"
        description="The relationship side of Newport's CRM: every insured account, contact, MGA and producer with a visible next action. Schedule a call, email, meeting, renewal review or claim check-in, then add it directly to Outlook."
        actions={
          <a
            href="/api/backup"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Download CRM backup
          </a>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          tone="brand"
          label="Client accounts"
          value={formatNumber(clients.length)}
          sublabel={formatUsdCompact(totalPremium) + " annual premium"}
        />
        <StatTile
          label="Open follow-ups"
          value={formatNumber(openFollowUps.length)}
          sublabel={`${overdue} overdue`}
        />
        <StatTile
          tone="gold"
          label="Renewals due"
          value={formatNumber(renewals)}
          sublabel="need a renewal strategy"
        />
        <StatTile
          label="Accounts at risk"
          value={formatNumber(atRisk)}
          sublabel="need executive attention"
        />
      </div>
      <ClientCrm clients={clients} followUps={openFollowUps} />
    </div>
  );
}
