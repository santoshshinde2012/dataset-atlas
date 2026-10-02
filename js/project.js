import { validYear, LEVELS } from './requirements.js';
import { COUNTRY_OPTIONS } from './search.js';

export function normalizeProject(raw, catalog = [], tasks = []) {
  if (!raw || typeof raw !== 'object') return null;
  const task = raw.task;
  if (!task || !COUNTRY_OPTIONS[task.country] || !validYear(task.startYear) || !validYear(task.endYear) || task.startYear > task.endYear || !LEVELS.includes(task.level)) return null;
  const ids = new Set(catalog.map((d) => d.id));
  const keep = (values) => Array.isArray(values) ? [...new Set(values.filter((id) => ids.has(id)))].slice(0, 100) : [];
  const taskId = tasks.some((t) => t.id === task.id) ? task.id : 'custom';
  return { version: 1, name: String(raw.name || 'My research project').slice(0, 120),
    task: { id: taskId, title: String(task.title || 'Custom research').slice(0, 160), description: String(task.description || '').slice(0, 400),
      country: task.country, startYear: validYear(task.startYear), endYear: validYear(task.endYear), level: task.level,
      variables: (Array.isArray(task.variables) ? task.variables : []).filter((v) => typeof v === 'string').slice(0, 16).map((v) => v.slice(0, 100)) },
    resourceChoices: Object.fromEntries(catalog.filter((d) => Number.isInteger(raw.resourceChoices?.[d.id]) && d.resources?.[raw.resourceChoices[d.id]]).map((d) => [d.id, raw.resourceChoices[d.id]])),
    sourceIds: keep(raw.sourceIds), includedIds: keep(raw.includedIds), pairIds: keep(raw.pairIds).slice(0, 2),
  };
}
export function encodeProject(project) {
  const bytes = new TextEncoder().encode(JSON.stringify(project));
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeProject(value, catalog, tasks) {
  try {
    if (typeof value !== 'string' || value.length > 16000 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const bytes = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    return normalizeProject(JSON.parse(new TextDecoder().decode(bytes)), catalog, tasks);
  } catch { return null; }
}
