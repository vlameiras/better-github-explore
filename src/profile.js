export const DAY = 86_400_000;

/** Stars older than this count half as much toward your taste. */
const HALF_LIFE_DAYS = 180;
const MIN_WEIGHT = 0.15;

const STOPWORDS = new Set(
  `the and for with from that this your you are can into using use used based simple fast faster small
  tool tools library framework written built easy open source app apps not all any more most make makes
  like just new one way via its also than then them they their what when where which while who will
  about over under build building lets let get gets help helps run runs runner powered support supports
  collection list awesome curated project projects code modern lightweight minimal production ready
  best better official other own without within every each only very many much some such`
    .split(/\s+/)
    .filter(Boolean),
);

export function keywordsOf(text) {
  if (!text) return [];
  const words = text.toLowerCase().match(/[a-z][a-z0-9+#-]{2,}/g) ?? [];
  return [...new Set(words.map((w) => w.replace(/-+$/, '')).filter((w) => w.length >= 3 && !STOPWORDS.has(w)))];
}

function add(map, key, weight) {
  map.set(key, (map.get(key) ?? 0) + weight);
}

function top(map, n) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, w]) => [k, Math.round(w * 1000) / 1000]);
}

/**
 * Turns starred repos into weighted interests. Recent stars weigh more, and a repo with
 * many topics spreads its weight across them so one over-tagged repo can't dominate.
 */
export function buildProfile(stars, now = Date.now()) {
  const topics = new Map();
  const languages = new Map();
  const keywords = new Map();

  for (const { starredAt, repo } of stars) {
    const ageDays = Math.max(0, (now - Date.parse(starredAt)) / DAY);
    const w = Math.max(MIN_WEIGHT, 0.5 ** (ageDays / HALF_LIFE_DAYS));
    const repoTopics = repo.topics ?? [];
    for (const t of repoTopics) add(topics, t, w / Math.sqrt(repoTopics.length));
    if (repo.language) add(languages, repo.language, w);
    for (const k of keywordsOf(repo.description)) {
      if (!repoTopics.includes(k)) add(keywords, k, w * 0.5);
    }
  }

  return {
    starCount: stars.length,
    topics: top(topics, 60),
    languages: top(languages, 15),
    keywords: top(keywords, 120),
  };
}
