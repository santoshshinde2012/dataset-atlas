import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('every published browser module is reachable from the app entry point', () => {
  const build = read('scripts/build-site.js');
  const manifest = build.match(/const files = \[([\s\S]*?)\];/)?.[1];
  assert.ok(manifest, 'build-site.js must expose its asset list');
  const files = [...manifest.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  for (const file of files) assert.ok(existsSync(resolve(root, file)), `${file} is missing`);

  const publishedModules = new Set(files.filter((file) => file.startsWith('js/') && file.endsWith('.js')));
  const visited = new Set();
  const visit = (file) => {
    if (visited.has(file)) return;
    assert.ok(publishedModules.has(file), `${file} is imported but not published`);
    visited.add(file);
    const source = read(file);
    for (const match of source.matchAll(/(?:import|export)\s+(?:[^;]*?\s+from\s+)?['"](\.[^'"]+)['"]/g)) {
      const imported = resolve(dirname(resolve(root, file)), match[1]);
      visit(imported.slice(root.length + 1));
    }
  };
  visit('js/main.js');
  assert.deepEqual([...publishedModules].sort(), [...visited].sort(), 'published modules must have a runtime importer');
});

test('maintainer documentation has no broken local links', () => {
  const markdown = ['README.md', 'CLAUDE.md', 'CONTRIBUTING.md', ...readdirSync(resolve(root, 'docs')).filter((name) => name.endsWith('.md')).map((name) => `docs/${name}`)];
  for (const file of markdown) {
    for (const match of read(file).matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^(?:[a-z]+:|\/\/)/i.test(target)) continue;
      assert.ok(existsSync(resolve(root, dirname(file), decodeURI(target))), `${file} links to missing ${target}`);
    }
  }
});
