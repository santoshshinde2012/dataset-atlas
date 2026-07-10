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
