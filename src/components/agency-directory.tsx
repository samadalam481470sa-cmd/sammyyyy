"use client";

import { useMemo, useState } from "react";

import { clsx } from "clsx";

import { formatDate, formatNumber, formatUsdCompact } from "@/lib/format";
import type { RetailAgencyRow } from "@/lib/queries";
import { MGA_STATUS } from "@/lib/taxonomy";

import { StatusBadge } from "./status-badges";
import { Badge, EmptyState, MgaLink, Panel, Td, Th } from "./ui";

type SortKey = "premium" | "name" | "policies" | "appointed" | "mga";

export function AgencyDirectory({ agencies }: { agencies: RetailAgencyRow[] }) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("premium");
  const [sortAsc, setSortAsc] = useState(false);

  const regions = useMemo(
    () => [...new Set(agencies.map((agency) => agency.region))].sort(),
    [agencies],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const result = agencies.filter((agency) => {
      if (region !== "ALL" && agency.region !== region) return false;
      if (statusFilter !== "ALL" && agency.mgaStatus !== statusFilter)
        return false;
      if (needle.length === 0) return true;
      return [
        agency.name,
        agency.principalName,
        agency.city,
        agency.state,
        agency.region,
        agency.mgaName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    const direction = sortAsc ? 1 : -1;
    return result.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * direction;
        case "mga":
          return (
            (a.mgaName.localeCompare(b.mgaName) ||
              a.name.localeCompare(b.name)) * direction
          );
        case "policies":
          return ((a.policyCount ?? 0) - (b.policyCount ?? 0)) * direction;
        case "appointed":
          return (
            ((a.appointedOn ? Date.parse(a.appointedOn) : 0) -
              (b.appointedOn ? Date.parse(b.appointedOn) : 0)) *
            direction
          );
        case "premium":
        default:
          return (
            ((a.annualPremiumPlacedUsd ?? 0) - (b.annualPremiumPlacedUsd ?? 0)) *
            direction
          );
      }
    });
  }, [agencies, query, region, statusFilter, sortKey, sortAsc]);

  const totalPremium = filtered.reduce(
    (sum, agency) => sum + (agency.annualPremiumPlacedUsd ?? 0),
    0,
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((asc) => !asc);
      return;
    }
    setSortKey(key);
    setSortAsc(key === "name" || key === "mga");
  }

  return (
    <Panel
      title={`Retail agencies (${filtered.length}${filtered.length === agencies.length ? "" : ` of ${agencies.length}`})`}
      description={`Independent retailers appointed through a platform or pipeline MGA — unrelated to each other and to Newport. ${formatUsdCompact(totalPremium)} of premium placed by the agencies shown.`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agency, principal, city or MGA"
            className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-navy-500 focus:outline-none"
          />
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-navy-500 focus:outline-none"
          >
            <option value="ALL">All regions</option>
            {regions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-navy-500 focus:outline-none"
          >
            <option value="ALL">Platform and pipeline</option>
            <option value={MGA_STATUS.ON_PLATFORM}>Platform MGAs only</option>
            <option value={MGA_STATUS.PIPELINE}>Pipeline MGAs only</option>
          </select>
        </div>
      }
      bodyClassName="p-0"
    >
      {filtered.length === 0 ? (
        <div className="p-5">
          <EmptyState>
            No retail agency matches this search. Clear the search box or widen
            the region filter.
          </EmptyState>
        </div>
      ) : (
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <SortableTh
                  label="Agency"
                  active={sortKey === "name"}
                  asc={sortAsc}
                  onClick={() => toggleSort("name")}
                />
                <Th>Principal</Th>
                <Th>Location</Th>
                <Th>Region</Th>
                <SortableTh
                  label="Associated MGA"
                  active={sortKey === "mga"}
                  asc={sortAsc}
                  onClick={() => toggleSort("mga")}
                />
                <SortableTh
                  label="Appointed"
                  active={sortKey === "appointed"}
                  asc={sortAsc}
                  align="right"
                  onClick={() => toggleSort("appointed")}
                />
                <SortableTh
                  label="Premium placed"
                  active={sortKey === "premium"}
                  asc={sortAsc}
                  align="right"
                  onClick={() => toggleSort("premium")}
                />
                <SortableTh
                  label="Policies"
                  active={sortKey === "policies"}
                  asc={sortAsc}
                  align="right"
                  onClick={() => toggleSort("policies")}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((agency) => (
                <tr key={agency.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">{agency.name}</Td>
                  <Td className="text-slate-600">{agency.principalName}</Td>
                  <Td className="text-slate-600">
                    {agency.city}, {agency.state}
                  </Td>
                  <Td>
                    <Badge tone="slate">{agency.region}</Badge>
                  </Td>
                  <Td>
                    <MgaLink slug={agency.mgaSlug} name={agency.mgaName} />
                    <span className="mt-0.5 block">
                      <StatusBadge status={agency.mgaStatus} />
                    </span>
                  </Td>
                  <Td align="right" className="tabular text-slate-600">
                    {formatDate(agency.appointedOn)}
                  </Td>
                  <Td align="right" className="font-medium tabular">
                    {formatUsdCompact(agency.annualPremiumPlacedUsd)}
                  </Td>
                  <Td align="right" className="tabular text-slate-600">
                    {formatNumber(agency.policyCount)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function SortableTh({
  label,
  active,
  asc,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <Th align={align} aria-sort={active ? (asc ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          "inline-flex items-center gap-1 uppercase tracking-wider hover:text-navy-700",
          active && "text-navy-700",
        )}
      >
        {label}
        <span aria-hidden className={clsx(!active && "text-slate-300")}>
          {active ? (asc ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </Th>
  );
}
