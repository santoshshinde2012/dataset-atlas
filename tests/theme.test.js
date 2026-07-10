import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { THEMES, DEFAULT_THEME, DOMAIN_META } from '../js/config.js';

// Theme tokens exist in two mediums — js/config.js (JS-rendered map/chips/DNA)
// and styles.css (CSS custom properties). These tests make drift between them
// a CI failure instead of a subtle two-tone UI.

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'styles.css'), 'utf8');

const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

function cssBlock(selector) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `styles.css must contain a ${selector} block`);
  return css.slice(start, css.indexOf('}', css.indexOf('{', start)));
}

test('light theme: css --accent/--accent-rgb match THEMES.light', () => {
  const block = cssBlock(':root {');
  assert.ok(block.includes(`--accent: ${THEMES.light.accent}`), '--accent drifted from config');
  assert.deepEqual(
    block.match(/--accent-rgb:\s*([\d,\s]+);/)[1].split(',').map((n) => +n.trim()),
    hexToRgb(THEMES.light.accent),
    '--accent-rgb drifted from the light accent hex'
  );
});

test('dark theme: css --accent/--accent-rgb match THEMES.dark', () => {
  const block = cssBlock(':root[data-theme="dark"]');
  assert.ok(block.includes(`--accent: ${THEMES.dark.accent}`), 'dark --accent drifted from config');
  assert.deepEqual(
    block.match(/--accent-rgb:\s*([\d,\s]+);/)[1].split(',').map((n) => +n.trim()),
    hexToRgb(THEMES.dark.accent),
    'dark --accent-rgb drifted from the dark accent hex'
  );
});

test('no raw accent rgba literals remain in styles.css (all via var(--accent-rgb))', () => {
  for (const theme of Object.values(THEMES)) {
    const [r, g, b] = hexToRgb(theme.accent);
    assert.ok(!css.includes(`rgba(${r}, ${g}, ${b}`),
      `hardcoded accent rgba for ${theme.accent} found — use rgba(var(--accent-rgb), …)`);
  }
});

test('theme registry is complete for every domain and both surfaces', () => {
  assert.ok(THEMES[DEFAULT_THEME]);
  for (const [name, t] of Object.entries(THEMES)) {
    for (const key of ['accent', 'accentRgb', 'accentDeep', 'noRegionFill', 'metaThemeColor']) {
      assert.ok(t[key], `${name}.${key} missing`);
    }
    assert.equal(t.availRamp.length, 4, `${name}.availRamp must have 4 stops`);
    for (const domain of Object.keys(DOMAIN_META)) {
      assert.match(t.domains[domain] || '', /^#[0-9a-f]{6}$/i, `${name} missing color for ${domain}`);
    }
  }
});

test('sequential ramps are monotonic in luminance (near-zero recedes toward surface)', () => {
  const lum = (hex) => {
    const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const lightLs = THEMES.light.availRamp.map(lum);
  const darkLs = THEMES.dark.availRamp.map(lum);
  assert.ok(lightLs.every((l, i) => i === 0 || l < lightLs[i - 1]), 'light ramp must darken with magnitude');
  assert.ok(darkLs.every((l, i) => i === 0 || l > darkLs[i - 1]), 'dark ramp must brighten with magnitude');
});
