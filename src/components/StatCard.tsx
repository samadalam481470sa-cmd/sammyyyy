import clsx from "clsx";

export default function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "brand";
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={clsx(
          "mt-1.5 text-2xl font-semibold tracking-tight",
          tone === "positive" && "text-accent-600",
          tone === "brand" && "text-brand-700",
          tone === "default" && "text-slate-900",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
