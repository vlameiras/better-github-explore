import { buildProfile } from './profile.js';
import { createScorer, dropCloneClusters, fetchCandidates, isEligible, similarStarred, slimRepo } from './recommend.js';

export const FEED_SIZE = 150;

/** Returns a function that turns raw search candidates into the ranked, filtered feed. */
export function createRanker(stars, profile, viewerLogin, { now = Date.now(), forkMinStars = 200, size = FEED_SIZE } = {}) {
  const starredNames = new Set(stars.map((s) => s.repo.full_name.toLowerCase()));
  const starredLite = stars
    .filter((s) => s.repo.topics?.length)
    .map((s) => ({ name: s.repo.full_name, topics: s.repo.topics }));
  const score = createScorer(profile);

  return (candidates) =>
    dropCloneClusters(candidates)
      .filter(({ repo }) => isEligible(repo, viewerLogin, forkMinStars))
      .filter(({ repo }) => !starredNames.has(repo.full_name.toLowerCase()))
      .map(({ repo, sources }) => ({ ...slimRepo(repo), sources, ...score(repo, now) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, size)
      .map((item) => ({ ...item, similar: similarStarred(item.topics, starredLite) }));
}

/**
 * Reads the stars, builds the taste profile and searches for picks. `starsOf` is a login for
 * public stars, or null for the token owner's own (local mode). `onProgress` gets the partial
 * feed after each search.
 */
export async function buildFeed(
  client,
  { viewerLogin, starsOf = null, starLimit = 1000, forkMinStars = 200, now = Date.now(), onProgress = () => {} },
) {
  const stars = await client.starred(starLimit, starsOf);
  const profile = buildProfile(stars, now);
  const rank = createRanker(stars, profile, viewerLogin, { now, forkMinStars });
  onProgress({ profile, feed: [], done: 0, total: 0 });
  const candidates = await fetchCandidates(client, profile, {
    onProgress: (sofar, done, total) => onProgress({ profile, feed: rank(sofar), done, total }),
  });
  return { profile, feed: rank(candidates) };
}
