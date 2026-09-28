import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function writeReport(outDir, name, { markdown, json }) {
  mkdirSync(outDir, { recursive: true })
  const mdPath = join(outDir, `${name}.md`)
  const jsonPath = join(outDir, `${name}.json`)
  writeFileSync(mdPath, markdown)
  writeFileSync(jsonPath, JSON.stringify(json, null, 2))
  return { mdPath, jsonPath }
}

export function saveArtifact(fromPath, artifactName) {
  try {
    mkdirSync('/opt/cursor/artifacts', { recursive: true })
    const dest = join('/opt/cursor/artifacts', artifactName)
    copyFileSync(fromPath, dest)
    return dest
  } catch {
    return null
  }
}

export function fmtMs(n) {
  return `${Number(n).toFixed(0)}ms`
}
