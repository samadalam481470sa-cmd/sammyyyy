/**
 * Writes public/database/newport-crm.json from the live seed modules.
 * Do not hand-edit that file. Run:
 *   npx tsx --tsconfig tsconfig.app.json scripts/write-portable-seed.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundledSeedSnapshot } from '../src/lib/portableDatabase.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outPath = path.join(root, 'public/database/newport-crm.json')
mkdirSync(path.dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(bundledSeedSnapshot(), null, 2)}\n`)
console.log(`Wrote ${path.relative(root, outPath)}`)
