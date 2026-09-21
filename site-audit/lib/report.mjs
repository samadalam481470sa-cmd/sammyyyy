import { SEVERITY_ORDER } from './findings.mjs';

const LABELS = { high: 'High', medium: 'Medium', low: 'Low', info: 'Info' };

export function toMarkdown({ baseUrl, startedAt, findings, pageResults, offlineResults }) {
  const counts = findings.counts;
  const lines = [
    '# Live site audit',
    '',
    `Target: ${baseUrl}`,
    `Run: ${startedAt}`,
    `Findings: ${SEVERITY_ORDER.filter((s) => counts[s]).map((s) => `${counts[s]} ${LABELS[s].toLowerCase()}`).join(', ') || 'none'}`,
    '',
  ];

  for (const severity of SEVERITY_ORDER) {
    const items = findings.bySeverity(severity);
    if (!items.length) continue;
    lines.push(`## ${LABELS[severity]}`, '');
    for (const item of items) {
      lines.push(`### ${item.title}`, '');
      lines.push(`- Where: ${item.where}`);
      lines.push(`- Evidence: ${item.evidence}`);
      lines.push(`- Fix: ${item.fix}`);
      lines.push(`- Check id: \`${item.id}\``, '');
    }
  }

  lines.push('## Routes checked', '');
  lines.push('| Route | HTTP | Ends at | Title | lang | description | og | manifest |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const page of pageResults) {
    lines.push(
      `| \`${page.path}\` | ${page.status ?? '—'} | \`${page.finalUrl}\` | ${page.head.title || '—'} | ${
        page.head.lang || 'missing'
      } | ${page.head.description ? 'yes' : 'missing'} | ${page.head.ogTags.length ? 'yes' : 'missing'} | ${
        page.head.manifest ? 'yes' : 'missing'
      } |`
    );
  }
  lines.push('');

  if (offlineResults.length) {
    lines.push('## Offline behaviour', '');
    for (const result of offlineResults) {
      lines.push(
        `- \`${result.path}\`: service worker ${result.worker.controller ? 'controlling' : 'not controlling'}; ` +
          `reload with network off → ${result.offlineError ? `\`${result.offlineError}\`` : `HTTP ${result.offlineStatus}`}`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function printSummary({ baseUrl, findings }) {
  const counts = findings.counts;
  console.log('');
  console.log(`Audit of ${baseUrl}`);
  for (const severity of SEVERITY_ORDER) {
    if (!counts[severity]) continue;
    console.log(`\n${LABELS[severity].toUpperCase()} (${counts[severity]})`);
    for (const item of findings.bySeverity(severity)) {
      console.log(`  - [${item.id}] ${item.title}`);
      console.log(`      where: ${item.where}`);
      console.log(`      evidence: ${item.evidence}`);
    }
  }
  console.log('');
}
