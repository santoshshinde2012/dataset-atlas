import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCsv } from '../js/services/data-reader.js';

function mockWorker(t, Worker) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { value: Worker, configurable: true, writable: true });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'Worker', original);
    else delete globalThis.Worker;
  });
}

test('CSV worker returns a parsed table and is terminated', async (t) => {
  const table = { columns: ['a'], rows: [['1']] };
  let terminated = false;
  mockWorker(t, class {
    postMessage() { queueMicrotask(() => this.onmessage({ data: { table } })); }
    terminate() { terminated = true; }
  });
  assert.deepEqual(await readCsv('a\n1'), table);
  assert.equal(terminated, true);
});

test('CSV worker dispatch failures terminate the worker immediately', async (t) => {
  let terminated = false;
  mockWorker(t, class {
    postMessage() { throw new Error('Data clone failed'); }
    terminate() { terminated = true; }
  });
  await assert.rejects(readCsv('a\n1'), /Data clone failed/);
  assert.equal(terminated, true);
});

test('CSV worker parse and transport errors are recoverable', async (t) => {
  for (const kind of ['parse', 'transport']) {
    await t.test(kind, async (t) => {
      let terminated = false;
      mockWorker(t, class {
        postMessage() {
          queueMicrotask(() => kind === 'parse'
            ? this.onmessage({ data: { error: 'Unclosed quoted CSV field' } })
            : this.onmessageerror());
        }
        terminate() { terminated = true; }
      });
      await assert.rejects(readCsv('invalid'), kind === 'parse' ? /Unclosed/ : /Could not parse/);
      assert.equal(terminated, true);
    });
  }
});
