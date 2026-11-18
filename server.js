// Local mode: serves the same static site that GitHub Pages hosts, plus a `/gh/*` proxy that adds
// your GitHub token. The browser does all the work; the token never reaches the page.
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize } from 'node:path';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const LEGACY_STATE_FILE = join(ROOT, 'data', 'state.json'); // from before the feed moved into the browser
const PORT = Number(process.env.PORT ?? 4321);
const HOST = '127.0.0.1'; // local only: the proxy acts with your GitHub token
const API = 'https://api.github.com';

const SETTINGS = {
  starLimit: Number(process.env.STAR_LIMIT ?? 1000),
  refreshHours: Number(process.env.REFRESH_HOURS ?? 6),
  forkMinStars: Number(process.env.FORK_MIN_STARS ?? 200),
};

function getToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('No GitHub token found. Set GITHUB_TOKEN or run `gh auth login`.');
  }
}
const TOKEN = getToken();

// Only what the app needs, so nothing else on this machine can borrow the token for other calls.
const STAR_PATH = /^\/user\/starred\/[\w.-]+\/[\w.-]+$/;
const PROXY_ROUTES = [
  ['GET', /^\/user$/],
  ['GET', /^\/user\/starred$/],
  ['GET', /^\/search\/repositories$/],
  ['PUT', STAR_PATH],
  ['DELETE', STAR_PATH],
];
const ACCEPTS = new Set(['application/vnd.github+json', 'application/vnd.github.star+json']);
const FORWARDED = ['content-type', 'link','x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'x-ratelimit-resource'];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

async function proxy(req, res, url) {
  const path = url.pathname.slice('/gh'.length);
  if (!PROXY_ROUTES.some(([method, re]) => method === req.method && re.test(path))) {
    return send(res, 404, { message: 'Not proxied' });
  }
  // Block cross-site writes: only this page may star or unstar.
  const origin = req.headers.origin;
  if (req.method !== 'GET' && origin && origin !== `http://${req.headers.host}`) {
    return send(res, 403, { message: 'Forbidden' });
  }
  const upstream = await fetch(API + path + url.search, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: ACCEPTS.has(req.headers.accept) ? req.headers.accept : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'better-github-explore',
    },
  });
  const headers = { 'Cache-Control': 'no-store' };
  for (const h of FORWARDED) {
    const v = upstream.headers.get(h);
    if (v) headers[h] = v;
  }
  res.writeHead(upstream.status, headers);
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

/** Tells the page it runs locally. Includes the old server-side state once, so nothing is lost. */
async function localConfig() {
  let legacy = null;
  try {
    legacy = JSON.parse(await readFile(LEGACY_STATE_FILE, 'utf8'));
  } catch {
    /* no old state */
  }
  return { local: true, settings: SETTINGS, legacy };
}

async function serveStatic(res, pathname) {
  const file = normalize(join(PUBLIC, pathname === '/' ? 'index.html' : decodeURIComponent(pathname)));
  const type = TYPES[extname(file)];
  if (!file.startsWith(PUBLIC + '/') || !type) return send(res, 404, { message: 'Not found' });
  try {
    send(res, 200, await readFile(file), type);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') return send(res, 404, { message: 'Not found' });
    throw err;
  }
}

const server = http.createServer(async (req, res) => {
  // Reject anything not addressed to localhost (guards against DNS rebinding).
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? '')) return send(res, 403, { message: 'Forbidden' });
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/gh/')) return await proxy(req, res, url);
    if (req.method !== 'GET') return send(res, 405, { message: 'Method not allowed' });
    if (url.pathname === '/local.json') return send(res, 200, await localConfig());
    await serveStatic(res, url.pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 502, { message: err.message });
  }
});

server.listen(PORT, HOST, () => console.log(`Better GitHub Explore → http://localhost:${PORT}`));
