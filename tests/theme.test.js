import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ACCENT_COLOR } from '../js/config.js';

// The accent color exists in two mediums — config.js (JS-rendered map/chips)
// and styles.css (theme variables + rgba literals). This test makes drift
// between them a CI failure instead of a subtle two-tone UI.

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'styles.css'), 'utf8');

const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

test('styles.css --accent matches config ACCENT_COLOR', () => {
  const m = css.match(/--accent:\s*(#[0-9a-fA-F]{6})/);
  assert.ok(m, 'styles.css must define --accent as a 6-digit hex');
  assert.equal(m[1].toLowerCase(), ACCENT_COLOR.toLowerCase());
});

test('accent-tinted rgba literals in styles.css match config ACCENT_COLOR', () => {
  const [r, g, b] = hexToRgb(ACCENT_COLOR);
  // any rgba literal that is "accent-like" (high blue, mid-high green, low-mid red)
  // must be exactly the accent — catches a config change that misses the CSS
  const rgbaRe = /rgba\((\d+),\s*(\d+),\s*(\d+)/g;
  let accentLikeCount = 0;
  for (const m of css.matchAll(rgbaRe)) {
    const [cr, cg, cb] = [+m[1], +m[2], +m[3]];
    const isAccentLike = cb > 200 && cg > 150 && cr < 120;
    if (isAccentLike) {
      accentLikeCount++;
      assert.deepEqual([cr, cg, cb], [r, g, b],
        `accent-like rgba(${cr}, ${cg}, ${cb}) diverges from ACCENT_COLOR ${ACCENT_COLOR}`);
    }
  }
  assert.ok(accentLikeCount > 0, 'expected accent-tinted rgba literals in styles.css');
});
