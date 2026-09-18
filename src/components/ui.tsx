/**
 * Presentational primitives shared by every screen.
 *
 * Small and deliberately unopinionated: the point is that a panel, a stat tile
 * or a tag chip looks the same everywhere, so a reviewer can tell at a glance
 * that two numbers on two different screens mean the same thing.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import { clsx } from "clsx";

import { formatSignedPercent } from "@/lib/format";

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={clsx(
        "rounded-xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      {(title || actions || description) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      <div className={clsx("px-5 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  sublabel,
  delta,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  delta?: number | null;
  tone?: "default" | "brand" | "gold";
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border p-4",
        tone === "brand" && "border-navy-800 bg-navy-900 text-white",
        tone === "gold" && "border-gold-200 bg-gold-50",
        tone === "default" && "border-slate-200 bg-white",
      )}
    >
      <p
        className={clsx(
          "text-[11px] font-medium uppercase tracking-wider",
          tone === "brand" ? "text-navy-200" : "text-slate-500",
        )}
      >
        {label}
      </p>
      <p
        className={clsx(
          "mt-2 text-2xl font-semibold tracking-tight tabular",
          tone === "brand" ? "text-white" : "text-slate-900",
        )}
      >
        {value}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        {delta !== undefined && delta !== null && (
          <DeltaPill value={delta} onDark={tone === "brand"} />
        )}
        {sublabel && (
          <span
            className={clsx(
              "text-xs",
              tone === "brand" ? "text-navy-200" : "text-slate-500",
            )}
          >
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

export function DeltaPill({
  value,
  onDark = false,
}: {
  value: number | null;
  onDark?: boolean;
}) {
  if (value === null) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const positive = value >= 0;

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular",
        onDark
          ? positive
            ? "bg-emerald-400/20 text-emerald-200"
            : "bg-rose-400/20 text-rose-200"
          : positive
            ? "bg-emerald-50 text-emerald-700"
            : "bg-rose-50 text-rose-700",
      )}
    >
      {formatSignedPercent(value)}
    </span>
  );
}

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: ReactNode;
  tone?: "slate" | "navy" | "gold" | "emerald" | "rose" | "outline";
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        tone === "slate" && "bg-slate-100 text-slate-700",
        tone === "navy" && "bg-navy-100 text-navy-800",
        tone === "gold" && "bg-gold-100 text-gold-800",
        tone === "emerald" && "bg-emerald-50 text-emerald-700",
        tone === "rose" && "bg-rose-50 text-rose-700",
        tone === "outline" && "border border-slate-300 text-slate-600",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A line-of-business / coverage / region tag.
 *
 * `shared` is the whole point of the portfolio screen: a gold chip means at
 * least one other acquired MGA carries the same tag, a plain chip means this
 * capability sits in exactly one MGA today.
 */
export function TagChip({
  label,
  shared = false,
  count,
  title,
}: {
  label: string;
  shared?: boolean;
  count?: number;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        shared
          ? "border-gold-300 bg-gold-50 text-gold-800"
          : "border-slate-200 bg-slate-50 text-slate-600",
      )}
    >
      {label}
      {count !== undefined && count > 1 && (
        <span
          className={clsx(
            "rounded px-1 text-[10px] font-bold tabular",
            shared ? "bg-gold-200 text-gold-900" : "bg-slate-200 text-slate-700",
          )}
        >
          {count}
        </span>
      )}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-600">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export function MgaLink({
  slug,
  name,
  className,
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  return (
    <Link
      href={`/mgas/${slug}`}
      className={clsx(
        "font-medium text-navy-700 underline-offset-2 hover:text-navy-500 hover:underline",
        className,
      )}
    >
      {name}
    </Link>
  );
}

/** A compact horizontal bar used inside table cells to show relative scale. */
export function MiniBar({
  value,
  max,
  tone = "navy",
}: {
  value: number;
  max: number;
  tone?: "navy" | "gold" | "emerald";
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={clsx(
          "h-full rounded-full",
          tone === "navy" && "bg-navy-500",
          tone === "gold" && "bg-gold-400",
          tone === "emerald" && "bg-emerald-500",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Th({
  children,
  className,
  align = "left",
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      {...rest}
      className={clsx(
        "whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      {...rest}
      className={clsx(
        "px-3 py-2.5 text-sm text-slate-700",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}
