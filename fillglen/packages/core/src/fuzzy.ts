export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokens(text: string): string[] {
  return normalize(text).split(/\s+/).filter((t) => t.length > 1);
}

export function tokenSetRatio(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (A.size === 0 || B.size === 0) return 0;
  let overlap = 0;
  for (const t of A) if (B.has(t)) overlap += 1;
  return (2 * overlap) / (A.size + B.size);
}

export function includesNormalized(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle));
}

export function bestSavedMatch(
  question: string,
  answers: { pattern: string; answer: string }[],
  min = 0.55
): { pattern: string; answer: string; score: number } | null {
  let best: { pattern: string; answer: string; score: number } | null = null;
  const q = normalize(question);
  for (const item of answers) {
    const pattern = normalize(item.pattern);
    if (!pattern) continue;
    const ratio = tokenSetRatio(question, item.pattern);
    // Containment only when the pattern is specific enough to avoid wrong-field hits.
    const contained =
      pattern.length >= 6 && (` ${q} `.includes(` ${pattern} `) || q.includes(pattern)) ? 0.92 : 0;
    const score = Math.max(ratio, contained);
    if (score >= min && (!best || score > best.score)) best = { ...item, score };
  }
  return best;
}
