import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../public/lib/github.js';
import { createRanker } from '../public/lib/feed.js';
import { buildProfile, DAY } from '../public/lib/profile.js';
import { createStore, parseHandle } from '../public/lib/store.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('parseHandle accepts plain, @-prefixed and profile-URL forms', () => {
  assert.equal(parseHandle('octocat'), 'octocat');
  assert.equal(parseHandle('  @octo-cat '), 'octo-cat');
  assert.equal(parseHandle('https://github.com/octocat?tab=stars'), 'octocat');
  assert.equal(parseHandle('-bad'), null);
  assert.equal(parseHandle('a--b'), null);
  assert.equal(parseHandle(''), null);
});

test('store keeps state per account and fills defaults', () => {
  const store = createStore(memoryStorage());
  assert.equal(store.has('user:a'), false);
  assert.deepEqual(store.load('user:a').dismissed, {});
  store.save('user:a', { ...store.load('user:a'), dismissed: { 'x/y': 1 }, lastVisit: 5 });
  assert.equal(store.load('user:a').lastVisit, 5);
  assert.deepEqual(store.load('user:b').dismissed, {});
  assert.equal(store.load('user:b').lastVisit, null);
});

test('store survives storage that throws', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const store = createStore(broken);
  assert.equal(store.handle(), null);
  assert.equal(store.save('local', {}), false);
  assert.deepEqual(store.load('local').feed, []);
  assert.doesNotThrow(() => store.setHandle(null));
});

test('ranker drops already-starred and own repos', () => {
  const now = Date.parse('2026-11-01T00:00:00Z');
  const starred = { full_name: 'a/rg', name: 'rg', owner: { login: 'a' }, topics: ['cli', 'rust'], language: 'Rust' };
  const stars = [{ starredAt: new Date(now - DAY).toISOString(), repo: starred }];
  const rank = createRanker(stars, buildProfile(stars, now), 'me', { now });
  const repo = (full_name, owner) => ({
    full_name, name: full_name.split('/')[1], owner: { login: owner }, topics: ['cli'], language: 'Rust',
    stargazers_count: 100, created_at: new Date(now - 3 * DAY).toISOString(),
  });
  const feed = rank([
    { repo: { ...starred, stargazers_count: 100, created_at: new Date(now - DAY).toISOString() }, sources: [] },
    { repo: repo('me/mine', 'me'), sources: [] },
    { repo: repo('b/fresh', 'b'), sources: [] },
  ]);
  assert.deepEqual(feed.map((i) => i.fullName), ['b/fresh']);
});

test('search waits out an exhausted rate limit instead of failing', async () => {
  const waits = [];
  const reports = [];
  const resetSec = Math.ceil(Date.now() / 1000) + 30;
  const responses = [
    new Response(JSON.stringify({ items: [{ id: 1 }] }), {
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(resetSec) },
    }),
    new Response(JSON.stringify({ items: [{ id: 2 }] }), {
      headers: { 'x-ratelimit-remaining': '9', 'x-ratelimit-reset': String(resetSec + 60) },
    }),
  ];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => responses.shift();
  try {
    const client = createClient({ sleep: async (ms) => waits.push(ms), onWait: (u) => reports.push(u) });
    assert.deepEqual(await client.search('a'), [{ id: 1 }]);
    assert.deepEqual(await client.search('b'), [{ id: 2 }]);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(waits.length, 1);
  assert.ok(waits[0] > 25_000 && waits[0] <= 32_000);
  assert.equal(reports.at(-1), 0);
});

test('a rate-limited response carries when the limit resets', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
      status: 403,
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' },
    });
  try {
    await assert.rejects(createClient().user('octocat'), (err) => err.status === 403 && err.resetAt === 1_800_000_000_000);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('starred reads the page count from the Link header and stops at the limit', async () => {
  const requested = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const page = Number(new URL(url).searchParams.get('page'));
    requested.push(page);
    const items = Array.from({ length: page < 7 ? 100 : 40 }, (_, i) => ({ starred_at: 't', repo: { full_name: `o/r${page}-${i}` } }));
    return new Response(JSON.stringify(items), {
      headers: page === 1 ? { link: '<https://api.github.com/user/starred?per_page=100&page=2>; rel="next", <https://api.github.com/user/starred?per_page=100&page=7&sort=created&direction=desc>; rel="last"' } : {},
    });
  };
  try {
    const client = createClient();
    const all = await client.starred(1000, 'someone');
    assert.equal(all.length, 640);
    assert.deepEqual(requested.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7]);
    requested.length = 0;
    assert.equal((await client.starred(250, 'someone')).length, 250);
    assert.deepEqual(requested.sort((a, b) => a - b), [1, 2, 3]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('the client sends a token only when given one', async () => {
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    seen.push(opts.headers);
    return new Response('{}');
  };
  try {
    await createClient().user('a');
    await createClient({ token: 't0k' }).user('a');
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(seen[0].Authorization, undefined);
  assert.equal(seen[1].Authorization, 'Bearer t0k');
});
