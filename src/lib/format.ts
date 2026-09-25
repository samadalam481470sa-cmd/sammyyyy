/**
 * Presentation helpers for financial figures. Kept separate from data/UI
 * logic so formatting rules can evolve independently.
 */

/** Compact USD formatting for executive display, e.g. 184_000_000 -> "$184.0M". */
export function formatUsdCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const decimals = millions >= 100 ? 0 : 1;
    return `${sign}$${millions.toFixed(decimals)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  }
  return `${sign}$${abs.toFixed(0)}`;
}

/** Full USD formatting with thousands separators, e.g. 184_000_000 -> "$184,000,000". */
export function formatUsdFull(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}
