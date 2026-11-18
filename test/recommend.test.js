import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProfile, DAY, keywordsOf } from '../public/lib/profile.js';
import { buildQueries, createScorer, dropCloneClusters, isEligible, similarStarred } from '../public/lib/recommend.js';

const now = Date.parse('2026-11-01T00:00:00Z');
const star = (daysAgo, repo) => ({ starredAt: new Date(now - daysAgo * DAY).toISOString(), repo });

const stars = [
  star(2, { full_name: 'a/rg', language: 'Rust', topics: ['cli', 'search', 'rust'], description: 'Fast grep tool' }),
  star(10, { full_name: 'a/fd', language: 'Rust', topics: ['cli', 'filesystem', 'rust'], description: 'Find files' }),
  star(900, { full_name: 'a/old', language: 'PHP', topics: ['wordpress'], description: 'Blog engine' }),
];

test('recent stars outweigh old ones', () => {
  const p = buildProfile(stars, now);
  const weight = Object.fromEntries(p.topics);
  assert.ok(weight.cli > weight.wordpress);
  assert.equal(p.languages[0][0], 'Rust');
});

test('relevant repos outscore unrelated ones at equal momentum', () => {
  const score = createScorer(buildProfile(stars, now));
  const base = { stargazers_count: 300, created_at: new Date(now - 10 * DAY).toISOString() };
  const fit = score({ ...base, language: 'Rust', topics: ['cli', 'rust'], description: 'A terminal tool' }, now);
  const miss = score({ ...base, language: 'Java', topics: ['spring'], description: 'Enterprise beans' }, now);
  assert.ok(fit.score > miss.score);
  assert.deepEqual(fit.matchedTopics.sort(), ['cli', 'rust']);
  assert.equal(miss.relevance, 0);
});

test('queries cover top topics, languages and a hot query', () => {
  const qs = buildQueries(buildProfile(stars, now), now);
  assert.ok(qs.some((q) => q.source === 'topic:cli'));
  assert.ok(qs.some((q) => q.q.startsWith('language:"Rust"')));
  assert.ok(qs.some((q) => q.source === 'hot'));
});

test('similarStarred needs real overlap', () => {
  const lite = stars.map((s) => ({ name: s.repo.full_name, topics: s.repo.topics }));
  assert.deepEqual(similarStarred(['cli', 'rust', 'search'], lite, 1), ['a/rg']);
  assert.deepEqual(similarStarred(['wordpress'], lite), []);
});

test('keywordsOf drops stopwords and short words', () => {
  assert.deepEqual(keywordsOf('A fast, simple tool for Kubernetes logs'), ['kubernetes', 'logs']);
});

test('forks are hidden unless popular themselves', () => {
  const repo = (o) => ({ owner: { login: 'x' }, stargazers_count: 50, ...o });
  assert.equal(isEligible(repo({ fork: true }), 'me', 200), false);
  assert.equal(isEligible(repo({ fork: true, stargazers_count: 500 }), 'me', 200), true);
  assert.equal(isEligible(repo({ fork: false }), 'me', 200), true);
  assert.equal(isEligible(repo({ archived: true }), 'me', 200), false);
  assert.equal(isEligible(repo({ owner: { login: 'me' } }), 'me', 200), false);
});

test('star-farmed look-alike clusters are dropped, organic same-name repos are kept', () => {
  const c = (owner, name, stars) => ({ repo: { name, owner: { login: owner }, stargazers_count: stars }, sources: [] });
  const farmed = [c('a', 'ai--manus2.0', 380), c('b', 'ai--manus2.0', 378), c('c', 'AI--manus2.0', 377)];
  const organic = [c('d', 'skills', 9000), c('e', 'skills', 400), c('f', 'skills', 12)];
  const lone = c('g', 'unique', 50);
  assert.deepEqual(dropCloneClusters([...farmed, ...organic, lone]), [...organic, lone]);
});

test('identical long descriptions across owners are dropped, forks exempt', () => {
  const desc = 'Rust External 2026: Full Standalone Trainer Setup';
  const c = (owner, name, description, fork = false) => ({
    repo: { name, owner: { login: owner }, stargazers_count: 100, description, fork },
    sources: [],
  });
  const spam = [c('a', 'x', desc), c('b', 'y', desc)];
  const forks = [c('c', 'z', 'A reasonably long shared description here', true), c('d', 'w', 'A reasonably long shared description here', true)];
  const short = [c('e', 'p', 'tiny'), c('f', 'q', 'tiny')];
  assert.deepEqual(dropCloneClusters([...spam, ...forks, ...short]), [...forks, ...short]);
});
