export const SEVERITY_ORDER = ['high', 'medium', 'low', 'info'];

export class FindingList {
  constructor() {
    this.items = [];
  }

  /**
   * A finding is one defect, however many routes it shows up on. Repeat reports of the
   * same id widen its `where` instead of adding another entry to read past.
   */
  add({ id, severity, title, where, evidence, fix }) {
    const existing = this.items.find((item) => item.id === id);
    if (existing) {
      const seen = existing.where.split(', ');
      if (where && !seen.includes(where)) existing.where = [...seen, where].join(', ');
      return;
    }
    this.items.push({ id, severity, title, where, evidence, fix });
  }

  bySeverity(severity) {
    return this.items.filter((f) => f.severity === severity);
  }

  get counts() {
    return SEVERITY_ORDER.reduce((acc, s) => ({ ...acc, [s]: this.bySeverity(s).length }), {});
  }

  sorted() {
    return [...this.items].sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.id.localeCompare(b.id)
    );
  }
}

export function truncate(value, max = 400) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
