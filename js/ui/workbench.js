import { assessFit, assessJoin, projectReport } from '../fit.js';
import { kitsForTask } from '../kits.js';
import { esc } from '../utils/text.js';
import { trapModalFocus } from './focus-trap.js';

const status = (value) => `<strong class="fit-${value}">${value}</strong>`;
const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;

export function initWorkbench({ catalog, pilot, toast }) {
  const dialog = document.getElementById('workbench');
  const body = document.getElementById('workbench-body');
  const button = document.getElementById('workbench-btn');
  let task = { ...pilot.tasks[0] };
  let shown = [];
  const close = () => dialog.close();

  function render() {
    shown = pilot.profiles.filter((p) => p.task === task.id).map((profile) => ({ profile, dataset: catalog.find((d) => d.url === profile.url) })).filter((x) => x.dataset);
    const kits = kitsForTask(task.id);
    const kitLinks = kits.map((kit) => kit.notebook
      ? ` <a href="${esc(kit.notebook)}" download>Download ${esc(kit.label)} notebook</a>`
      : '').join('');
    body.innerHTML = `
      <p>Screen reviewed pilot sources against a research question. Results show evidence and remaining checks; previews are source samples, not live data. A <b>match</b> requires documented overlap — key names alone are never enough.</p>
      ${kits.length ? `<p class="workbench-note">Kit: ${kits.map((k) => `${esc(k.label)} (${esc(k.status)})`).join(' · ')}</p>` : ''}
      <label>Research task <select id="workbench-task">${pilot.tasks.map((t) => `<option value="${esc(t.id)}" ${t.id === task.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></label>
      <div class="workbench-inputs"><label>Country ISO-2 <input id="fit-country" maxlength="2" pattern="[A-Za-z]{2}" value="${esc(task.country)}"></label><label>From year <input id="fit-start" type="number" min="1800" max="2100" value="${task.startYear}"></label><label>To year <input id="fit-end" type="number" min="1800" max="2100" value="${task.endYear}"></label><label>Geographic level <select id="fit-level">${['country','state','district','county','subdivision','point'].map((level) => `<option value="${level}" ${level === task.level ? 'selected' : ''}>${level}</option>`).join('')}</select></label></div>
      <p>${esc(task.description)} <b>Target:</b> ${esc(task.country)}, ${task.startYear}–${task.endYear}, ${esc(task.level)}; ${esc(task.variables.join(', '))}.</p>
      <div class="workbench-grid">${shown.map(({ dataset, profile }, i) => {
        const fit = assessFit(dataset, profile, task);
        return `<article class="workbench-card"><h3>${esc(dataset.title)}</h3><p>${status(fit.status)} · ${esc(profile.level)} · ${esc(profile.time)}</p>
          <ul>${fit.reasons.map((r) => `<li>${status(r.status)} ${esc(r.text)}</li>`).join('')}</ul>
          <p><b>Variables:</b> ${esc(profile.variables.join(', '))}<br><b>Keys:</b> ${esc(profile.joinKeys.join(', '))}</p>
          <p><b>Access:</b> ${esc(profile.access)}</p>
          <p>${link(dataset.url, 'Source page')} · ${link(profile.evidence, 'Evidence')}${profile.resource ? ` · ${link(profile.resource.url, profile.resource.label)}` : ''}</p>
          ${profile.columns ? `<details><summary>Verified columns${profile.preview ? ' and sample' : ''}</summary><p>${esc(profile.columns.join(' · '))}</p>${profile.preview ? `<pre>${esc(profile.preview.rows.map((row) => row.join(' | ')).join('\n'))}</pre><small>Static sample from ${link(profile.preview.source, 'source CSV')}</small>` : '<p>No verified sample rows available.</p>'}</details>` : '<p class="workbench-note">Schema preview unavailable; inspect source.</p>'}
          <label><input type="checkbox" class="workbench-select" value="${i}" checked> Include in project brief</label></article>`;
      }).join('')}</div>
      <section class="workbench-join"><h3>Pair compatibility</h3><label>First source <select id="join-a">${shown.map((x, i) => `<option value="${i}">${esc(x.dataset.title)}</option>`).join('')}</select></label><label>Second source <select id="join-b">${shown.map((x, i) => `<option value="${i}" ${i === 1 ? 'selected' : ''}>${esc(x.dataset.title)}</option>`).join('')}</select></label><div id="join-result"></div></section>
      <button id="workbench-export" class="primary">Export project brief (.md)</button>${kitLinks}`;
    body.querySelector('#workbench-task').onchange = (e) => { task = { ...pilot.tasks.find((t) => t.id === e.target.value) }; render(); };
    for (const id of ['fit-country', 'fit-start', 'fit-end', 'fit-level']) body.querySelector(`#${id}`).onchange = () => {
      const country = body.querySelector('#fit-country').value.toUpperCase().trim();
      const startYear = Number(body.querySelector('#fit-start').value);
      const endYear = Number(body.querySelector('#fit-end').value);
      if (!/^[A-Z]{2}$/.test(country) || startYear < 1800 || endYear > 2100 || startYear > endYear) { toast('Enter a two-letter country and a valid year range'); return; }
      task = { ...task, country, startYear, endYear, level: body.querySelector('#fit-level').value };
      render();
    };
    const updateJoin = () => {
      const a = shown[Number(body.querySelector('#join-a').value)];
      const b = shown[Number(body.querySelector('#join-b').value)];
      const target = body.querySelector('#join-result');
      if (a === b) { target.textContent = 'Choose two different sources.'; return; }
      const result = assessJoin(a.profile, b.profile, a.dataset, b.dataset);
      target.innerHTML = `<p>${status(result.status)}</p><ul>${result.notes.map((n) => `<li>${status(n.status)} ${esc(n.text)}</li>`).join('')}</ul>`;
    };
    body.querySelector('#join-a').onchange = updateJoin;
    body.querySelector('#join-b').onchange = updateJoin;
    updateJoin();
    body.querySelector('#workbench-export').onclick = () => {
      const selected = [...body.querySelectorAll('.workbench-select:checked')].map((input) => shown[Number(input.value)]);
      if (!selected.length) { toast('Select at least one source'); return; }
      const a = shown[Number(body.querySelector('#join-a').value)];
      const b = shown[Number(body.querySelector('#join-b').value)];
      const markdown = projectReport(task, selected, a === b ? null : [a, b]);
      const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `dataset-atlas-${task.id}-brief.md`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Project brief exported');
    };
  }
  button.onclick = () => { render(); dialog.showModal(); dialog.querySelector('#workbench-close').focus(); };
  dialog.querySelector('#workbench-close').onclick = close;
  dialog.addEventListener('close', () => button.focus());
  dialog.addEventListener('click', (event) => {
    const rect = dialog.querySelector('.workbench-inner').getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
  });
  document.addEventListener('keydown', (event) => {
    trapModalFocus(dialog, event);
    if (event.key === 'Escape' && dialog.open) { event.preventDefault(); event.stopImmediatePropagation(); close(); }
  }, true);
}
