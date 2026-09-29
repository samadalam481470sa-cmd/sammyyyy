#!/usr/bin/env node
/**
 * Fee regression after the $1.00 → $1.50 platform-fee change (commit 1cdefed).
 * Black-box: homepage, Terms, and the bundled LEGAL.platformFee constant.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchText, parseArgs } from './lib/http.mjs'
import { saveArtifact, writeReport } from './lib/report.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf8'))
const args = parseArgs()
const baseUrl = (args.base || process.env.BASE_URL || config.baseUrl).replace(/\/$/, '')
const feeText = config.expectedPlatformFeeText
const feeCents = config.expectedPlatformFeeCents
const effectiveDate = config.expectedEffectiveDate

const checks = []

function record(id, ok, detail) {
  checks.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}: ${detail}`)
}

const home = await fetchText(`${baseUrl}/`)
record(
  'home-http',
  home.status === 200,
  `GET / → ${home.status} in ${home.ms.toFixed(0)}ms`,
)

const homeFee = home.text.includes(`We take ${feeText} per paid`)
record(
  'home-fee-copy',
  homeFee,
  homeFee
    ? `homepage states "${feeText} per paid ticket"`
    : `homepage missing "${feeText}" fee copy (still $1.00?)`,
)

const terms = await fetchText(`${baseUrl}/legal/terms`)
record('terms-http', terms.status === 200, `GET /legal/terms → ${terms.status}`)

const termsFee =
  terms.text.includes(`Our fee is ${feeText} per paid ticket sold online`) ||
  terms.text.includes(`Our fee is ${feeText} per paid ticket`)
record(
  'terms-fee-copy',
  termsFee,
  termsFee ? `Terms §7 states fee is ${feeText}` : `Terms missing ${feeText} fee clause`,
)

const dateOk =
  terms.text.includes(effectiveDate) ||
  terms.text.includes('September 17, 2026') ||
  terms.text.includes('17 September 2026')
record(
  'terms-effective-date',
  dateOk,
  dateOk ? `effective date mentions ${effectiveDate}` : `effective date ${effectiveDate} not found`,
)

// LEGAL.platformFee is format(150) in the shared legal chunk.
const scriptUrls = [...home.text.matchAll(/(?:href|src)="(\/_nuxt\/[^"]+\.js)"/g)].map((m) => m[1])
const unique = [...new Set(scriptUrls)]
let foundCents = false
let centsEvidence = ''
for (const path of unique) {
  const js = await fetchText(`${baseUrl}${path}`)
  if (!js.ok) continue
  // Matches platformFee:e(150) / platformFee: format(150) style emits from shared/legal.ts
  if (
    js.text.includes(`platformFee`) &&
    (js.text.includes(`(${feeCents})`) ||
      js.text.includes(`platformFee:${feeCents}`) ||
      js.text.includes(`platformFee: ${feeCents}`) ||
      new RegExp(`platformFee[^\\n]{0,40}${feeCents}`).test(js.text))
  ) {
    foundCents = true
    centsEvidence = path
    break
  }
}
record(
  'bundle-platform-fee-cents',
  foundCents,
  foundCents
    ? `LEGAL.platformFee sourced from ${feeCents}¢ in ${centsEvidence}`
    : `could not find platformFee(${feeCents}) in ${unique.length} home scripts`,
)

const oldFee = home.text.includes('We take $1 per paid') && !home.text.includes('We take $1.50')
record(
  'no-stale-dollar-one',
  !oldFee,
  oldFee ? 'homepage still says "$1 per paid ticket"' : 'no stale $1.00 homepage copy',
)

const failed = checks.filter((c) => !c.ok)
const report = {
  target: baseUrl,
  checkedAt: new Date().toISOString(),
  expected: { feeText, feeCents, effectiveDate },
  checks,
  ok: failed.length === 0,
}
const md = [
  `# Fee check — ${baseUrl}`,
  '',
  `Checked: ${report.checkedAt}`,
  `Expected platform fee: **${feeText}** (${feeCents}¢), effective ${effectiveDate}`,
  '',
  `| Check | Result | Detail |`,
  `| --- | --- | --- |`,
  ...checks.map((c) => `| \`${c.id}\` | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail.replace(/\|/g, '\\|')} |`),
  '',
  failed.length ? `**${failed.length} failing check(s).**` : 'All fee-surface checks passed.',
  '',
].join('\n')

const { mdPath, jsonPath } = writeReport(join(__dirname, 'out'), 'fee-check', {
  markdown: md,
  json: report,
})
saveArtifact(mdPath, 'fee-check.md')
saveArtifact(jsonPath, 'fee-check.json')
console.log(`\nWrote ${mdPath}`)
process.exit(failed.length ? 1 : 0)
