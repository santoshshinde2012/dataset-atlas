import { validYear, LEVELS } from './requirements.js';
import { COUNTRY_OPTIONS } from './search.js';

const text = (value, fallback, limit) => (typeof value === 'string' && value ? value : fallback).slice(0, limit);

export function normalizeProject(raw, catalog = [], tasks = []) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  // Unversioned drafts predate the v1 format; future formats need an explicit migration.
  if (Object.hasOwn(raw, 'version') && raw.version !== 1) return null;
  const task = raw.task;
  if (!task || typeof task.country !== 'string' || !Object.hasOwn(COUNTRY_OPTIONS, task.country) || !LEVELS.includes(task.level)) return null;
  const startYear = validYear(task.startYear), endYear = validYear(task.endYear);
  if (!startYear || !endYear || startYear > endYear) return null;
  const ids = new Set(catalog.map((d) => d.id));
  const keep = (values) => Array.isArray(values) ? [...new Set(values.filter((id) => ids.has(id)))].slice(0, 100) : [];
  const sourceIds = keep(raw.sourceIds);
  const sources = new Set(sourceIds);
  const taskId = tasks.some((t) => t.id === task.id) ? task.id : 'custom';
  return { version: 1, name: text(raw.name, 'My research project', 120),
    task: { id: taskId, title: text(task.title, 'Custom research', 160), description: text(task.description, '', 400),
      country: task.country, startYear, endYear, level: task.level,
      variables: (Array.isArray(task.variables) ? task.variables : []).filter((v) => typeof v === 'string').slice(0, 16).map((v) => v.slice(0, 100)) },
    resourceChoices: Object.fromEntries(catalog.filter((d) => Number.isInteger(raw.resourceChoices?.[d.id]) && d.resources?.[raw.resourceChoices[d.id]]).map((d) => [d.id, raw.resourceChoices[d.id]])),
    sourceIds, includedIds: keep(raw.includedIds).filter((id) => sources.has(id)), pairIds: keep(raw.pairIds).filter((id) => sources.has(id)).slice(0, 2),
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
