import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { assertRepoName, createClient, getToken } from './src/github.js';
import { buildProfile, DAY } from './src/profile.js';
import { createScorer, dropCloneClusters, fetchCandidates, isEligible, similarStarred, slimRepo } from './src/recommend.js';
import { loadState, saveState } from './src/store.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT ?? 4321);
const HOST = '127.0.0.1'; // local only: the server acts with your GitHub token
const STATE_FILE = join(ROOT, 'data', 'state.json');
const STAR_LIMIT = Number(process.env.STAR_LIMIT ?? 1000);
const REFRESH_EVERY_MS = Number(process.env.REFRESH_HOURS ?? 6) * 3_600_000;
const FEED_SIZE = 150;
const FORK_MIN_STARS = Number(process.env.FORK_MIN_STARS ?? 200); // forks below this are hidden

const client = createClient(getToken());
const state = await loadState(STATE_FILE);
let refreshing = null;

async function doRefresh() {
  const started = Date.now();
  console.log('refresh: loading stars…');
  const viewer = await client.viewer();
  const stars = await client.starred(STAR_LIMIT);
  const profile = buildProfile(stars, started);
  console.log(`refresh: ${stars.length} stars → ${profile.topics.length} topics; searching…`);

  const starredNames = new Set(stars.map((s) => s.repo.full_name.toLowerCase()));
  const starredLite = stars
    .filter((s) => s.repo.topics?.length)
    .map((s) => ({ name: s.repo.full_name, topics: s.repo.topics }));
  const score = createScorer(profile);

  const feed = dropCloneClusters(await fetchCandidates(client, profile))
    .filter(({ repo }) => isEligible(repo, viewer.login, FORK_MIN_STARS))
    .filter(({ repo }) => !starredNames.has(repo.full_name.toLowerCase()))
    .map(({ repo, sources }) => ({ ...slimRepo(repo), sources, ...score(repo, started) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, FEED_SIZE)
    .map((item) => ({ ...item, similar: similarStarred(item.topics, starredLite) }));

  for (const item of feed) state.firstSeen[item.fullName] ??= started;
  // forget first-seen dates for repos that left the feed long ago
  const inFeed = new Set(feed.map((i) => i.fullName));
  for (const [name, ts] of Object.entries(state.firstSeen)) {
    if (!inFeed.has(name) && started - ts > 180 * DAY) delete state.firstSeen[name];
  }

  Object.assign(state, {
    viewer: { login: viewer.login, avatar: viewer.avatar_url, url: viewer.html_url },
    profile,
    feed,
    seenWatermark: state.seenWatermark ?? started, // first run: nothing is "new" yet
    lastRefresh: started,
    lastError: null,
  });
  await saveState(STATE_FILE, state);
  console.log(`refresh: done in ${((Date.now() - started) / 1000).toFixed(1)}s, ${feed.length} repos`);
}

function refresh() {
  refreshing ??= doRefresh()
    .catch(async (err) => {
      console.error('refresh failed:', err.message);
      state.lastError = err.message;
      await saveState(STATE_FILE, state);
    })
    .finally(() => (refreshing = null));
  return refreshing;
}

function feedPayload() {
  return {
    viewer: state.viewer,
    profile: state.profile,
    lastRefresh: state.lastRefresh,
    lastError: state.lastError,
    refreshing: Boolean(refreshing),
    seenWatermark: state.seenWatermark,
    items: state.feed.map((item) => ({
      ...item,
      firstSeen: state.firstSeen[item.fullName] ?? null,
      dismissed: item.fullName in state.dismissed,
    })),
  };
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10_000) throw Object.assign(new Error('Body too large'), { status: 413 });
  }
  return body ? JSON.parse(body) : {};
}

const api = {
  'GET /api/feed': () => feedPayload(),
  'POST /api/refresh': async () => {
    await refresh();
    return feedPayload();
  },
  'POST /api/seen': async () => {
    state.seenWatermark = Date.now();
    await saveState(STATE_FILE, state);
    return { seenWatermark: state.seenWatermark };
  },
  'POST /api/dismiss': async ({ fullName, undo }) => {
    assertRepoName(fullName);
    if (undo) delete state.dismissed[fullName];
    else state.dismissed[fullName] = Date.now();
    await saveState(STATE_FILE, state);
    return { ok: true };
  },
  'POST /api/star': async ({ fullName, undo }) => {
    await (undo ? client.unstar(fullName) : client.star(fullName));
    const item = state.feed.find((i) => i.fullName === fullName);
    if (item) item.starred = !undo;
    await saveState(STATE_FILE, state);
    return { ok: true };
  },
};

const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

const server = http.createServer(async (req, res) => {
  // Reject anything not addressed to localhost (guards against DNS rebinding).
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? '')) return send(res, 403, { error: 'Forbidden' });
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  try {
    const handler = api[`${req.method} ${pathname}`];
    if (handler) {
      if (req.method !== 'GET') {
        // Block cross-site requests: only same-origin JSON posts may star or dismiss.
        const origin = req.headers.origin;
        if ((origin && origin !== `http://${req.headers.host}`) || !req.headers['content-type']?.includes('json')) {
          return send(res, 403, { error: 'Forbidden' });
        }
      }
      return send(res, 200, await handler(req.method === 'GET' ? {} : await readJson(req)));
    }
    const asset = req.method === 'GET' && STATIC[pathname];
    if (asset) return send(res, 200, await readFile(join(ROOT, 'public', asset[0])), asset[1]);
    send(res, 404, { error: 'Not found' });
  } catch (err) {
    send(res, err.status && err.status < 500 ? err.status : 500, { error: err.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Better GitHub Explore → http://localhost:${PORT}`);
  const stale = () => !state.lastRefresh || Date.now() - state.lastRefresh > REFRESH_EVERY_MS;
  if (stale()) refresh();
  setInterval(() => stale() && refresh(), 15 * 60_000).unref();
});
