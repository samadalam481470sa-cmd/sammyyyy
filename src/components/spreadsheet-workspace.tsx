"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import * as Collapsible from "@radix-ui/react-collapsible";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Label from "@radix-ui/react-label";
import * as Select from "@radix-ui/react-select";
import * as Separator from "@radix-ui/react-separator";
import {
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Filter,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  addPolicyRow,
  deletePolicyRow,
  inviteWorkbookMember,
  removeWorkbookMember,
  updatePolicyCell,
  updateWorkbookAccess,
  updateWorkbookMemberRole,
} from "@/app/spreadsheets/actions";
import { formatPercent, formatUsd } from "@/lib/format";
import type {
  PolicySheetRow,
  WorkbookDetail,
  WorkbookListItem,
} from "@/lib/workbook-queries";
import {
  POLICY_STATUS,
  POLICY_STATUS_LABEL,
  WORKBOOK_ACCESS,
  WORKBOOK_ROLE,
} from "@/lib/workbook";

import { Badge, EmptyState } from "./ui";

type Props = {
  workbook: WorkbookDetail;
  workbooks: WorkbookListItem[];
};

export function SpreadsheetWorkspace({ workbook, workbooks }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [line, setLine] = useState("ALL");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  const lines = useMemo(
    () => [...new Set(workbook.rows.map((row) => row.lineOfBusiness))].sort(),
    [workbook.rows],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return workbook.rows.filter((row) => {
      if (status !== "ALL" && row.status !== status) return false;
      if (line !== "ALL" && row.lineOfBusiness !== line) return false;
      if (!needle) return true;
      return [
        row.policyNumber,
        row.insuredName,
        row.mgaName,
        row.carrier,
        row.producerAgency,
        row.underwriter,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [workbook.rows, search, status, line]);

  const totalPremium = filtered.reduce(
    (sum, row) => sum + (row.premiumUsd ?? 0),
    0,
  );
  const boundCount = filtered.filter(
    (row) => row.status === "BOUND" || row.status === "RENEWED",
  ).length;

  function mutate(
    work: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await work();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "The change could not be saved.");
      }
    });
  }

  function changeWorkbook(slug: string) {
    router.push(`/spreadsheets?book=${encodeURIComponent(slug)}`);
  }

  function exportCsv() {
    const header = [
      "Policy #",
      "Insured",
      "Status",
      "MGA",
      "Line of business",
      "Coverage",
      "Region",
      "Carrier",
      "Producer agency",
      "Underwriter",
      "Effective",
      "Expiration",
      "Premium",
      "Commission rate",
      "Notes",
    ];
    const rows = filtered.map((row) => [
      row.policyNumber,
      row.insuredName,
      row.status,
      row.mgaName,
      row.lineOfBusiness,
      row.coverageType,
      row.geographicRegion,
      row.carrier,
      row.producerAgency,
      row.underwriter,
      toDateInput(row.effectiveDate),
      toDateInput(row.expirationDate),
      row.premiumUsd,
      row.commissionRate,
      row.notes,
    ]);
    const csv = [header, ...rows]
      .map((values) => values.map(csvCell).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workbook.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} rows`);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <FileSpreadsheet className="size-5" />
            </span>
            <div className="min-w-0">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="flex max-w-full items-center gap-1 text-left text-base font-semibold text-slate-900 outline-none hover:text-navy-700">
                    <span className="truncate">{workbook.name}</span>
                    <ChevronDown className="size-4 shrink-0" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="start"
                    sideOffset={6}
                    className="z-50 min-w-72 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
                  >
                    <DropdownMenu.Label className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Newport workbooks
                    </DropdownMenu.Label>
                    {workbooks.map((book) => (
                      <DropdownMenu.Item
                        key={book.id}
                        onSelect={() => changeWorkbook(book.slug)}
                        className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 outline-none hover:bg-slate-100 data-[highlighted]:bg-slate-100"
                      >
                        {book.accessMode === WORKBOOK_ACCESS.ORGANIZATION ? (
                          <Users className="mt-0.5 size-4 text-emerald-600" />
                        ) : (
                          <LockKeyhole className="mt-0.5 size-4 text-amber-600" />
                        )}
                        <span className="flex-1">
                          <span className="block text-xs font-medium text-slate-800">
                            {book.name}
                          </span>
                          <span className="block text-[10px] text-slate-500">
                            {book.rowCount} rows ·{" "}
                            {book.accessMode === WORKBOOK_ACCESS.ORGANIZATION
                              ? "Everyone at Newport"
                              : `${book.memberCount} selected people`}
                          </span>
                        </span>
                        {book.id === workbook.id && (
                          <Check className="size-4 text-navy-700" />
                        )}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              <p className="truncate text-[11px] text-slate-500">
                {workbook.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-md bg-white px-2 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200 sm:flex">
              {workbook.accessMode === WORKBOOK_ACCESS.ORGANIZATION ? (
                <>
                  <Users className="size-3.5 text-emerald-600" />
                  Everyone at Newport
                </>
              ) : (
                <>
                  <LockKeyhole className="size-3.5 text-amber-600" />
                  {workbook.memberCount} selected people
                </>
              )}
            </span>
            <ShareWorkbookDialog workbook={workbook} onMutate={mutate} />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  aria-label="More workbook actions"
                  className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-white"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="z-50 min-w-48 rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-xl"
                >
                  <DropdownMenu.Item
                    onSelect={exportCsv}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 outline-none data-[highlighted]:bg-slate-100"
                  >
                    <Download className="size-4" />
                    Export visible rows (.csv)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <a
                      href="/api/backup"
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 outline-none data-[highlighted]:bg-slate-100"
                    >
                      <ShieldCheck className="size-4" />
                      Download full CRM backup
                    </a>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            mutate(() => addPolicyRow(workbook.slug), "New policy row added")
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-navy-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          Add row
        </button>
        <Separator.Root
          orientation="vertical"
          className="mx-1 h-5 w-px bg-slate-200"
        />
        <label className="relative min-w-52 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search policies, insureds, MGA, carrier…"
            className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-navy-500"
          />
        </label>
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          className={cnButton(filtersOpen)}
        >
          <Filter className="size-3.5" />
          Filters
          {(status !== "ALL" || line !== "ALL") && (
            <span className="rounded bg-navy-100 px-1 text-[10px] text-navy-800">
              {(status !== "ALL" ? 1 : 0) + (line !== "ALL" ? 1 : 0)}
            </span>
          )}
        </button>
        <button type="button" onClick={exportCsv} className={cnButton(false)}>
          <Download className="size-3.5" />
          Export
        </button>
      </div>

      <Collapsible.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
        <Collapsible.Content>
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-slate-50/80 px-3 py-2.5">
            <FilterSelect
              label="Policy status"
              value={status}
              onChange={setStatus}
              options={[
                ["ALL", "All statuses"],
                ...POLICY_STATUS.map(
                  (value) =>
                    [value, POLICY_STATUS_LABEL[value]] as const,
                ),
              ]}
            />
            <FilterSelect
              label="Line of business"
              value={line}
              onChange={setLine}
              options={[
                ["ALL", "All lines"],
                ...lines.map((value) => [value, value] as [string, string]),
              ]}
            />
            {(status !== "ALL" || line !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setStatus("ALL");
                  setLine("ALL");
                }}
                className="mb-0.5 text-xs font-medium text-navy-700 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      {filtered.length === 0 ? (
        <div className="p-5">
          <EmptyState>No policy rows match these filters.</EmptyState>
        </div>
      ) : (
        <div className="thin-scroll max-h-[calc(100vh-330px)] min-h-[480px] overflow-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-20 bg-slate-100 shadow-[0_1px_0_#cbd5e1]">
              <tr>
                <SheetTh className="sticky left-0 z-30 w-10 bg-slate-100 text-center">
                  #
                </SheetTh>
                <SheetTh className="sticky left-10 z-30 min-w-32 bg-slate-100">
                  Policy #
                </SheetTh>
                <SheetTh className="min-w-56">Insured / client</SheetTh>
                <SheetTh className="min-w-32">Status</SheetTh>
                <SheetTh className="min-w-52">MGA</SheetTh>
                <SheetTh className="min-w-44">Line of business</SheetTh>
                <SheetTh className="min-w-40">Coverage</SheetTh>
                <SheetTh className="min-w-36">Region</SheetTh>
                <SheetTh className="min-w-44">Carrier</SheetTh>
                <SheetTh className="min-w-52">Producer agency</SheetTh>
                <SheetTh className="min-w-44">Underwriter</SheetTh>
                <SheetTh className="min-w-32">Effective</SheetTh>
                <SheetTh className="min-w-32">Expiration</SheetTh>
                <SheetTh className="min-w-32 text-right">Premium</SheetTh>
                <SheetTh className="min-w-28 text-right">Commission</SheetTh>
                <SheetTh className="min-w-60">Notes</SheetTh>
                <SheetTh className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => (
                <PolicyGridRow
                  key={row.id}
                  row={row}
                  number={index + 1}
                  workbookSlug={workbook.slug}
                  disabled={isPending}
                  mutate={mutate}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <span>
          {filtered.length} of {workbook.rows.length} rows ·{" "}
          <strong className="text-slate-700">
            {formatUsd(totalPremium)}
          </strong>{" "}
          visible premium · {boundCount} bound / renewed
        </span>
        <span>
          Changes save on blur · last workbook update{" "}
          {new Date(workbook.updatedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

function PolicyGridRow({
  row,
  number,
  workbookSlug,
  disabled,
  mutate,
}: {
  row: PolicySheetRow;
  number: number;
  workbookSlug: string;
  disabled: boolean;
  mutate: (
    work: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) => void;
}) {
  const save = (field: string, value: string) =>
    mutate(
      () => updatePolicyCell(workbookSlug, row.id, field, value),
      "Cell saved",
    );

  return (
    <tr className="group hover:bg-navy-50/40">
      <SheetTd className="sticky left-0 z-10 bg-slate-50 text-center text-slate-400 group-hover:bg-navy-50">
        {number}
      </SheetTd>
      <SheetTd className="sticky left-10 z-10 bg-white p-0 group-hover:bg-navy-50">
        <CellInput
          value={row.policyNumber}
          onSave={(value) => save("policyNumber", value)}
        />
      </SheetTd>
      <SheetTd className="p-0">
        <CellInput
          value={row.insuredName}
          onSave={(value) => save("insuredName", value)}
          strong
        />
      </SheetTd>
      <SheetTd className="p-0">
        <StatusCell value={row.status} onSave={(value) => save("status", value)} />
      </SheetTd>
      <TextCell value={row.mgaName} onSave={(v) => save("mgaName", v)} />
      <TextCell
        value={row.lineOfBusiness}
        onSave={(v) => save("lineOfBusiness", v)}
      />
      <TextCell
        value={row.coverageType}
        onSave={(v) => save("coverageType", v)}
      />
      <TextCell
        value={row.geographicRegion}
        onSave={(v) => save("geographicRegion", v)}
      />
      <TextCell value={row.carrier} onSave={(v) => save("carrier", v)} />
      <TextCell
        value={row.producerAgency}
        onSave={(v) => save("producerAgency", v)}
      />
      <TextCell
        value={row.underwriter}
        onSave={(v) => save("underwriter", v)}
      />
      <DateCell
        value={row.effectiveDate}
        onSave={(v) => save("effectiveDate", v)}
      />
      <DateCell
        value={row.expirationDate}
        onSave={(v) => save("expirationDate", v)}
      />
      <SheetTd className="p-0">
        <CellInput
          value={row.premiumUsd?.toString() ?? ""}
          type="number"
          align="right"
          onSave={(v) => save("premiumUsd", v)}
        />
      </SheetTd>
      <SheetTd className="p-0">
        <CellInput
          value={row.commissionRate?.toString() ?? ""}
          type="number"
          step="0.01"
          align="right"
          displayValue={formatPercent(row.commissionRate)}
          onSave={(v) => save("commissionRate", v)}
        />
      </SheetTd>
      <TextCell value={row.notes} onSave={(v) => save("notes", v)} />
      <SheetTd className="p-0 text-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            mutate(
              () => deletePolicyRow(workbookSlug, row.id),
              "Policy row deleted",
            )
          }
          className="rounded p-1 text-slate-300 opacity-0 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
          aria-label={`Delete ${row.policyNumber}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      </SheetTd>
    </tr>
  );
}

function TextCell({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (value: string) => void;
}) {
  return (
    <SheetTd className="p-0">
      <CellInput value={value ?? ""} onSave={onSave} />
    </SheetTd>
  );
}

function DateCell({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (value: string) => void;
}) {
  return (
    <SheetTd className="p-0">
      <CellInput value={toDateInput(value)} type="date" onSave={onSave} />
    </SheetTd>
  );
}

function CellInput({
  value,
  onSave,
  type = "text",
  step,
  align = "left",
  strong = false,
  displayValue,
}: {
  value: string;
  onSave: (value: string) => void;
  type?: string;
  step?: string;
  align?: "left" | "right";
  strong?: boolean;
  displayValue?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      step={step}
      value={focused ? draft : displayValue ?? draft}
      onFocus={() => {
        setDraft(value);
        setFocused(true);
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setFocused(false);
        if (draft !== value) onSave(draft);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
      className={`h-9 w-full bg-transparent px-2 outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-navy-500 ${
        align === "right" ? "text-right tabular" : ""
      } ${strong ? "font-medium text-slate-900" : "text-slate-700"}`}
    />
  );
}

function StatusCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onSave(event.target.value)}
      className="h-9 w-full bg-transparent px-2 text-xs font-medium outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-navy-500"
    >
      {POLICY_STATUS.map((option) => (
        <option key={option} value={option}>
          {POLICY_STATUS_LABEL[option]}
        </option>
      ))}
    </select>
  );
}

function ShareWorkbookDialog({
  workbook,
  onMutate,
}: {
  workbook: WorkbookDetail;
  onMutate: (
    work: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(WORKBOOK_ROLE.VIEWER);
  const [memberSearch, setMemberSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const matchingMembers = workbook.members.filter((member) =>
    [member.name, member.email].join(" ").toLowerCase().includes(memberSearch.toLowerCase()),
  );
  const visibleMembers = showAll ? matchingMembers : matchingMembers.slice(0, 50);

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-700">
          <Users className="size-3.5" />
          Share
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-navy-950/40 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(680px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900">
                Share “{workbook.name}”
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-slate-500">
                Choose company-wide access or invite selected people by email.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="thin-scroll flex-1 overflow-y-auto px-5 py-4">
            <fieldset>
              <legend className="text-xs font-semibold text-slate-700">
                General access
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <AccessCard
                  icon={<Users className="size-4" />}
                  title="Everyone at Newport"
                  detail="Every organization account can open the workbook."
                  selected={workbook.accessMode === WORKBOOK_ACCESS.ORGANIZATION}
                  disabled={false}
                  onClick={() =>
                    onMutate(
                      () =>
                        updateWorkbookAccess(
                          workbook.slug,
                          WORKBOOK_ACCESS.ORGANIZATION,
                        ),
                      "Workbook is available to everyone at Newport",
                    )
                  }
                />
                <AccessCard
                  icon={<LockKeyhole className="size-4" />}
                  title="Selected people"
                  detail="Only email addresses listed below can open it."
                  selected={workbook.accessMode === WORKBOOK_ACCESS.RESTRICTED}
                  disabled={workbook.isPrimary}
                  onClick={() =>
                    onMutate(
                      () =>
                        updateWorkbookAccess(
                          workbook.slug,
                          WORKBOOK_ACCESS.RESTRICTED,
                        ),
                      "Workbook access is restricted",
                    )
                  }
                />
              </div>
              {workbook.isPrimary && (
                <p className="mt-2 text-[11px] text-slate-500">
                  The main company register stays available to everyone. Switch
                  to a deal-room workbook for email-only access.
                </p>
              )}
            </fieldset>

            <Separator.Root className="my-4 h-px bg-slate-200" />

            <div>
              <Label.Root
                htmlFor="invite-email"
                className="text-xs font-semibold text-slate-700"
              >
                Add people
              </Label.Root>
              <div className="mt-2 flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <UserPlus className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@newportsp.com"
                    className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-xs outline-none focus:border-navy-500"
                  />
                </div>
                <RadixRoleSelect value={role} onChange={setRole} />
                <button
                  type="button"
                  onClick={() => {
                    if (!email.trim()) return;
                    onMutate(
                      () => inviteWorkbookMember(workbook.slug, email, role),
                      `Invitation sent to ${email.trim().toLowerCase()}`,
                    );
                    setEmail("");
                  }}
                  className="rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-700"
                >
                  Invite
                </button>
              </div>
            </div>

            <Collapsible.Root className="mt-4">
              <Collapsible.Trigger className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">
                <span>
                  People with explicit access{" "}
                  <span className="font-normal text-slate-500">
                    ({workbook.members.length})
                  </span>
                </span>
                <ChevronDown className="size-4" />
              </Collapsible.Trigger>
              <Collapsible.Content>
                <div className="relative mt-2">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={memberSearch}
                    onChange={(event) => {
                      setMemberSearch(event.target.value);
                      setShowAll(false);
                    }}
                    placeholder={`Search ${workbook.members.length} people by name or email`}
                    className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-xs outline-none focus:border-navy-500"
                  />
                </div>
                <ul className="mt-2 divide-y divide-slate-100">
                  <li className="flex items-center gap-3 py-2">
                    <Avatar name={workbook.ownerName} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-slate-800">
                        {workbook.ownerName} (you)
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {workbook.ownerEmail}
                      </span>
                    </span>
                    <Badge tone="navy">Owner</Badge>
                  </li>
                  {visibleMembers.map((member) => (
                    <li key={member.id} className="flex items-center gap-3 py-2">
                      <Avatar name={member.name ?? member.email} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-slate-800">
                          {member.name ?? member.email}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {member.email} ·{" "}
                          {member.status === "INVITED" ? "Invited" : "Active"}
                        </span>
                      </span>
                      <RadixRoleSelect
                        compact
                        value={member.role}
                        onChange={(nextRole) =>
                          onMutate(
                            () =>
                              updateWorkbookMemberRole(
                                workbook.slug,
                                member.id,
                                nextRole,
                              ),
                            `${member.name ?? member.email} is now ${nextRole.toLowerCase()}`,
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onMutate(
                            () =>
                              removeWorkbookMember(workbook.slug, member.id),
                            "Access removed",
                          )
                        }
                        aria-label={`Remove ${member.email}`}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
                {!showAll && matchingMembers.length > 50 && (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="mt-2 w-full rounded-lg border border-slate-300 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Show all {matchingMembers.length} people
                  </button>
                )}
              </Collapsible.Content>
            </Collapsible.Root>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AccessCard({
  icon,
  title,
  detail,
  selected,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || selected}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-lg border p-3 text-left ${
        selected
          ? "border-navy-500 bg-navy-50 ring-1 ring-navy-500"
          : "border-slate-200 hover:bg-slate-50"
      } disabled:cursor-default disabled:opacity-70`}
    >
      <span className={selected ? "text-navy-700" : "text-slate-500"}>{icon}</span>
      <span className="flex-1">
        <span className="block text-xs font-semibold text-slate-800">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
          {detail}
        </span>
      </span>
      {selected && <Check className="size-4 text-navy-700" />}
    </button>
  );
}

function RadixRoleSelect({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label="Access role"
        className={`inline-flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 outline-none ${
          compact ? "w-24 px-2 py-1.5" : "w-28 px-3 py-2"
        }`}
      >
        <Select.Value />
        <Select.Icon>
          <ChevronDown className="size-3.5" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-[60] min-w-[var(--radix-select-trigger-width)] rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
        >
          <Select.Viewport>
            {[WORKBOOK_ROLE.EDITOR, WORKBOOK_ROLE.VIEWER].map((option) => (
              <Select.Item
                key={option}
                value={option}
                className="relative cursor-pointer rounded-md py-1.5 pl-7 pr-2 text-xs capitalize text-slate-700 outline-none data-[highlighted]:bg-slate-100"
              >
                <Select.ItemIndicator className="absolute left-2 top-1/2 -translate-y-1/2">
                  <Check className="size-3.5" />
                </Select.ItemIndicator>
                <Select.ItemText>{option.toLowerCase()}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: (readonly [string, string])[];
}) {
  const id = `filter-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div>
      <Label.Root
        htmlFor={id}
        className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500"
      >
        {label}
      </Label.Root>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-w-44 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-navy-500"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy-100 text-[10px] font-semibold text-navy-800">
      {initials}
    </span>
  );
}

function SheetTh({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`h-9 border-b border-r border-slate-300 px-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${className}`}
    >
      {children}
    </th>
  );
}

function SheetTd({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`h-9 border-b border-r border-slate-200 ${className}`}>
      {children}
    </td>
  );
}

function cnButton(active: boolean) {
  return `inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
    active
      ? "border-navy-300 bg-navy-50 text-navy-800"
      : "border-slate-300 text-slate-600 hover:bg-slate-50"
  }`;
}

function toDateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
