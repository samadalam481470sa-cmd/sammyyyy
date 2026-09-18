import { prisma } from "./db";

export type ClientCrmRow = {
  id: string;
  slug: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  industry: string;
  city: string;
  state: string;
  region: string;
  mgaName: string | null;
  producer: string | null;
  annualPremiumUsd: number | null;
  policyCount: number;
  status: string;
  notes: string | null;
  nextFollowUp: FollowUpRow | null;
  openFollowUpCount: number;
};

export type FollowUpRow = {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  title: string;
  activityType: string;
  dueAt: string;
  assignedTo: string;
  notes: string | null;
  isCompleted: boolean;
};

export async function getClientCrm(): Promise<{
  clients: ClientCrmRow[];
  openFollowUps: FollowUpRow[];
}> {
  const clients = await prisma.client.findMany({
    include: {
      followUps: {
        orderBy: { dueAt: "asc" },
      },
    },
    orderBy: { companyName: "asc" },
  });

  const clientRows: ClientCrmRow[] = clients.map((client) => {
    const open = client.followUps.filter((followUp) => !followUp.isCompleted);
    const next = open[0];
    return {
      id: client.id,
      slug: client.slug,
      companyName: client.companyName,
      contactName: client.contactName,
      email: client.email,
      phone: client.phone,
      industry: client.industry,
      city: client.city,
      state: client.state,
      region: client.region,
      mgaName: client.mgaName,
      producer: client.producer,
      annualPremiumUsd: client.annualPremiumUsd,
      policyCount: client.policyCount,
      status: client.status,
      notes: client.notes,
      nextFollowUp: next
        ? {
            id: next.id,
            clientId: client.id,
            clientName: client.companyName,
            clientEmail: client.email,
            title: next.title,
            activityType: next.activityType,
            dueAt: next.dueAt.toISOString(),
            assignedTo: next.assignedTo,
            notes: next.notes,
            isCompleted: next.isCompleted,
          }
        : null,
      openFollowUpCount: open.length,
    };
  });

  const openFollowUps = clientRows
    .flatMap((client) =>
      clients
        .find((record) => record.id === client.id)!
        .followUps.filter((followUp) => !followUp.isCompleted)
        .map((followUp) => ({
          id: followUp.id,
          clientId: client.id,
          clientName: client.companyName,
          clientEmail: client.email,
          title: followUp.title,
          activityType: followUp.activityType,
          dueAt: followUp.dueAt.toISOString(),
          assignedTo: followUp.assignedTo,
          notes: followUp.notes,
          isCompleted: followUp.isCompleted,
        })),
    )
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));

  return { clients: clientRows, openFollowUps };
}
