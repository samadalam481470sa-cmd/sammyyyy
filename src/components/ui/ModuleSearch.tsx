import { Search, X } from 'lucide-react';

interface ModuleSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function ModuleSearch({ value, onChange, placeholder }: ModuleSearchProps) {
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-navy-900 placeholder:text-slate-400 focus:border-accent-400 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
