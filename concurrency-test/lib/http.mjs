import { performance } from 'node:perf_hooks'

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) out[key] = true
      else {
        out[key] = next
        i++
      }
    } else out._.push(a)
  }
  return out
}

export async function fetchText(url, { method = 'GET', headers = {}, body, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  const started = performance.now()
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'user-agent': 'TheNetTicket-concurrency-test/1.0',
        accept: 'text/html,application/json,*/*',
        ...headers,
      },
      body,
      signal: ctrl.signal,
      redirect: 'follow',
    })
    const text = await res.text()
    return {
      ok: res.ok,
      status: res.status,
      url: res.url,
      text,
      ms: performance.now() - started,
      headers: res.headers,
    }
  } finally {
    clearTimeout(t)
  }
}

export async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length)
  let next = 0
  async function run() {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
    }
  }
  const n = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: n }, () => run()))
  return results
}

export function percentile(sorted, p) {
  if (!sorted.length) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[idx]
}

export function summarizeLatencies(samplesMs) {
  const sorted = [...samplesMs].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  return {
    count: sorted.length,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    mean: sorted.length ? sum / sorted.length : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  }
}

export function hostOf(url) {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}
