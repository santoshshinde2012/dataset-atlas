/** Reviewed source profiles enrich discovery, never inventing schemas. */
export function withProfiles(catalog, profiles = []) {
  return catalog.map((d) => {
    const reviewedProfiles = profiles.filter((p) => p.url === d.url);
    return { ...d, reviewedProfiles, searchMetadata: reviewedProfiles.flatMap((p) => [
      ...(p.variables || []), ...(p.columns || []), ...(p.joinKeys || []), p.unit || '',
    ]).join(' ') };
  });
}

export function profileFor(dataset, profiles = [], taskId = null) {
  return profiles.find((p) => p.url === dataset.url && (!taskId || p.task === taskId))
    || profiles.find((p) => p.url === dataset.url)
    || { url: dataset.url, countries: dataset.countries || [], level: dataset.granularity || 'unknown',
      time: 'unknown', joinKeys: [], variables: [], access: 'Check access at source', evidence: dataset.landingPage || dataset.url };
}
