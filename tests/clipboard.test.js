import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClipboard } from '../js/services/clipboard.js';

function fakeDocument(result) {
  const state = { removed: false, restored: false, selected: false };
  const modal = { appendChild: () => { state.container = 'modal'; } };
  const document = {
    activeElement: { isConnected: true, closest: () => modal, focus: () => { state.restored = true; } },
    body: { appendChild: () => { state.container = 'body'; } },
    createElement: () => ({ style: {}, focus() {}, select: () => { state.selected = true; }, remove: () => { state.removed = true; } }),
    execCommand: () => { if (result instanceof Error) throw result; return result; },
  };
  return { document, state };
}

test('clipboard reports native success without a DOM fallback', async () => {
  const messages = [], copied = [];
  const copy = createClipboard((message) => messages.push(message), { clipboard: { writeText: async (text) => copied.push(text) } });
  assert.equal(await copy('citation', 'Citation copied'), true);
  assert.deepEqual(copied, ['citation']);
  assert.deepEqual(messages, ['Citation copied']);
});

test('denied clipboard falls back inside the active modal and restores focus', async () => {
  const { document, state } = fakeDocument(true);
  const messages = [];
  const copy = createClipboard((message) => messages.push(message), { document, clipboard: { writeText: async () => { throw new Error('denied'); } } });
  assert.equal(await copy('citation'), true);
  assert.deepEqual(state, { removed: true, restored: true, selected: true, container: 'modal' });
  assert.deepEqual(messages, ['Copied to clipboard']);
});

test('a false or throwing copy fallback reports failure and cleans up', async () => {
  for (const result of [false, new Error('denied')]) {
    const { document, state } = fakeDocument(result);
    const messages = [];
    const copy = createClipboard((message) => messages.push(message), { document, clipboard: null });
    assert.equal(await copy('citation'), false);
    assert.deepEqual(messages, ['Copy failed']);
    assert.equal(state.removed, true);
    assert.equal(state.restored, true);
  }
});
