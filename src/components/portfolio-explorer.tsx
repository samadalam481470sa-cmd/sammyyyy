"use client";

import { useMemo, useState } from "react";

import { clsx } from "clsx";

import {
  formatMultiple,
  formatPercent,
  formatSignedPercent,
  formatUsdCompact,
} from "@/lib/format";
import type { MgaSummary } from "@/lib/queries";
import type { OverlapGroup } from "@/lib/synergy";
import {
  SYNERGY_DIMENSION_LABEL,
  SYNERGY_DIMENSIONS,
  type SynergyDimension,
} from "@/lib/taxonomy";

import { Badge, MgaLink, Panel, TagChip, Td, Th } from "./ui";

const DIMENSIONS: SynergyDimension[] = [
  SYNERGY_DIMENSIONS.lineOfBusiness,
  SYNERGY_DIMENSIONS.coverageType,
  SYNERGY_DIMENSIONS.geographicRegion,
];

export function PortfolioExplorer({
  companies,
  overlapsByDimension,
}: {
  companies: MgaSummary[];
  overlapsByDimension: Record<SynergyDimension, OverlapGroup[]>;
}) {
  const [dimension, setDimension] = useState<SynergyDimension>(
    SYNERGY_DIMENSIONS.lineOfBusiness,
  );
  const [overlapOnly, setOverlapOnly] = useState(false);

  const groups = overlapsByDimension[dimension];

  const visibleGroups = useMemo(
    () => (overlapOnly ? groups.filter((group) => group.isOverlap) : groups),
    [groups, overlapOnly],
  );

  /** Tag -> mgaId -> presence, for O(1) matrix cell lookups. */
  const presenceIndex = useMemo(() => {
    const index = new Map<
      string,
      Map<string, { programCount: number; writtenPremiumUsd: number }>
    >();
    for (const group of groups) {
      index.set(
        group.tag,
        new Map(
          group.mgas.map((presence) => [
            presence.mgaId,
            {
              programCount: presence.programCount,
              writtenPremiumUsd: presence.writtenPremiumUsd,
            },
          ]),
        ),
      );
    }
    return index;
  }, [groups]);

  /** Tags shared by two or more acquired MGAs, per dimension. */
  const sharedTags = useMemo(() => {
    const shared: Record<SynergyDimension, Set<string>> = {
      lineOfBusiness: new Set(),
      coverageType: new Set(),
      geographicRegion: new Set(),
    };
    for (const key of DIMENSIONS) {
      for (const group of overlapsByDimension[key]) {
        if (group.isOverlap) shared[key].add(group.tag);
      }
    }
    return shared;
  }, [overlapsByDimension]);

  const overlapCount = groups.filter((group) => group.isOverlap).length;

  return (
    <div className="space-y-4">
      <Panel
        title="Capability matrix"
        description={`Where the acquired MGAs sit on the same ${SYNERGY_DIMENSION_LABEL[dimension].toLowerCase()}. A gold column is carried by two or more MGAs — that is the overlap. A plain column is a capability the platform holds in exactly one place today. ${overlapCount} of ${groups.length} overlap.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={overlapOnly}
                onChange={(event) => setOverlapOnly(event.target.checked)}
                className="size-3.5 rounded border-slate-300 accent-gold-500"
              />
              Overlaps only
            </label>
          </div>
        }
        bodyClassName="p-0"
      >
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <Th className="sticky left-0 z-10 bg-slate-50">MGA</Th>
                {visibleGroups.map((group) => (
                  <Th
                    key={group.tag}
                    align="center"
                    className={clsx(
                      "min-w-28 align-bottom",
                      group.isOverlap && "bg-gold-50 text-gold-800",
                    )}
                  >
                    <span className="block whitespace-normal leading-tight">
                      {group.tag}
                    </span>
                    <span
                      className={clsx(
                        "mt-1 block text-[10px] font-bold tabular",
                        group.isOverlap ? "text-gold-700" : "text-slate-400",
                      )}
                    >
                      {group.mgaCount} MGA{group.mgaCount === 1 ? "" : "s"}
                    </span>
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-slate-50/60">
                  <Td className="sticky left-0 z-10 bg-white">
                    <MgaLink slug={company.slug} name={company.name} />
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {formatUsdCompact(company.trend.latestEbitdaUsd)} EBITDA ·{" "}
                      {company.yearsOfExperience} yrs
                    </span>
                  </Td>
                  {visibleGroups.map((group) => {
                    const presence = presenceIndex.get(group.tag)?.get(company.id);
                    return (
                      <Td key={group.tag} align="center" className="px-2">
                        {presence ? (
                          <span
                            className={clsx(
                              "inline-flex min-w-16 flex-col rounded-md px-2 py-1 text-[11px] font-semibold tabular",
                              group.isOverlap
                                ? "bg-gold-100 text-gold-900"
                                : "bg-navy-50 text-navy-800",
                            )}
                          >
                            {formatUsdCompact(presence.writtenPremiumUsd)}
                            <span className="text-[10px] font-medium opacity-70">
                              {presence.programCount} prog
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-300">·</span>
                        )}
                      </Td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <Th className="sticky left-0 z-10 bg-slate-50">
                  Platform premium
                </Th>
                {visibleGroups.map((group) => (
                  <Td
                    key={group.tag}
                    align="center"
                    className={clsx(
                      "text-xs font-semibold tabular",
                      group.isOverlap ? "text-gold-800" : "text-slate-600",
                    )}
                  >
                    {formatUsdCompact(group.totalWrittenPremiumUsd)}
                  </Td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <Panel
        title="Platform companies"
        description="Gold tags are shared with at least one other acquired MGA. Plain tags sit in this MGA alone — those are the capabilities worth spreading, and the ones that would leave with the operator."
        bodyClassName="p-4"
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {companies.map((company) => (
            <article
              key={company.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <MgaLink
                    slug={company.slug}
                    name={company.name}
                    className="text-base"
                  />
                  <p className="mt-0.5 text-xs text-slate-500">
                    {company.principalName} · {company.headquartersCity},{" "}
                    {company.headquartersState} · founded {company.foundedYear}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone="navy">
                    {formatUsdCompact(company.trend.latestEbitdaUsd)} EBITDA
                  </Badge>
                  <span className="text-[11px] font-semibold tabular text-emerald-700">
                    {formatSignedPercent(company.trend.ebitdaCagr)} CAGR
                  </span>
                </div>
              </header>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                <Figure
                  label="Premium"
                  value={formatUsdCompact(company.programPremiumUsd)}
                />
                <Figure
                  label="EBITDA margin"
                  value={formatPercent(company.trend.latestEbitdaMargin)}
                />
                <Figure
                  label="Entry multiple"
                  value={formatMultiple(company.ebitdaMultiple)}
                />
                <Figure
                  label="Retailers"
                  value={String(company.retailAgencyCount)}
                />
              </dl>

              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                <TagRow
                  label="Lines of business"
                  tags={company.linesOfBusiness}
                  shared={sharedTags.lineOfBusiness}
                />
                <TagRow
                  label="Coverage types"
                  tags={company.coverageTypes}
                  shared={sharedTags.coverageType}
                />
                <TagRow
                  label="Regions"
                  tags={company.geographicRegions}
                  shared={sharedTags.geographicRegion}
                />
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold tabular text-slate-800">{value}</dd>
    </div>
  );
}

function TagRow({
  label,
  tags,
  shared,
}: {
  label: string;
  tags: string[];
  shared: Set<string>;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="w-full text-[10px] font-medium uppercase tracking-wider text-slate-400 sm:w-32">
        {label}
      </span>
      <div className="flex flex-1 flex-wrap gap-1">
        {tags.map((tag) => (
          <TagChip
            key={tag}
            label={tag}
            shared={shared.has(tag)}
            title={
              shared.has(tag)
                ? `${tag} is also carried by another acquired MGA`
                : `${tag} sits only in this MGA today`
            }
          />
        ))}
      </div>
    </div>
  );
}
