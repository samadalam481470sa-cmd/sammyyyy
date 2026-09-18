"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";

const ACTIVITY_TYPES = new Set([
  "CALL",
  "EMAIL",
  "MEETING",
  "RENEWAL_REVIEW",
  "CLAIM_CHECK_IN",
]);

export async function createFollowUp(input: {
  clientId: string;
  title: string;
  activityType: string;
  dueAt: string;
  assignedTo: string;
  notes?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const title = input.title.trim();
  const assignedTo = input.assignedTo.trim();
  const dueAt = new Date(input.dueAt);

  if (!title) return { ok: false, error: "Add a follow-up title." };
  if (!assignedTo) return { ok: false, error: "Choose an owner." };
  if (!ACTIVITY_TYPES.has(input.activityType)) {
    return { ok: false, error: "Choose a valid activity type." };
  }
  if (Number.isNaN(dueAt.getTime())) {
    return { ok: false, error: "Choose a valid due date and time." };
  }
  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) return { ok: false, error: "That client no longer exists." };

  const followUp = await prisma.followUp.create({
    data: {
      clientId: client.id,
      title,
      activityType: input.activityType,
      dueAt,
      assignedTo,
      notes: input.notes?.trim() || null,
    },
  });
  revalidatePath("/clients");
  return { ok: true, id: followUp.id };
}

export async function toggleFollowUp(
  followUpId: string,
  complete: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const exists = await prisma.followUp.findUnique({ where: { id: followUpId } });
  if (!exists) return { ok: false, error: "That follow-up no longer exists." };
  await prisma.followUp.update({
    where: { id: followUpId },
    data: {
      isCompleted: complete,
      completedAt: complete ? new Date() : null,
    },
  });
  revalidatePath("/clients");
  return { ok: true };
}
