/**
 * Data Passport manifest generation (concept D). Pure function over a list
 * of pinned datasets; output is a runnable shell script, so all interpolated
 * catalog strings are comment-hardened and kaggleRef is only ever included
 * after the catalog sanitizer's whitelist check (see catalog.js).
 */
import { oneLine } from './utils/text.js';

export function manifestText(list) {
  const lines = [
    '#!/usr/bin/env bash',
    '# ════════════════════════════════════════════════════',
    '#  The Dataset Atlas — Data Passport',
    `#  ${list.length} dataset${list.length === 1 ? '' : 's'} · re-run this script to reproduce the downloads`,
    '# ════════════════════════════════════════════════════',
    '',
  ];
  const kaggle = list.filter((d) => d.kaggleRef);
  const direct = list.filter((d) => !d.kaggleRef);
  if (direct.length) {
    lines.push('# ── Direct sources — open in a browser, or curl where the URL is a file ──');
    direct.forEach((d, i) => {
      lines.push(`#  ${i + 1}. ${oneLine(d.title)} — ${oneLine(d.source)} [${oneLine(d.license)}]`);
      lines.push(`#     ${oneLine(d.url)}`);
    });
    lines.push('');
  }
  if (kaggle.length) {
    lines.push('# ── Kaggle datasets — needs `pip install kaggle` + API token (kaggle.com/docs/api) ──');
    for (const d of kaggle) lines.push(`kaggle datasets download -d ${d.kaggleRef}   # ${oneLine(d.title)}`);
    lines.push('');
    lines.push('# Python alternative:');
    for (const d of kaggle) lines.push(`#   import kagglehub; kagglehub.dataset_download("${d.kaggleRef}")`);
  }
  return lines.join('\n') + '\n';
}
