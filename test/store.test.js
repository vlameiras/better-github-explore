import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadState, saveState } from '../src/store.js';

test('a fresh state has no last visit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'explore-'));
  const state = await loadState(join(dir, 'state.json'));
  assert.equal(state.lastVisit, null);
});

test('an older state file without lastVisit loads with a null default', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'explore-'));
  const file = join(dir, 'state.json');
  await writeFile(file, JSON.stringify({ feed: [], dismissed: { 'a/b': 1 } }));
  const state = await loadState(file);
  assert.equal(state.lastVisit, null);
  assert.deepEqual(state.dismissed, { 'a/b': 1 });
});

test('lastVisit survives a save and load', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'explore-'));
  const file = join(dir, 'state.json');
  const state = await loadState(file);
  state.lastVisit = 1_700_000_000_000;
  await saveState(file, state);
  assert.equal((await loadState(file)).lastVisit, 1_700_000_000_000);
});
