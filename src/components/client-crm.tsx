"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import * as Dialog from "@radix-ui/react-dialog";
import * as Label from "@radix-ui/react-label";
import * as Select from "@radix-ui/react-select";
import {
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Mail,
  Phone,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { createFollowUp, toggleFollowUp } from "@/app/clients/actions";
import type { ClientCrmRow, FollowUpRow } from "@/lib/client-queries";
import { formatUsdCompact } from "@/lib/format";

import { Badge, EmptyState, Panel, Td, Th } from "./ui";

const ACTIVITY_LABEL: Record<string, string> = {
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  RENEWAL_REVIEW: "Renewal review",
  CLAIM_CHECK_IN: "Claim check-in",
};

export function ClientCrm({
  clients,
  followUps,
}: {
  clients: ClientCrmRow[];
  followUps: FollowUpRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return clients.filter((client) => {
      if (status !== "ALL" && client.status !== status) return false;
      return (
        !needle ||
        [
          client.companyName,
          client.contactName,
          client.email,
          client.industry,
          client.mgaName,
          client.producer,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      );
    });
  }, [clients, query, status]);

  function complete(followUp: FollowUpRow) {
    startTransition(async () => {
      const result = await toggleFollowUp(followUp.id, true);
      if (result.ok) {
        toast.success(`Completed: ${followUp.title}`);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Panel
        title={`Client accounts (${filtered.length})`}
        description="The relationship view of the insurance CRM: insured, contact, premium, MGA, producer and the next committed action."
        actions={
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search clients…"
                className="w-52 rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-navy-500"
              />
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-navy-500"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="RENEWAL_DUE">Renewal due</option>
              <option value="PROSPECT">Prospect</option>
              <option value="AT_RISK">At risk</option>
            </select>
          </div>
        }
        bodyClassName="p-0"
      >
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState>No client matches this search.</EmptyState>
          </div>
        ) : (
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <Th>Client / insured</Th>
                  <Th>Contact</Th>
                  <Th>Status</Th>
                  <Th>MGA</Th>
                  <Th>Producer</Th>
                  <Th align="right">Annual premium</Th>
                  <Th>Next follow-up</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50">
                    <Td>
                      <p className="font-medium text-slate-900">
                        {client.companyName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {client.industry} · {client.city}, {client.state}
                      </p>
                    </Td>
                    <Td>
                      <p className="text-xs font-medium text-slate-700">
                        {client.contactName}
                      </p>
                      <div className="mt-1 flex gap-2">
                        <a
                          href={`mailto:${client.email}`}
                          title={client.email}
                          className="text-slate-400 hover:text-navy-700"
                        >
                          <Mail className="size-3.5" />
                        </a>
                        {client.phone && (
                          <a
                            href={`tel:${client.phone}`}
                            title={client.phone}
                            className="text-slate-400 hover:text-navy-700"
                          >
                            <Phone className="size-3.5" />
                          </a>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <ClientStatus status={client.status} />
                    </Td>
                    <Td className="text-xs">{client.mgaName ?? "—"}</Td>
                    <Td className="text-xs">{client.producer ?? "—"}</Td>
                    <Td align="right">
                      <span className="font-medium tabular text-slate-900">
                        {formatUsdCompact(client.annualPremiumUsd)}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {client.policyCount} policies
                      </span>
                    </Td>
                    <Td>
                      {client.nextFollowUp ? (
                        <div className="max-w-52">
                          <p className="truncate text-xs font-medium text-slate-700">
                            {client.nextFollowUp.title}
                          </p>
                          <p
                            className={`mt-0.5 text-[11px] ${
                              isOverdue(client.nextFollowUp.dueAt)
                                ? "font-semibold text-rose-600"
                                : "text-slate-500"
                            }`}
                          >
                            {formatDue(client.nextFollowUp.dueAt)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">None scheduled</span>
                      )}
                    </Td>
                    <Td align="right">
                      <FollowUpDialog client={client} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title={`Follow-up queue (${followUps.length})`}
        description="Due soonest first. Each task can be downloaded into Outlook."
        bodyClassName="p-0"
      >
        <div className="thin-scroll max-h-[700px] overflow-y-auto">
          <ul className="divide-y divide-slate-100">
            {followUps.map((followUp) => (
              <li key={followUp.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => complete(followUp)}
                    title="Mark complete"
                    className="mt-0.5 text-slate-300 hover:text-emerald-600 disabled:opacity-50"
                  >
                    <CheckCircle2 className="size-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">
                          {followUp.title}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          {followUp.clientName}
                        </p>
                      </div>
                      <Badge tone={isOverdue(followUp.dueAt) ? "rose" : "slate"}>
                        {ACTIVITY_LABEL[followUp.activityType] ??
                          followUp.activityType}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] ${
                          isOverdue(followUp.dueAt)
                            ? "font-semibold text-rose-600"
                            : "text-slate-500"
                        }`}
                      >
                        <Clock3 className="size-3" />
                        {formatDue(followUp.dueAt)}
                      </span>
                      <a
                        href={`/api/follow-ups/${followUp.id}/outlook`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-navy-700 hover:underline"
                      >
                        <CalendarPlus className="size-3" />
                        Outlook
                      </a>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Owner: {followUp.assignedTo}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    </div>
  );
}

function FollowUpDialog({ client }: { client: ClientCrmRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [activityType, setActivityType] = useState("CALL");
  const [dueAt, setDueAt] = useState(defaultDueAt());
  const [assignedTo, setAssignedTo] = useState(client.producer ?? "Mary Donovan");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await createFollowUp({
        clientId: client.id,
        title,
        activityType,
        dueAt,
        assignedTo,
        notes,
      });
      if (result.ok) {
        toast.success(`Follow-up scheduled for ${client.companyName}`);
        setOpen(false);
        setTitle("");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white">
          <Plus className="size-3" />
          Follow up
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-navy-950/40 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(500px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900">
                Add follow-up
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-slate-500">
                {client.companyName} · {client.contactName}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded p-1 text-slate-400 hover:bg-slate-100">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="space-y-4 px-5 py-4">
            <Field label="What needs to happen?" id={`title-${client.id}`}>
              <input
                id={`title-${client.id}`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Review renewal strategy"
                className={inputClass}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Activity" id={`activity-${client.id}`}>
                <NativeSelect
                  id={`activity-${client.id}`}
                  value={activityType}
                  onChange={setActivityType}
                  options={Object.entries(ACTIVITY_LABEL)}
                />
              </Field>
              <Field label="Due date and time" id={`due-${client.id}`}>
                <input
                  id={`due-${client.id}`}
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Owner" id={`owner-${client.id}`}>
              <input
                id={`owner-${client.id}`}
                value={assignedTo}
                onChange={(event) => setAssignedTo(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Notes (optional)" id={`notes-${client.id}`}>
              <textarea
                id={`notes-${client.id}`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
            <Dialog.Close className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600">
              Cancel
            </Dialog.Close>
            <button
              type="button"
              disabled={isPending}
              onClick={submit}
              className="rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Schedule follow-up"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label.Root
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold text-slate-700"
      >
        {label}
      </Label.Root>
      {children}
    </div>
  );
}

function NativeSelect({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger id={id} className={`${inputClass} flex items-center justify-between`}>
        <Select.Value />
        <ChevronDown className="size-3.5" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          className="z-[60] min-w-[var(--radix-select-trigger-width)] rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
        >
          {options.map(([optionValue, optionLabel]) => (
            <Select.Item
              key={optionValue}
              value={optionValue}
              className="relative rounded-md py-1.5 pl-7 pr-2 text-xs outline-none data-[highlighted]:bg-slate-100"
            >
              <Select.ItemIndicator className="absolute left-2">
                <Check className="size-3.5" />
              </Select.ItemIndicator>
              <Select.ItemText>{optionLabel}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function ClientStatus({ status }: { status: string }) {
  const tone =
    status === "ACTIVE"
      ? "emerald"
      : status === "AT_RISK"
        ? "rose"
        : status === "RENEWAL_DUE"
          ? "gold"
          : "navy";
  return (
    <Badge tone={tone}>
      {status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </Badge>
  );
}

function formatDue(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isOverdue(value: string) {
  return Date.parse(value) < Date.now();
}

function defaultDueAt() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 outline-none focus:border-navy-500";
