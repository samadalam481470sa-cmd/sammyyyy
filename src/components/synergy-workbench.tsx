"use client";

import { useMemo, useState } from "react";

import { clsx } from "clsx";

import { formatNumber, formatPercent, formatUsdCompact } from "@/lib/format";
import type { MgaSummary } from "@/lib/queries";
import type {
  CrossSellOpportunity,
  MgaPairOverlap,
  OverlapGroup,
} from "@/lib/synergy";
import {
  SYNERGY_DIMENSION_LABEL,
  SYNERGY_DIMENSIONS,
  type SynergyDimension,
} from "@/lib/taxonomy";

import { Badge, EmptyState, MgaLink, MiniBar, Panel, Td, Th } from "./ui";

const DIMENSIONS: SynergyDimension[] = [
  SYNERGY_DIMENSIONS.lineOfBusiness,
  SYNERGY_DIMENSIONS.coverageType,
  SYNERGY_DIMENSIONS.geographicRegion,
];

type OpportunityFilter = "ALL" | "REGIONAL_EXTENSION" | "PRODUCT_TRANSFER";

export function SynergyWorkbench({
  companies,
  overlapsByDimension,
  pairOverlaps,
  crossSellOpportunities,
}: {
  companies: MgaSummary[];
  overlapsByDimension: Record<SynergyDimension, OverlapGroup[]>;
  pairOverlaps: MgaPairOverlap[];
  crossSellOpportunities: CrossSellOpportunity[];
}) {
  const [dimension, setDimension] = useState<SynergyDimension>(
    SYNERGY_DIMENSIONS.lineOfBusiness,
  );
  const [opportunityFilter, setOpportunityFilter] =
    useState<OpportunityFilter>("ALL");

  const groups = overlapsByDimension[dimension];
  const overlapping = groups.filter((group) => group.isOverlap);
  const exclusive = groups.filter((group) => !group.isOverlap);

  const filteredOpportunities = useMemo(
    () =>
      opportunityFilter === "ALL"
        ? crossSellOpportunities
        : crossSellOpportunities.filter(
            (opportunity) => opportunity.opportunityKind === opportunityFilter,
          ),
    [crossSellOpportunities, opportunityFilter],
  );

  const maxProvenPremium = Math.max(
    1,
    ...crossSellOpportunities.map((opportunity) => opportunity.provenPremiumUsd),
  );

  const pairLookup = useMemo(() => {
    const lookup = new Map<string, MgaPairOverlap>();
    for (const pair of pairOverlaps) {
      lookup.set(`${pair.aMgaId}|${pair.bMgaId}`, pair);
      lookup.set(`${pair.bMgaId}|${pair.aMgaId}`, pair);
    }
    return lookup;
  }, [pairOverlaps]);

  return (
    <div className="space-y-4">
      <Panel
        title="Overlap by dimension"
        description="An overlap is two or more acquired MGAs carrying the same tag. Those are the candidates for a shared carrier negotiation or a consolidated underwriting desk. The exclusive list below is the opposite problem: capability the platform owns in exactly one place."
        actions={
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5">
            {DIMENSIONS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setDimension(key)}
                className={clsx(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  dimension === key
                    ? "bg-navy-800 text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {SYNERGY_DIMENSION_LABEL[key]}
              </button>
            ))}
          </div>
        }
        bodyClassName="p-0"
      >
        <div className="grid divide-y divide-slate-200 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gold-700">
                Shared across the platform
              </h3>
              <Badge tone="gold">{overlapping.length}</Badge>
            </div>
            {overlapping.length === 0 ? (
              <div className="p-5">
                <EmptyState>
                  No {SYNERGY_DIMENSION_LABEL[dimension].toLowerCase()} is
                  carried by more than one acquired MGA.
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {overlapping.map((group) => (
                  <li key={group.tag} className="px-5 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {group.tag}
                      </h4>
                      <span className="text-xs tabular text-slate-500">
                        {group.mgaCount} MGAs · {group.programCount} programs ·{" "}
                        <span className="font-semibold text-slate-800">
                          {formatUsdCompact(group.totalWrittenPremiumUsd)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {group.mgas.map((presence) => (
                        <div
                          key={presence.mgaId}
                          className="flex items-center gap-3"
                        >
                          <MgaLink
                            slug={presence.mgaSlug}
                            name={presence.mgaName}
                            className="w-56 shrink-0 truncate text-xs"
                          />
                          <div className="flex-1">
                            <MiniBar
                              value={presence.writtenPremiumUsd}
                              max={group.totalWrittenPremiumUsd}
                              tone="gold"
                            />
                          </div>
                          <span className="w-16 shrink-0 text-right text-xs tabular text-slate-600">
                            {formatUsdCompact(presence.writtenPremiumUsd)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Held by one MGA only
              </h3>
              <Badge tone="outline">{exclusive.length}</Badge>
            </div>
            {exclusive.length === 0 ? (
              <div className="p-5">
                <EmptyState>Every tag on this dimension is shared.</EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {exclusive.map((group) => (
                  <li
                    key={group.tag}
                    className="flex items-baseline justify-between gap-3 px-5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {group.tag}
                      </p>
                      {group.mgas[0] && (
                        <MgaLink
                          slug={group.mgas[0].mgaSlug}
                          name={group.mgas[0].mgaName}
                          className="text-[11px]"
                        />
                      )}
                    </div>
                    <span className="shrink-0 text-xs tabular text-slate-600">
                      {formatUsdCompact(group.totalWrittenPremiumUsd)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        title="Pairwise overlap"
        description="Jaccard similarity over each pair's combined line-of-business, coverage and region tags. Jaccard rather than a raw count of shared tags, so a large MGA with many programs does not appear synergistic with everything simply because it is big."
        bodyClassName="p-0"
      >
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <Th className="sticky left-0 z-10 bg-slate-50">MGA</Th>
                {companies.map((company) => (
                  <Th key={company.id} align="center" className="min-w-24">
                    <span className="block whitespace-normal leading-tight">
                      {shortName(company.name)}
                    </span>
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((row) => (
                <tr key={row.id}>
                  <Td className="sticky left-0 z-10 bg-white whitespace-nowrap">
                    <MgaLink slug={row.slug} name={row.name} />
                  </Td>
                  {companies.map((column) => {
                    if (row.id === column.id) {
                      return (
                        <Td
                          key={column.id}
                          align="center"
                          className="bg-slate-50 text-slate-300"
                        >
                          —
                        </Td>
                      );
                    }
                    const pair = pairLookup.get(`${row.id}|${column.id}`);
                    const score = pair?.overlapScore ?? 0;
                    return (
                      <Td key={column.id} align="center" className="p-1.5">
                        <span
                          title={describePair(pair)}
                          className={clsx(
                            "flex h-9 items-center justify-center rounded-md text-xs font-semibold tabular",
                            heatClass(score),
                          )}
                        >
                          {formatPercent(score, 0)}
                        </span>
                      </Td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-5 py-3 text-[11px] text-slate-500">
          <span className="font-medium">Overlap</span>
          {[0, 0.15, 0.3, 0.45, 0.6].map((threshold) => (
            <span key={threshold} className="flex items-center gap-1.5">
              <span
                className={clsx("size-3.5 rounded", heatClass(threshold + 0.01))}
              />
              {formatPercent(threshold, 0)}+
            </span>
          ))}
          <span className="ml-auto">Hover a cell for the shared tags.</span>
        </div>
      </Panel>

      <Panel
        title={`White space and cross-sell (${filteredOpportunities.length})`}
        description="A line of business one acquired MGA already writes profitably, in a region where a sibling MGA has distribution but no product. A regional extension means the candidate already underwrites the line elsewhere; a product transfer means the product has to come from the sibling."
        actions={
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5">
            {(
              [
                ["ALL", "All"],
                ["REGIONAL_EXTENSION", "Regional extension"],
                ["PRODUCT_TRANSFER", "Product transfer"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setOpportunityFilter(value)}
                className={clsx(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  opportunityFilter === value
                    ? "bg-navy-800 text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
        bodyClassName="p-0"
      >
        {filteredOpportunities.length === 0 ? (
          <div className="p-5">
            <EmptyState>
              No opportunity of this kind across the current portfolio.
            </EmptyState>
          </div>
        ) : (
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <Th>Opportunity</Th>
                  <Th>Candidate MGA</Th>
                  <Th>Kind</Th>
                  <Th>Proven by</Th>
                  <Th align="right">Proven premium</Th>
                  <Th align="right">Retailers in region</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOpportunities.map((opportunity) => (
                  <tr
                    key={`${opportunity.candidateMgaId}-${opportunity.lineOfBusiness}-${opportunity.geographicRegion}`}
                    className="hover:bg-slate-50"
                  >
                    <Td>
                      <span className="font-medium text-slate-900">
                        {opportunity.lineOfBusiness}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        into {opportunity.geographicRegion}
                      </span>
                    </Td>
                    <Td>
                      <MgaLink
                        slug={opportunity.candidateMgaSlug}
                        name={opportunity.candidateMgaName}
                      />
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          opportunity.opportunityKind === "REGIONAL_EXTENSION"
                            ? "emerald"
                            : "navy"
                        }
                      >
                        {opportunity.opportunityKind === "REGIONAL_EXTENSION"
                          ? "Regional extension"
                          : "Product transfer"}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {opportunity.provenByMgas.map((mga) => (
                          <MgaLink
                            key={mga.mgaId}
                            slug={mga.mgaSlug}
                            name={mga.mgaName}
                            className="text-xs"
                          />
                        ))}
                      </div>
                    </Td>
                    <Td align="right">
                      <span className="font-medium tabular text-slate-900">
                        {formatUsdCompact(opportunity.provenPremiumUsd)}
                      </span>
                      <div className="mt-1 ml-auto w-24">
                        <MiniBar
                          value={opportunity.provenPremiumUsd}
                          max={maxProvenPremium}
                          tone="navy"
                        />
                      </div>
                    </Td>
                    <Td align="right" className="tabular">
                      {opportunity.candidateRetailReach > 0 ? (
                        formatNumber(opportunity.candidateRetailReach)
                      ) : (
                        <span
                          className="text-slate-400"
                          title="No retailers appointed in this region yet — the candidate reaches it through a program instead."
                        >
                          0
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function shortName(name: string): string {
  return name
    .replace(/ (Underwriters|Specialty Risk|Program Managers|Casualty Group|Professional Lines)$/, "")
    .trim();
}

function describePair(pair: MgaPairOverlap | undefined): string {
  if (!pair) return "No shared tags";
  const parts = [
    pair.sharedLinesOfBusiness.length > 0
      ? `Lines: ${pair.sharedLinesOfBusiness.join(", ")}`
      : null,
    pair.sharedCoverageTypes.length > 0
      ? `Coverages: ${pair.sharedCoverageTypes.join(", ")}`
      : null,
    pair.sharedGeographicRegions.length > 0
      ? `Regions: ${pair.sharedGeographicRegions.join(", ")}`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No shared tags";
}

function heatClass(score: number): string {
  if (score >= 0.6) return "bg-gold-500 text-white";
  if (score >= 0.45) return "bg-gold-300 text-gold-900";
  if (score >= 0.3) return "bg-gold-200 text-gold-900";
  if (score >= 0.15) return "bg-gold-100 text-gold-800";
  if (score > 0) return "bg-slate-100 text-slate-500";
  return "bg-slate-50 text-slate-300";
}
