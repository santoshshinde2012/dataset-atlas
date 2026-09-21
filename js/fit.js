/** Conservative, explainable checks over reviewed pilot metadata. */
export function assessFit(dataset, profile, task) {
  const reasons = [];
  const overlapStart = Math.max(dataset.coverageStart, task.startYear);
  const overlapEnd = Math.min(dataset.coverageEnd, task.endYear);
  if (overlapStart > overlapEnd) reasons.push({ status: 'conflict', text: 'No year overlap' });
  else reasons.push({ status: 'match', text: `Year overlap: ${overlapStart}–${overlapEnd}` });
  if (!profile.countries.length) reasons.push({ status: 'unknown', text: 'Country coverage must be checked in the source' });
  else if (profile.countries.includes(task.country)) reasons.push({ status: 'match', text: 'Requested country covered' });
  else reasons.push({ status: 'conflict', text: 'Requested country is outside documented coverage' });
  if (profile.level === task.level) reasons.push({ status: 'match', text: `Geography: ${task.level}` });
  else reasons.push({ status: 'conflict', text: `Source is ${profile.level} level; requested ${task.level}. Aggregation or a documented crosswalk is needed` });
  const variables = task.variables.filter((v) => profile.variables.includes(v));
  reasons.push(variables.length
    ? { status: 'match', text: `Relevant variable${variables.length > 1 ? 's' : ''}: ${variables.join(', ')}` }
    : { status: 'unknown', text: 'No exact requested variable documented' });
  const conflicts = reasons.filter((r) => r.status === 'conflict').length;
  return { status: conflicts ? 'conflict' : reasons.some((r) => r.status === 'unknown') ? 'review' : 'match', reasons };
}

export function assessJoin(a, b, aDataset, bDataset) {
  const notes = [];
  const pairUrls = new Set([a.url, b.url]);
  const verifiedPilotPair = pairUrls.has('https://github.com/owid/energy-data')
    && pairUrls.has('https://github.com/owid/co2-data');
  const start = Math.max(aDataset.coverageStart, bDataset.coverageStart);
  const end = Math.min(aDataset.coverageEnd, bDataset.coverageEnd);
  if (start > end) notes.push({ status: 'conflict', text: 'No overlapping years' });
  else notes.push({ status: 'match', text: `Overlapping years: ${start}–${end}` });
  if (a.level !== b.level) notes.push({ status: 'conflict', text: `Geographic levels differ (${a.level} / ${b.level}); aggregate or use a verified crosswalk` });
  else notes.push({ status: 'match', text: `Both use ${a.level} geography` });
  if (a.time !== b.time) notes.push({ status: 'conflict', text: `Time grains differ (${a.time} / ${b.time}); align dates before joining` });
  else notes.push({ status: 'match', text: `Both use ${a.time} time grain` });
  const shared = a.joinKeys.filter((key) => b.joinKeys.includes(key));
  notes.push(shared.length ? { status: 'match', text: `Shared named keys: ${shared.join(', ')}` } : { status: 'unknown', text: 'No shared named join keys; inspect source schemas or map identifiers' });
  if (!verifiedPilotPair) notes.push({ status: 'unknown', text: 'Key values, units and one-to-one cardinality have not been verified for this pair' });
  if (!verifiedPilotPair && (!a.countries.length || !b.countries.length)) notes.push({ status: 'unknown', text: 'Country overlap is not documented for both sources' });
  if (a.countries.length && b.countries.length && !a.countries.some((c) => b.countries.includes(c))) notes.push({ status: 'conflict', text: 'Documented country coverage does not overlap' });
  if (verifiedPilotPair) notes.push({ status: 'match', text: 'Verified pilot pair: filter ISO country rows, then join on iso_code and year; preserve metric units' });
  return { status: notes.some((n) => n.status === 'conflict') ? 'conflict' : notes.some((n) => n.status === 'unknown') ? 'review' : 'match', notes };
}

export function projectReport(task, selections, pair) {
  const lines = [`# Dataset Atlas project brief`, '', `Task: ${task.title}`, `Requirements: ${task.country}, ${task.startYear}–${task.endYear}, ${task.level} level; ${task.variables.join(', ')}`, '', '## Sources', ''];
  for (const { dataset, profile } of selections) {
    const fit = assessFit(dataset, profile, task);
    lines.push(`### ${dataset.title}`, `Landing page: ${dataset.url}`, `Resource: ${profile.resource?.url || 'No verified direct resource; use landing page'}`, `Access: ${profile.access}`, `Evidence: ${profile.evidence}`, `Catalog license: ${dataset.license} (confirm at source)`, `Fit: ${fit.status}`, ...fit.reasons.map((r) => `- ${r.status}: ${r.text}`), '');
  }
  if (pair) {
    const [a, b] = pair;
    const join = assessJoin(a.profile, b.profile, a.dataset, b.dataset);
    lines.push('## Pair compatibility', `${a.dataset.title} + ${b.dataset.title}: ${join.status}`, ...join.notes.map((n) => `- ${n.status}: ${n.text}`), '');
  }
  lines.push('## Caveat', 'Coverage, schema, access and licensing may change. Confirm at the linked source before analysis. A match is a screening result, not proof of a valid statistical comparison.');
  return lines.join('\n');
}
