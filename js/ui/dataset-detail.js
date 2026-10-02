import { esc } from '../utils/text.js';
import { profileFor } from '../dataset.js';
import { licenseUse, licenseUseSummary } from '../license-use.js';
import { linkHealth } from '../link-health.js';
import { bibtexFor } from '../citation.js';
import { trapModalFocus } from './focus-trap.js';

export function initDatasetDetail({ store, pilot, generated, copyText, onProject, onExplore }) {
  const dialog = document.getElementById('dataset-detail');
  const body = document.getElementById('dataset-detail-body');
  let opener;
  const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
  dialog.querySelector('.dialog-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { if (opener?.isConnected) opener.focus(); });
  dialog.addEventListener('keydown', (e) => trapModalFocus(dialog, e));
  return { open(id) {
    const d = store.select.catalog().find((entry) => entry.id === id);
    if (!d) return;
    opener = document.activeElement;
    const profile = profileFor(d, pilot.profiles);
    const reviewed = pilot.profiles.some((p) => p.url === d.url);
    const health = linkHealth(d, generated);
    const country = store.getState().country || store.getState().focusCountry;
    const observed = country && store.select.observation(d, country);
    const sample = d.sample || profile.preview;
    const resources = d.resources || [];
    body.innerHTML = `<h2 id="detail-title">${esc(d.title)}</h2><p>${esc(d.description)}</p>
      <p>${link(d.landingPage || d.url, 'Provider source page')} · ${esc(d.source)}</p>
      <dl class="detail-meta"><dt>Coverage</dt><dd>${d.coverageStart}–${d.coverageEnd}${observed && observed !== 'absent' ? ` · ${esc(country)} observed rows ${observed.start}–${observed.end}` : observed === 'absent' ? ` · No observed rows for ${esc(country)}` : ''}</dd>
      <dt>Geography / time</dt><dd>${esc(profile.level)} / ${esc(profile.time)}</dd>
      <dt>Variables</dt><dd>${esc(profile.variables.join(', ') || 'Not documented')}</dd>
      <dt>Units</dt><dd>${esc(profile.unit || 'Not documented')}</dd>
      <dt>Join keys</dt><dd>${esc(profile.joinKeys.join(', ') || 'Not documented')}</dd>
      <dt>Access</dt><dd>${esc(profile.access)}</dd>
      <dt>License</dt><dd>${d.licenseUrl ? link(d.licenseUrl, d.license) : esc(d.license)}<br>${esc(licenseUseSummary(licenseUse(d)))}</dd>
      <dt>Evidence</dt><dd>${link(profile.evidence, 'Source evidence')} ${reviewed ? `· Pilot reviewed ${esc(pilot.reviewed || 'date unknown')}` : '· No reviewed pilot profile'}</dd>
      <dt>Link health</dt><dd>${esc(health.label)}. ${esc(health.title)}</dd></dl>
      <h3>Choose a resource</h3>${resources.length ? `<label>Distribution <select id="detail-resource">${resources.map((r, i) => `<option value="${i}" ${store.getState().resourceSelections[d.id] === r.url ? 'selected' : ''}>${esc(r.label)} · ${esc(r.kind)} · ${esc(r.format)}</option>`).join('')}</select></label><p id="detail-resource-link"></p>` : '<p>No checked direct resource. Use the provider source page.</p>'}
      <h3>Schema and sample</h3><p>${esc((profile.columns || sample?.columns || []).join(' · ') || 'Schema not documented')}</p>
      ${sample ? `<p>Static sample, not a live extract.</p><div class="table-scroll"><table><thead><tr>${sample.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${sample.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p>No reviewed sample rows.</p>'}
      <div class="feature-actions"><button id="detail-project" class="primary">Add to project</button><button id="detail-cite">Copy citation</button><button id="detail-explore">Explore a local file</button></div>`;
    const select = body.querySelector('#detail-resource');
    if (select) {
      const update = () => { const r = resources[Number(select.value)]; store.actions.selectResource(d.id, r.url); body.querySelector('#detail-resource-link').innerHTML = link(r.url, r.kind === 'download' ? 'Download selected file' : r.kind === 'api' ? 'Open selected API' : 'Open resource page'); };
      select.onchange = update; update();
    }
    body.querySelector('#detail-cite').onclick = () => copyText(bibtexFor(d, new Date().toISOString().slice(0, 10)), 'Citation copied');
    body.querySelector('#detail-project').onclick = () => { dialog.close(); onProject(d.id); };
    body.querySelector('#detail-explore').onclick = () => { dialog.close(); onExplore(); };
    dialog.showModal();
  } };
}
