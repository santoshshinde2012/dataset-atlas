import { profileFor } from '../dataset.js';
import { encodeProject, decodeProject, normalizeProject } from '../project.js';
import { setFieldError } from './form-controls.js';
import { LEVELS, validYear, yearRangeErrors } from '../requirements.js';
import { COUNTRY_OPTIONS } from '../search.js';
import { downloadText } from '../services/download.js';
import { pythonRecipe } from '../exports.js';
import { assessFit, assessJoin, projectReport } from '../fit.js';
import { kitsForTask } from '../kits.js';
import { esc } from '../utils/text.js';
import { trapModalFocus } from './focus-trap.js';

const status = (value) => `<strong class="fit-${value}">${value}</strong>`;
const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;

export function initWorkbench({ catalog, pilot, toast, store, storage, copyText, sharedProject = null }) {
  const dialog = document.getElementById('workbench');
  const body = document.getElementById('workbench-body');
  const button = document.getElementById('workbench-btn');
  body.addEventListener('click', (event) => {
    if (!event.target.closest('#project-save, #project-share, #project-json, #project-python, #workbench-export')) return;
    const invalid = body.querySelector('[aria-invalid="true"]:not([type="file"])');
    if (!invalid) return;
    event.preventDefault(); event.stopImmediatePropagation();
    (body.querySelector(`.dropdown-trigger[data-select="${invalid.id}"]`) || invalid).focus();
  }, true);
  const saved = storage.load();
  saved.projects = Array.isArray(saved.projects) ? saved.projects.map((p) => normalizeProject(p, catalog, pilot.tasks)).filter(Boolean) : [];
  const shared = decodeProject(sharedProject, catalog, pilot.tasks);
  const restored = shared || normalizeProject(saved.draft, catalog, pilot.tasks);
  let task = restored?.task || { ...pilot.tasks[0] };
  let projectName = restored?.name || 'My research project';
  let extraIds = restored?.sourceIds || [];
  let included = restored ? new Set(restored.includedIds) : null;
  let pairIds = restored?.pairIds || [];
  const snapshot = () => ({ version: 1, name: projectName, task, sourceIds: shown.map((x) => x.dataset.id), includedIds: [...(included || [])], pairIds, resourceChoices: Object.fromEntries(shown.map(({ dataset: d }) => [d.id, d.resources.findIndex((r) => r.url === store.getState().resourceSelections[d.id])]).filter(([, i]) => i >= 0)) });
  const persist = () => {
    saved.draft = snapshot(); const savedOK = storage.save(saved);
    const message = savedOK ? 'Draft saved in this browser.' : 'Draft could not be saved. Export JSON to keep a copy.';
    const status = body.querySelector('.project-storage-note'); if (status) status.textContent = message;
    if (!savedOK) toast(message);
  };

  const applyChoices = (project) => { for (const [id, index] of Object.entries(project?.resourceChoices || {})) store.actions.selectResource(id, catalog.find((d) => d.id === id).resources[index].url); };
  applyChoices(restored);
  let shown = [];
  let navigationObserver;
  const close = () => dialog.close();

  function render() {
    const scrollPosition = body.scrollTop;
    navigationObserver?.disconnect();
    shown = pilot.profiles.filter((p) => p.task === task.id).map((profile) => ({ profile, dataset: catalog.find((d) => d.url === profile.url) })).filter((x) => x.dataset);
    for (const id of extraIds) {
      const dataset = catalog.find((d) => d.id === id);
      if (dataset && !shown.some((x) => x.dataset.id === id)) shown.push({ dataset, profile: profileFor(dataset, pilot.profiles, task.id) });
    }
    if (!included) included = new Set(shown.map((x) => x.dataset.id));
    if (pairIds.length < 2) pairIds = shown.slice(0, 2).map((x) => x.dataset.id);
    const kits = kitsForTask(task.id);
    const kitLinks = kits.map((kit) => kit.notebook
      ? ` <a href="${esc(kit.notebook)}" download>Download ${esc(kit.label)} notebook</a>`
      : '').join('');
    const kitNote = kits.map((k) => {
      const refuse = k.outcome === 'do-not-join' ? ' — do not join' : '';
      const dont = (k.doNot || []).map((line) => `<li>${esc(line)}</li>`).join('');
      return `<p class="workbench-note">Kit: ${esc(k.label)} (${esc(k.status)}${refuse}). Grain: ${esc(k.resultGrain)}.</p>${dont ? `<ul class="workbench-donot">${dont}</ul>` : ''}`;
    }).join('');
    body.innerHTML = `
      <section class="project-tools" aria-label="Project management">
        <div class="project-identity"><label>Project name <input id="project-name" maxlength="120" value="${esc(projectName)}"></label><button id="project-save" class="primary">Save project</button></div>
        <details class="project-options" ${innerWidth > 600 ? 'open' : ''}><summary>Project options <small>Saved projects, sharing &amp; files</small></summary><div class="project-options-body"><label>Saved projects <select id="project-load"><option value="">Choose saved project</option>${(saved.projects || []).map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('')}</select></label>
        <div class="project-transfer"><button id="project-share">Share link</button><button id="project-json">Export JSON</button><label class="file-action">Import JSON<input id="project-import" class="visually-hidden" type="file" accept=".json" aria-label="Import project JSON"></label></div>
        </div></details>
        <p class="project-storage-note" role="status" aria-live="polite">Changes are saved in this browser.</p>
      </section>
      <nav class="workspace-nav" aria-label="Research workflow">
        <button type="button" data-step="research-setup-title" aria-current="step"><span>1</span> Research</button>
        <button type="button" data-step="project-sources-title"><span>2</span> Sources <small>${shown.length}</small></button>
        <button type="button" data-step="pair-title"><span>3</span> Compatibility</button>
        <button type="button" data-step="handoff-title"><span>4</span> Export</button>
      </nav>
      <div class="workspace-layout"><div class="workspace-main">
      <section class="workbench-section research-setup" aria-labelledby="research-setup-title">
        <div class="workbench-section-heading"><span class="step-number">1</span><div><h3 id="research-setup-title" tabindex="-1">Define your research</h3><p>Choose a starting question, then adjust the requirements.</p></div></div>
        <label>Research task <select id="workbench-task"><option value="custom" ${task.id === 'custom' ? 'selected' : ''}>Custom research</option>${pilot.tasks.map((t) => `<option value="${esc(t.id)}" ${t.id === task.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></label>
        <div class="workbench-inputs" role="group" aria-label="Research geography and time"><label>Country <select id="fit-country">${Object.entries(COUNTRY_OPTIONS).sort((a,b) => a[1].localeCompare(b[1])).map(([code,name]) => `<option value="${code}" ${code === task.country ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label><label>From year <input id="fit-start" required type="number" min="1800" max="2100" value="${task.startYear}"></label><label>To year <input id="fit-end" required type="number" min="1800" max="2100" value="${task.endYear}"></label><label>Geographic level <select id="fit-level">${LEVELS.map((level) => `<option value="${level}" ${level === task.level ? 'selected' : ''}>${level}</option>`).join('')}</select></label></div>
        <label>Requested variables <input id="fit-variables" placeholder="e.g. population, rainfall" value="${esc(task.variables.join(', '))}"><small>Separate variables with commas.</small></label>
        <p class="research-target">${esc(task.description)} <b>Target:</b> ${esc(task.country)}, ${task.startYear}–${task.endYear}, ${esc(task.level)}; ${esc(task.variables.join(', '))}.</p>
        <details class="workbench-guidance"><summary>Source evidence &amp; join guidance</summary><div><p>Results screen recorded metadata; previews are static source samples. A <b>match</b> requires documented overlap. Matching key names alone does not verify a join.</p>${kitNote || '<p>No reviewed join kit for this question. Compatibility stays unknown until documented.</p>'}</div></details>
      </section>
      <section class="workbench-section" aria-labelledby="project-sources-title">
        <div class="workbench-section-heading"><span class="step-number">2</span><div><h3 id="project-sources-title" tabindex="-1">Review your sources <span class="count-badge">${shown.length}</span></h3><p>Check fit and evidence. Include the sources you want in your brief.</p></div></div>
        <label>Add a catalog dataset <select id="project-add"><option value="">Search or choose a dataset</option>${catalog.filter((d) => !shown.some((x) => x.dataset.id === d.id)).map((d) => `<option value="${d.id}">${esc(d.title)}</option>`).join('')}</select></label>
      <div class="workbench-grid">${shown.map(({ dataset, profile }, i) => {
        const fit = assessFit(dataset, profile, task);
        return `<article class="workbench-card" data-fit="${fit.status}"><h3>${esc(dataset.title)}</h3><p>${status(fit.status)} · ${esc(profile.level)} · ${esc(profile.time)}</p>
          <details class="source-fit-details"><summary>Fit assessment · ${esc(fit.status)}</summary><ul>${fit.reasons.map((r) => `<li>${status(r.status)} ${esc(r.text)}</li>`).join('')}</ul></details>
          <p><b>Variables:</b> ${esc(profile.variables.join(', '))}<br><b>Keys:</b> ${esc(profile.joinKeys.join(', '))}</p>
          <p><b>Access:</b> ${esc(profile.access)}</p>
          <p>${link(dataset.url, 'Source page')} · ${link(profile.evidence, 'Evidence')}${profile.resource ? ` · ${link(profile.resource.url, profile.resource.label)}` : ''}</p>
          ${profile.columns ? `<details><summary>Verified columns${profile.preview ? ' and sample' : ''}</summary><p>${esc(profile.columns.join(' · '))}</p>${profile.preview ? `<pre>${esc(profile.preview.rows.map((row) => row.join(' | ')).join('\n'))}</pre><small>Static sample from ${link(profile.preview.source, 'source CSV')}</small>` : '<p>No verified sample rows available.</p>'}</details>` : '<p class="workbench-note">Schema preview unavailable; inspect source.</p>'}
          <label><input type="checkbox" class="workbench-select" value="${i}" ${included.has(dataset.id) ? 'checked' : ''}> Include in project brief</label></article>`;
      }).join('') || '<p class="workspace-empty">Add your first dataset above to review its fit and evidence.</p>'}</div>
      </section>
      <section class="workbench-join workbench-section"><div class="workbench-section-heading"><span class="step-number">3</span><div><h3 id="pair-title" tabindex="-1">Check pair compatibility</h3><p>Compare geography, time, units, and documented join keys.</p></div></div><div class="join-selectors"><label>First source <select id="join-a">${shown.map((x, i) => `<option value="${i}" ${x.dataset.id === pairIds[0] ? 'selected' : ''}>${esc(x.dataset.title)}</option>`).join('')}</select></label><label>Second source <select id="join-b">${shown.map((x, i) => `<option value="${i}" ${x.dataset.id === pairIds[1] ? 'selected' : ''}>${esc(x.dataset.title)}</option>`).join('')}</select></label></div><div id="join-result"></div></section>
      <footer class="workbench-handoff"><div><strong id="handoff-title" tabindex="-1">Export your project</strong><small>Export your selected sources and research requirements.</small></div><div class="handoff-actions"><button id="workbench-export" class="primary">Export project brief (.md)</button><button id="project-python">Export Python recipe</button>${kitLinks}</div></footer></div>
      <aside class="workspace-summary" aria-label="Project overview">
        <span class="workspace-eyebrow">PROJECT OVERVIEW</span><h3>${esc(projectName)}</h3>
        <p>${esc(COUNTRY_OPTIONS[task.country] || task.country)} <span>·</span> ${task.startYear}–${task.endYear}</p>
        <div class="summary-tags"><span>${esc(task.level)}</span>${task.variables.map((v) => `<span>${esc(v)}</span>`).join('')}</div>
        <div class="summary-counts"><div><strong>${shown.length}</strong><small>Sources</small></div><div><strong id="summary-included">${shown.filter((x) => included.has(x.dataset.id)).length}</strong><small>Included</small></div><div><strong>${shown.filter((x) => assessFit(x.dataset, x.profile, task).status === 'match').length}</strong><small>Fit matches</small></div></div>
        <p class="summary-evidence-note">Fit screens source metadata. Pair compatibility is assessed separately.</p>
        <div class="summary-pair"><small>PAIR COMPATIBILITY</small><strong id="summary-pair-status">Choose sources</strong></div>
        <button type="button" class="summary-next" data-step="pair-title">Review compatibility →</button>
      </aside></div>`;
    body.querySelector('#workbench-task').onchange = (e) => {
      task = e.target.value === 'custom' ? { ...task, id: 'custom', title: projectName } : { ...pilot.tasks.find((t) => t.id === e.target.value) };
      extraIds = []; included = null; pairIds = []; render(); persist();
    };
    body.querySelector('#project-name').onchange = (e) => { projectName = e.target.value.trim() || 'My research project'; body.querySelector('.workspace-summary h3').textContent = projectName; persist(); };
    body.querySelector('#project-add').onchange = (e) => {
      const id = e.target.value; if (!id) return;
      extraIds.push(id); included.add(id); render(); persist();
    };
    body.querySelectorAll('.workbench-select').forEach((input) => input.onchange = () => {
      const id = shown[Number(input.value)].dataset.id;
      input.checked ? included.add(id) : included.delete(id);
      body.querySelector('#summary-included').textContent = shown.filter((x) => included.has(x.dataset.id)).length; persist();
    });
    body.querySelector('#project-save').onclick = () => {
      const projects = Array.isArray(saved.projects) ? saved.projects : [];
      saved.projects = [snapshot(), ...projects.filter((p) => p.name !== projectName)].slice(0, 20);
      saved.draft = snapshot();
      if (storage.save(saved)) { render(); toast('Project saved in this browser'); }
      else toast('Could not save project. Export JSON to keep a copy.');
    };
    const restore = (project) => {
      if (!project) { toast('Project has invalid requirements or format'); return; }
      task = project.task; projectName = project.name; extraIds = project.sourceIds;
      included = new Set(project.includedIds); pairIds = project.pairIds; applyChoices(project); render(); persist();
    };
    body.querySelector('#project-load').onchange = (e) => { if (e.target.value !== '') restore(normalizeProject(saved.projects[Number(e.target.value)], catalog, pilot.tasks)); };
    body.querySelector('#project-share').onclick = () => {
      const params = new URLSearchParams(); const encoded = encodeProject(snapshot());
      if (encoded.length > 16000) { toast('Project is too large for a share link. Export JSON instead.'); return; }
      params.set('project', encoded);
      copyText(`${location.origin}${location.pathname}#${params}`, 'Project link copied');
    };
    body.querySelector('#project-json').onclick = () => downloadText('atlas-project.json', JSON.stringify(snapshot(), null, 2), 'application/json');
    body.querySelector('#project-python').onclick = () => downloadText('atlas-download.py', pythonRecipe(shown.filter((x) => included.has(x.dataset.id)).map((x) => x.dataset), task, store.getState().resourceSelections), 'text/x-python');
    body.querySelector('#project-import').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      setFieldError(e.target);
      if (file.size > 100000) { setFieldError(e.target, 'Choose project JSON under 100 KB.'); e.target.value = ''; return; }
      try {
        const project = normalizeProject(JSON.parse(await file.text()), catalog, pilot.tasks);
        if (!project) throw new Error('invalid project');
        restore(project);
      } catch { setFieldError(e.target, 'Choose a valid Atlas project JSON file.'); e.target.value = ''; }
    };
    for (const id of ['fit-country', 'fit-start', 'fit-end', 'fit-level', 'fit-variables']) body.querySelector(`#${id}`).onchange = () => {
      const country = body.querySelector('#fit-country').value.toUpperCase().trim();
      const startYear = validYear(body.querySelector('#fit-start').value);
      const endYear = validYear(body.querySelector('#fit-end').value);
      const errors = yearRangeErrors(body.querySelector('#fit-start').value, body.querySelector('#fit-end').value, { required: true });
      setFieldError(body.querySelector('#fit-start'), errors.startYear); setFieldError(body.querySelector('#fit-end'), errors.endYear);
      setFieldError(body.querySelector('#fit-country'), COUNTRY_OPTIONS[country] ? '' : 'Choose a country.');
      const variables = body.querySelector('#fit-variables').value.split(',').map((v) => v.trim()).filter(Boolean);
      setFieldError(body.querySelector('#fit-variables'), variables.length > 16 ? 'Use up to 16 requested variables.' : '');
      if (Object.keys(errors).length || !COUNTRY_OPTIONS[country] || variables.length > 16) return;
      task = { ...task, country, startYear, endYear, level: body.querySelector('#fit-level').value,
        variables };
      render(); persist(); body.querySelector(`#${id}`).focus();
    };
    const updateJoin = () => {
      const a = shown[Number(body.querySelector('#join-a').value)];
      const b = shown[Number(body.querySelector('#join-b').value)];
      const target = body.querySelector('#join-result');
      const summaryStatus = body.querySelector('#summary-pair-status');
      if (!a || !b) { summaryStatus.textContent = 'Add two sources'; target.textContent = 'Add two datasets to compare their compatibility.'; return; }
      pairIds = [a.dataset.id, b.dataset.id];
      if (a === b) { summaryStatus.textContent = 'Choose different sources'; target.textContent = 'Choose two different sources.'; return; }
      const result = assessJoin(a.profile, b.profile, a.dataset, b.dataset);
      summaryStatus.textContent = result.status; summaryStatus.className = `fit-${result.status}`;
      target.innerHTML = `<p>${status(result.status)}</p><ul>${result.notes.map((n) => `<li>${status(n.status)} ${esc(n.text)}</li>`).join('')}</ul>`;
    };
    body.querySelector('#join-a').onchange = () => { updateJoin(); persist(); };
    body.querySelector('#join-b').onchange = () => { updateJoin(); persist(); };
    updateJoin();
    body.querySelectorAll('[data-step]').forEach((control) => control.onclick = () => {
      const target = body.querySelector(`#${control.dataset.step}`);
      target.scrollIntoView({ block: 'start', behavior: 'instant' }); target.focus({ preventScroll: true });
      body.querySelectorAll('.workspace-nav button').forEach((nav) => nav.setAttribute('aria-current', nav.dataset.step === control.dataset.step ? 'step' : 'false'));
    });
    navigationObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      body.querySelectorAll('.workspace-nav button').forEach((nav) => nav.setAttribute('aria-current', nav.dataset.step === visible.target.id ? 'step' : 'false'));
    }, { root: body, rootMargin: '-60px 0px -65% 0px' });
    for (const id of ['research-setup-title', 'project-sources-title', 'pair-title', 'handoff-title']) navigationObserver.observe(body.querySelector(`#${id}`));
    body.scrollTop = scrollPosition;
    body.querySelector('#workbench-export').onclick = () => {
      const selected = [...body.querySelectorAll('.workbench-select:checked')].map((input) => shown[Number(input.value)]);
      if (!selected.length) { toast('Select at least one source'); return; }
      const a = shown[Number(body.querySelector('#join-a').value)];
      const b = shown[Number(body.querySelector('#join-b').value)];
      const markdown = projectReport(task, selected, !a || !b || a === b ? null : [a, b]);
      const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `dataset-atlas-${task.id}-brief.md`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Project brief exported');
    };
  }
  button.onclick = () => open();
  dialog.querySelector('#workbench-close').onclick = close;
  dialog.addEventListener('close', () => { navigationObserver?.disconnect(); button.focus(); });
  dialog.addEventListener('click', (event) => {
    const rect = dialog.querySelector('.workbench-inner').getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.target.closest('.dropdown-popup')) return;
    trapModalFocus(dialog, event);
    if (event.key === 'Escape' && dialog.open) { event.preventDefault(); event.stopImmediatePropagation(); close(); }
  }, true);

  function open(taskId) {
    if (taskId) {
      const found = pilot.tasks.find((item) => item.id === taskId);
      if (found) { task = { ...found }; extraIds = []; included = null; pairIds = []; }
    }
    render();
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('#workbench-close').focus();
  }

  if (sharedProject) { if (shared) { open(); persist(); } else toast('Shared project is invalid'); }
  return { open, addMany(ids) {
    for (const id of ids) {
      if (!catalog.some((d) => d.id === id)) continue;
      if (!extraIds.includes(id)) extraIds.push(id);
      if (included) included.add(id);
    }
    open(); persist();
  }, add(id) {
    if (!extraIds.includes(id)) extraIds.push(id);
    if (included) included.add(id);
    open(); persist();
  } };
}
