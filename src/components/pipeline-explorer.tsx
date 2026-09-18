"use client";

import { useMemo, useState } from "react";

import { clsx } from "clsx";

import {
  formatMultiple,
  formatNumber,
  formatPercent,
  formatSignedPercent,
  formatUsdCompact,
} from "@/lib/format";
import { buildEbitdaTrend, evaluateBestInClass } from "@/lib/metrics";
import type { MgaSummary } from "@/lib/queries";
import {
  BEST_IN_CLASS_THRESHOLDS,
  DEAL_STAGE_LABEL,
  PIPELINE_STAGE_ORDER,
  type DealStage,
} from "@/lib/taxonomy";

import { BestInClassBadge, StageBadge } from "./status-badges";
import { Badge, EmptyState, MgaLink, MiniBar, Panel, Td, Th } from "./ui";

type SortKey =
  | "score"
  | "name"
  | "cagr"
  | "ebitda"
  | "premium"
  | "experience"
  | "multiple";

const SORT_LABEL: Record<SortKey, string> = {
  score: "Thesis fit",
  name: "Name",
  cagr: "EBITDA growth",
  ebitda: "Trailing EBITDA",
  premium: "Written premium",
  experience: "Years of experience",
  multiple: "Ask multiple",
};

type Filters = {
  minYears: number;
  minCagr: number;
  minEbitdaMillions: number;
  regions: string[];
  linesOfBusiness: string[];
  stages: DealStage[];
  includeProjections: boolean;
  includePassed: boolean;
  bestInClassOnly: boolean;
};

const UNFILTERED: Filters = {
  minYears: 0,
  minCagr: 0,
  minEbitdaMillions: 0,
  regions: [],
  linesOfBusiness: [],
  stages: [],
  includeProjections: false,
  includePassed: false,
  bestInClassOnly: false,
};

/** Mary's thesis, applied as a one-click preset. */
const BEST_IN_CLASS_PRESET: Filters = {
  ...UNFILTERED,
  minYears: BEST_IN_CLASS_THRESHOLDS.minYearsOfExperience,
  minCagr: BEST_IN_CLASS_THRESHOLDS.minEbitdaCagr,
  minEbitdaMillions: BEST_IN_CLASS_THRESHOLDS.minLatestEbitdaUsd / 1_000_000,
  bestInClassOnly: true,
};

export function PipelineExplorer({
  targets,
  regions,
  linesOfBusiness,
}: {
  targets: MgaSummary[];
  regions: string[];
  linesOfBusiness: string[];
}) {
  const [filters, setFilters] = useState<Filters>(UNFILTERED);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);

  // Growth is recomputed here rather than fetched, so switching the projection
  // toggle re-ranks the table with the same functions the server uses.
  const rows = useMemo(() => {
    return targets.map((target) => {
      const trend = buildEbitdaTrend(target.financials, {
        includeProjections: filters.includeProjections,
      });
      return {
        ...target,
        trend,
        bestInClass: evaluateBestInClass({
          yearsOfExperience: target.yearsOfExperience,
          ebitdaCagr: trend.ebitdaCagr,
          latestEbitdaUsd: trend.latestEbitdaUsd,
        }),
      };
    });
  }, [targets, filters.includeProjections]);

  const filtered = useMemo(() => {
    const result = rows.filter((row) => {
      if (!filters.includePassed && row.stage === "PASSED") return false;
      if (filters.stages.length > 0 && !filters.stages.includes(row.stage as DealStage))
        return false;
      if (row.yearsOfExperience < filters.minYears) return false;
      if (filters.bestInClassOnly && !row.bestInClass.isBestInClass)
        return false;

      const cagr = row.trend.ebitdaCagr;
      if (filters.minCagr > 0 && (cagr === null || cagr < filters.minCagr))
        return false;

      const ebitda = row.trend.latestEbitdaUsd;
      if (
        filters.minEbitdaMillions > 0 &&
        (ebitda === null || ebitda < filters.minEbitdaMillions * 1_000_000)
      )
        return false;

      if (
        filters.regions.length > 0 &&
        !filters.regions.some((region) =>
          row.geographicRegions.includes(region),
        )
      )
        return false;

      if (
        filters.linesOfBusiness.length > 0 &&
        !filters.linesOfBusiness.some((line) =>
          row.linesOfBusiness.includes(line),
        )
      )
        return false;

      return true;
    });

    const direction = sortAsc ? 1 : -1;
    return result.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * direction;
        case "cagr":
          return ((a.trend.ebitdaCagr ?? -99) - (b.trend.ebitdaCagr ?? -99)) * direction;
        case "ebitda":
          return (
            ((a.trend.latestEbitdaUsd ?? 0) - (b.trend.latestEbitdaUsd ?? 0)) *
            direction
          );
        case "premium":
          return (a.programPremiumUsd - b.programPremiumUsd) * direction;
        case "experience":
          return (a.yearsOfExperience - b.yearsOfExperience) * direction;
        case "multiple":
          return ((a.ebitdaMultiple ?? 0) - (b.ebitdaMultiple ?? 0)) * direction;
        case "score":
        default:
          return (a.bestInClass.score - b.bestInClass.score) * direction;
      }
    });
  }, [rows, filters, sortKey, sortAsc]);

  const maxEbitda = Math.max(
    1,
    ...rows.map((row) => row.trend.latestEbitdaUsd ?? 0),
  );
  const bestInClassCount = rows.filter(
    (row) => row.bestInClass.isBestInClass && row.stage !== "PASSED",
  ).length;
  const activeCount = rows.filter((row) => row.stage !== "PASSED").length;

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((asc) => !asc);
      return;
    }
    setSortKey(key);
    setSortAsc(key === "name");
  }

  function toggleIn<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];
  }

  const presetActive =
    filters.bestInClassOnly &&
    filters.minYears === BEST_IN_CLASS_PRESET.minYears &&
    filters.minCagr === BEST_IN_CLASS_PRESET.minCagr;

  return (
    <div className="space-y-4">
      <StageFunnel rows={rows} />

      <Panel
        title="Screening"
        description={`${BEST_IN_CLASS_THRESHOLDS.minYearsOfExperience}+ years underwriting, ${formatPercent(BEST_IN_CLASS_THRESHOLDS.minEbitdaCagr, 0)}+ EBITDA CAGR and ${formatUsdCompact(BEST_IN_CLASS_THRESHOLDS.minLatestEbitdaUsd)}+ trailing EBITDA is the stated thesis. ${bestInClassCount} of ${activeCount} live targets clear all three.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setFilters(
                  presetActive
                    ? { ...UNFILTERED, includeProjections: filters.includeProjections }
                    : {
                        ...BEST_IN_CLASS_PRESET,
                        includeProjections: filters.includeProjections,
                      },
                )
              }
              className={clsx(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                presetActive
                  ? "bg-gold-500 text-white hover:bg-gold-600"
                  : "border border-gold-300 bg-gold-50 text-gold-800 hover:bg-gold-100",
              )}
            >
              {presetActive ? "Best in class: on" : "Apply Best in Class"}
            </button>
            <button
              type="button"
              onClick={() =>
                setFilters({
                  ...UNFILTERED,
                  includeProjections: filters.includeProjections,
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Clear filters
            </button>
          </div>
        }
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-4">
            <RangeControl
              label="Minimum years of experience"
              value={filters.minYears}
              min={0}
              max={40}
              step={1}
              display={`${filters.minYears} yrs`}
              onChange={(minYears) =>
                setFilters((current) => ({ ...current, minYears }))
              }
            />
            <RangeControl
              label="Minimum EBITDA CAGR"
              value={filters.minCagr}
              min={0}
              max={0.4}
              step={0.01}
              display={formatPercent(filters.minCagr, 0)}
              onChange={(minCagr) =>
                setFilters((current) => ({ ...current, minCagr }))
              }
            />
            <RangeControl
              label="Minimum trailing EBITDA"
              value={filters.minEbitdaMillions}
              min={0}
              max={10}
              step={0.5}
              display={`$${filters.minEbitdaMillions.toFixed(1)}M`}
              onChange={(minEbitdaMillions) =>
                setFilters((current) => ({ ...current, minEbitdaMillions }))
              }
            />
          </div>

          <CheckboxGroup
            label="Geographic region"
            options={regions}
            selected={filters.regions}
            onToggle={(region) =>
              setFilters((current) => ({
                ...current,
                regions: toggleIn(current.regions, region),
              }))
            }
          />

          <CheckboxGroup
            label="Line of business"
            options={linesOfBusiness}
            selected={filters.linesOfBusiness}
            onToggle={(line) =>
              setFilters((current) => ({
                ...current,
                linesOfBusiness: toggleIn(current.linesOfBusiness, line),
              }))
            }
          />

          <div className="space-y-4">
            <CheckboxGroup
              label="Deal stage"
              options={PIPELINE_STAGE_ORDER}
              labelFor={(stage) => DEAL_STAGE_LABEL[stage as DealStage]}
              selected={filters.stages}
              onToggle={(stage) =>
                setFilters((current) => ({
                  ...current,
                  stages: toggleIn(current.stages, stage as DealStage),
                }))
              }
            />
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <ToggleRow
                label="Include FY26 management projections"
                hint="Off by default, so a target's rank never rests on its own forecast."
                checked={filters.includeProjections}
                onChange={(includeProjections) =>
                  setFilters((current) => ({ ...current, includeProjections }))
                }
              />
              <ToggleRow
                label="Show passed targets"
                hint="Declined deals stay in the system with the reason attached."
                checked={filters.includePassed}
                onChange={(includePassed) =>
                  setFilters((current) => ({ ...current, includePassed }))
                }
              />
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title={`Targets in market (${filtered.length}${filtered.length === rows.length ? "" : ` of ${rows.length}`})`}
        description="Every growth figure is derived from the underlying fiscal-year EBITDA rows, not stored, so a restated year re-ranks this table automatically."
        bodyClassName="p-0"
      >
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState>
              No target matches these filters. Loosen a threshold or clear the
              filters to see the full pipeline.
            </EmptyState>
          </div>
        ) : (
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <SortableTh
                    label={SORT_LABEL.name}
                    active={sortKey === "name"}
                    asc={sortAsc}
                    onClick={() => toggleSort("name")}
                  />
                  <Th>Stage</Th>
                  <SortableTh
                    label="Yrs"
                    active={sortKey === "experience"}
                    asc={sortAsc}
                    align="right"
                    onClick={() => toggleSort("experience")}
                  />
                  <SortableTh
                    label="EBITDA CAGR"
                    active={sortKey === "cagr"}
                    asc={sortAsc}
                    align="right"
                    onClick={() => toggleSort("cagr")}
                  />
                  <SortableTh
                    label="Trailing EBITDA"
                    active={sortKey === "ebitda"}
                    asc={sortAsc}
                    align="right"
                    onClick={() => toggleSort("ebitda")}
                  />
                  <SortableTh
                    label="Premium"
                    active={sortKey === "premium"}
                    asc={sortAsc}
                    align="right"
                    onClick={() => toggleSort("premium")}
                  />
                  <SortableTh
                    label="Ask"
                    active={sortKey === "multiple"}
                    asc={sortAsc}
                    align="right"
                    onClick={() => toggleSort("multiple")}
                  />
                  <Th>Lines of business</Th>
                  <Th>Regions</Th>
                  <SortableTh
                    label="Thesis fit"
                    active={sortKey === "score"}
                    asc={sortAsc}
                    align="right"
                    onClick={() => toggleSort("score")}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className={clsx(
                      "hover:bg-slate-50",
                      row.stage === "PASSED" && "opacity-60",
                    )}
                  >
                    <Td>
                      <div className="flex flex-col gap-1">
                        <MgaLink slug={row.slug} name={row.name} />
                        <span className="text-xs text-slate-500">
                          {row.principalName} · {row.headquartersCity},{" "}
                          {row.headquartersState}
                        </span>
                        <span>
                          <BestInClassBadge result={row.bestInClass} />
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <StageBadge stage={row.stage} />
                      {row.dealLead && (
                        <span className="mt-1 block text-[11px] text-slate-500">
                          {row.dealLead}
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      <span
                        className={clsx(
                          "font-medium tabular",
                          row.bestInClass.meetsExperience
                            ? "text-slate-900"
                            : "text-rose-600",
                        )}
                      >
                        {row.yearsOfExperience}
                      </span>
                    </Td>
                    <Td align="right">
                      <span
                        className={clsx(
                          "font-semibold tabular",
                          row.bestInClass.meetsGrowth
                            ? "text-emerald-700"
                            : "text-rose-600",
                        )}
                      >
                        {formatSignedPercent(row.trend.ebitdaCagr)}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">
                        FY{row.trend.firstYear}–{row.trend.latestYear}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-medium tabular text-slate-900">
                        {formatUsdCompact(row.trend.latestEbitdaUsd)}
                      </span>
                      <div className="mt-1 w-24">
                        <MiniBar
                          value={row.trend.latestEbitdaUsd ?? 0}
                          max={maxEbitda}
                          tone={
                            row.bestInClass.isBestInClass ? "gold" : "navy"
                          }
                        />
                      </div>
                    </Td>
                    <Td align="right" className="tabular">
                      {formatUsdCompact(row.programPremiumUsd)}
                    </Td>
                    <Td align="right" className="tabular">
                      {formatMultiple(row.ebitdaMultiple)}
                    </Td>
                    <Td>
                      <div className="flex max-w-56 flex-wrap gap-1">
                        {row.linesOfBusiness.map((line) => (
                          <Badge key={line} tone="outline">
                            {line}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex max-w-44 flex-wrap gap-1">
                        {row.geographicRegions.map((region) => (
                          <Badge key={region} tone="slate">
                            {region}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                    <Td align="right">
                      <span className="text-base font-semibold tabular text-navy-800">
                        {formatNumber(row.bestInClass.score)}
                      </span>
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

function StageFunnel({
  rows,
}: {
  rows: (MgaSummary & { bestInClass: { isBestInClass: boolean } })[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {PIPELINE_STAGE_ORDER.map((stage) => {
        const inStage = rows.filter((row) => row.stage === stage);
        const ebitda = inStage.reduce(
          (sum, row) => sum + (row.trend.latestEbitdaUsd ?? 0),
          0,
        );
        const qualifying = inStage.filter(
          (row) => row.bestInClass.isBestInClass,
        ).length;

        return (
          <div
            key={stage}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {DEAL_STAGE_LABEL[stage]}
              </p>
              <span className="text-lg font-semibold tabular text-slate-900">
                {inStage.length}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {formatUsdCompact(ebitda)} combined EBITDA
            </p>
            <p className="mt-1 text-xs">
              {qualifying > 0 ? (
                <span className="font-medium text-gold-700">
                  {qualifying} best in class
                </span>
              ) : (
                <span className="text-slate-400">None clear all criteria</span>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className="text-xs font-semibold tabular text-navy-700">
          {display}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-navy-600"
      />
    </label>
  );
}

function CheckboxGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
  labelFor,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onToggle: (value: T) => void;
  labelFor?: (value: T) => string;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-slate-600">
        {label}
        {selected.length > 0 && (
          <span className="ml-1 text-navy-700">({selected.length})</span>
        )}
      </legend>
      <div className="thin-scroll mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-2 text-xs text-slate-700"
          >
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onToggle(option)}
              className="size-3.5 rounded border-slate-300 accent-navy-600"
            />
            {labelFor ? labelFor(option) : option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-3.5 rounded border-slate-300 accent-navy-600"
      />
      <span>
        <span className="block text-xs font-medium text-slate-700">{label}</span>
        {hint && (
          <span className="block text-[11px] leading-snug text-slate-500">
            {hint}
          </span>
        )}
      </span>
    </label>
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
