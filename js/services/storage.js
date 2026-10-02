/**
 * Pins persistence port backed by localStorage. Defensive on both ends:
 * corrupt stored values yield an empty list instead of crashing boot, and
 * quota/security errors on save are non-fatal (pins just don't persist).
 */
const KEY = 'atlas-pins';

export const localPinStorage = {
  /** @returns {string[]} */
  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  },
  /** @param {string[]} ids */
  save(ids) {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      /* private mode / quota exceeded — pins stay session-only */
    }
  },
};

/** Project writes report failures so users can fall back to JSON export. */
export const projectStorage = {
  load() {
    try { const raw = JSON.parse(localStorage.getItem('atlas-projects') || '{}'); return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}; } catch { return {}; }
  },
  save(value) {
    try { localStorage.setItem('atlas-projects', JSON.stringify(value)); return true; } catch { return false; }
  },
};
