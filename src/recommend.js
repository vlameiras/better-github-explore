import { DAY, keywordsOf } from './profile.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const squash = (x) => 1 - Math.exp(-x);
const isoDaysAgo = (now, days) => new Date(now - days * DAY).toISOString().slice(0, 10);

/** Search queries that pull fresh repos in the areas you care about, plus a general "hot" query. */
export function buildQueries(profile, now = Date.now()) {
  return [
    ...profile.topics.slice(0, 10).map(([t]) => ({
      source: `topic:${t}`,
      q: `topic:${t} created:>${isoDaysAgo(now, 90)} stars:>=15`,
    })),
    // Fresh, still-small repos never make the top of a 90-day search, so look at the last week separately.
    ...profile.topics.slice(0, 10).map(([t]) => ({
      source: `topic:${t}`,
      q: `topic:${t} created:>${isoDaysAgo(now, 7)} stars:>=5`,
    })),
    ...profile.languages.slice(0, 4).map(([l]) => ({
      source: `lang:${l}`,
      q: `language:"${l}" created:>${isoDaysAgo(now, 30)} stars:>=30`,
    })),
    { source: 'hot', q: `created:>${isoDaysAgo(now, 7)} stars:>=50` },
  ];
}

export async function fetchCandidates(client, profile, { log = console.log, delayMs = 800 } = {}) {
  const byName = new Map();
  for (const { q, source } of buildQueries(profile)) {
    try {
      for (const repo of await client.search(q)) {
        const hit = byName.get(repo.full_name);
        if (hit) hit.sources.push(source);
        else byName.set(repo.full_name, { repo, sources: [source] });
      }
    } catch (err) {
      log(`search failed (${source}): ${err.message}`);
      if (err.status === 403 || err.status === 429) break; // rate limited; use what we have
    }
    await sleep(delayMs); // search API allows 30 req/min
  }
  return [...byName.values()];
}

function normalized(entries) {
  const max = entries[0]?.[1] || 1;
  return new Map(entries.map(([k, w]) => [k, w / max]));
}

/** Returns a function that scores a repo against the profile: relevance (fit) blended with momentum (stars/day). */
export function createScorer(profile) {
  const T = normalized(profile.topics);
  const L = normalized(profile.languages);
  const K = normalized(profile.keywords);

  return (repo, now = Date.now()) => {
    const topics = repo.topics ?? [];
    const matchedTopics = topics.filter((t) => T.has(t)).sort((a, b) => T.get(b) - T.get(a));
    const matchedKeywords = keywordsOf(repo.description)
      .filter((k) => K.has(k) && !topics.includes(k))
      .sort((a, b) => K.get(b) - K.get(a));

    const topicFit = squash(matchedTopics.reduce((s, t) => s + T.get(t), 0));
    const keywordFit = squash(0.7 * matchedKeywords.reduce((s, k) => s + K.get(k), 0));
    const languageFit = L.get(repo.language) ?? 0;
    const relevance = 0.55 * topicFit + 0.25 * languageFit + 0.2 * keywordFit;

    const ageDays = Math.max(1, (now - Date.parse(repo.created_at)) / DAY);
    const starsPerDay = repo.stargazers_count / ageDays;
    const momentum = Math.min(1, Math.log10(1 + starsPerDay) / 2); // 100 stars/day → 1

    return {
      score: 0.65 * relevance + 0.35 * momentum,
      relevance,
      momentum,
      starsPerDay,
      languageFit,
      matchedTopics: matchedTopics.slice(0, 4),
      matchedKeywords: matchedKeywords.slice(0, 3),
    };
  };
}

/** Starred repos sharing the most topics with `topics` — the "because you starred…" hint. */
export function similarStarred(topics, starredLite, n = 2) {
  if (!topics?.length) return [];
  const mine = new Set(topics);
  return starredLite
    .map((s) => {
      const shared = s.topics.filter((t) => mine.has(t)).length;
      return { name: s.name, shared, jaccard: shared / (mine.size + s.topics.length - shared || 1) };
    })
    .filter((s) => s.shared >= 2 && s.jaccard >= 0.2)
    .sort((a, b) => b.jaccard - a.jaccard)
    .slice(0, n)
    .map((s) => s.name);
}

/**
 * Drops clusters of look-alike repos: 3+ repos from different owners with the same name and
 * nearly identical star counts, or identical descriptions across owners, are almost always
 * mass-produced spam rather than organic projects.
 */
export function dropCloneClusters(candidates, { minCluster = 3, tolerance = 0.1 } = {}) {
  const byName = new Map();
  for (const c of candidates) {
    const key = c.repo.name.toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), c]);
  }
  const spam = new Set();
  for (const group of byName.values()) {
    if (new Set(group.map((c) => c.repo.owner?.login)).size < minCluster) continue;
    for (const c of group) {
      const alike = group.filter(
        (o) => Math.abs(o.repo.stargazers_count - c.repo.stargazers_count) <= tolerance * c.repo.stargazers_count,
      );
      if (alike.length >= minCluster) alike.forEach((o) => spam.add(o));
    }
  }
  // Same long description under different owners is a copy-paste spam signature. Forks are exempt.
  const byDescription = new Map();
  for (const c of candidates) {
    const d = c.repo.description?.toLowerCase().replace(/\s+/g, ' ').trim();
    if (c.repo.fork || !d || d.length < 30) continue;
    byDescription.set(d, [...(byDescription.get(d) ?? []), c]);
  }
  for (const group of byDescription.values()) {
    if (new Set(group.map((c) => c.repo.owner?.login)).size >= 2) group.forEach((c) => spam.add(c));
  }
  return candidates.filter((c) => !spam.has(c));
}

/** Skips archived repos and your own; forks only count once they're popular in their own right. */
export function isEligible(repo, viewerLogin, forkMinStars) {
  if (repo.archived || repo.owner?.login === viewerLogin) return false;
  return !repo.fork || repo.stargazers_count >= forkMinStars;
}

export function slimRepo(repo) {
  return {
    fullName: repo.full_name,
    isFork: Boolean(repo.fork),
    url: repo.html_url,
    description: repo.description,
    owner: repo.owner?.login,
    avatar: repo.owner?.avatar_url,
    homepage: repo.homepage || null,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    language: repo.language,
    topics: repo.topics ?? [],
    createdAt: repo.created_at,
    pushedAt: repo.pushed_at,
  };
}
