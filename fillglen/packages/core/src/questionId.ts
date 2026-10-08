import { normalize } from "./fuzzy.js";

export function stableQuestionId(input: {
  label: string;
  name?: string;
  position: number;
  frameId?: string;
}): string {
  const parts = [
    input.frameId || "top",
    normalize(input.label).slice(0, 80) || "unlabeled",
    normalize(input.name || "").slice(0, 40) || "noname",
    String(input.position),
  ];
  return parts.join("|");
}

export function diffQuestions(
  prev: { id: string; value: string; status: string }[],
  next: { id: string; value: string; status: string }[]
): { added: string[]; removed: string[]; changed: string[] } {
  const p = new Map(prev.map((q) => [q.id, q]));
  const n = new Map(next.map((q) => [q.id, q]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const id of n.keys()) {
    if (!p.has(id)) added.push(id);
    else if (p.get(id)!.value !== n.get(id)!.value || p.get(id)!.status !== n.get(id)!.status) changed.push(id);
  }
  for (const id of p.keys()) if (!n.has(id)) removed.push(id);
  return { added, removed, changed };
}
