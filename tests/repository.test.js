import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTHOR } from '../js/config.js';
import { icon } from '../js/icons.js';
import { catalogJsonLd, personJsonLd } from '../scripts/schema-dataset.js';

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

test('author marketing links are https and published in the shell', () => {
  const html = read('index.html');
  assert.equal(AUTHOR.name, 'Santosh Shinde');
  assert.deepEqual(AUTHOR.links.map((link) => link.id), ['github', 'linkedin', 'medium']);
  const hrefs = AUTHOR.links.map((link) => link.href);
  assert.equal(new Set(hrefs).size, hrefs.length, 'author hrefs must be unique');
  for (const link of AUTHOR.links) {
    assert.match(link.href, /^https:\/\/[^\s"'<>]+$/);
    assert.ok(html.includes(`href="${link.href}"`), `index.html missing ${link.id}`);
    assert.ok(html.includes(`data-icon="${link.id}"`), `index.html missing ${link.id} icon`);
    assert.equal(
      [...html.matchAll(/rel="me noopener noreferrer"/g)].length,
      6,
      'both credit navs must publish three rel=me identity links',
    );
    assert.notEqual(icon(link.id), icon('file'), `${link.id} must have its own icon`);
  }
  assert.ok(html.includes('id="author-credit"'));
  assert.ok(html.includes('author-credit-inline'));
  assert.match(read('README.md'), /linkedin\.com\/in\/shindesantosh/);

  const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
  assert.equal(jsonLd.creator.name, AUTHOR.name);
  assert.deepEqual(jsonLd.creator.sameAs, hrefs);
  assert.deepEqual(personJsonLd().sameAs, hrefs);
  assert.equal(personJsonLd().url, 'https://github.com/santoshshinde2012');
  assert.deepEqual(catalogJsonLd('https://example.test/', 1).creator, personJsonLd());
});
