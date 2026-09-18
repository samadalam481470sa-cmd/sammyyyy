import type { SynergyGroup } from "@/lib/synergies";
import { dimensionLabel } from "@/lib/synergies";

export default function SynergyList({ groups }: { groups: SynergyGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No overlapping attributes across the acquired portfolio yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {groups.map((g) => (
        <li
          key={`${g.dimension}-${g.value}`}
          className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
        >
          <div>
            <p className="text-sm font-medium text-slate-800">
              {g.value}
              <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {dimensionLabel(g.dimension)}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{g.mgaNames.join(" · ")}</p>
          </div>
          <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
            {g.mgaIds.length} MGAs
          </span>
        </li>
      ))}
    </ul>
  );
}
