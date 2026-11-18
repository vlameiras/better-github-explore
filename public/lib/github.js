const REPO_NAME = /^[\w.-]+\/[\w.-]+$/;
const MAX_SEARCH_WAIT_MS = 90_000; // the search limit resets every minute, so longer means something is off

export function assertRepoName(fullName) {
  if (typeof fullName !== 'string' || !REPO_NAME.test(fullName)) {
    throw Object.assign(new Error(`Invalid repository name: ${fullName}`), { status: 400 });
  }
  return fullName;
}

/**
 * GitHub REST client that runs in the browser. `base` is either api.github.com (public data,
 * no token) or the local server's `gh` proxy, which adds your token on the way through.
 *
 * Search has its own rate limit (10/min without a token, 30/min with one). The client tracks it
 * from response headers and waits for the reset instead of failing; `onWait(untilMs)` reports
 * the pause (0 when it ends) so the page can say what's happening.
 */
export function createClient({ base = 'https://api.github.com', onWait = () => {}, sleep } = {}) {
  sleep ??= (ms) => new Promise((r) => setTimeout(r, ms));
  const searchLimit = { remaining: Infinity, reset: 0 };

  async function request(path, { method = 'GET', accept = 'application/vnd.github+json' } = {}) {
    // Only safelisted headers, so cross-origin GETs to api.github.com need no CORS preflight.
    const res = await fetch(base + path, { method, headers: { Accept: accept } });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        detail = (await res.json()).message ?? detail;
      } catch {
        /* not JSON */
      }
      const err = Object.assign(new Error(`GitHub ${res.status}: ${detail}`), { status: res.status });
      if (res.headers.get('x-ratelimit-remaining') === '0') {
        err.resetAt = Number(res.headers.get('x-ratelimit-reset')) * 1000;
      }
      throw err;
    }
    return { body: res.status === 204 ? null : await res.json(), headers: res.headers };
  }

  const get = async (path, opts) => (await request(path, opts)).body;

  async function search(q, perPage = 30) {
    const params = new URLSearchParams({ q, sort: 'stars', order: 'desc', per_page: String(perPage) });
    let retried = false;
    for (;;) {
      const wait = searchLimit.remaining <= 0 ? searchLimit.reset - Date.now() + 1000 : 0;
      if (wait > MAX_SEARCH_WAIT_MS) {
        throw Object.assign(new Error('GitHub search rate limit reached'), { status: 429, resetAt: searchLimit.reset });
      }
      if (wait > 0) {
        onWait(Date.now() + wait);
        await sleep(wait);
        onWait(0);
        if (searchLimit.remaining <= 0) searchLimit.remaining = Infinity; // a new window; headers will correct it
      }
      searchLimit.remaining--; // claim a slot so parallel searches don't all fire at the last one
      try {
        const { body, headers } = await request(`/search/repositories?${params}`);
        const remaining = headers.get('x-ratelimit-remaining');
        if (remaining !== null) {
          searchLimit.remaining = Number(remaining);
          searchLimit.reset = Number(headers.get('x-ratelimit-reset')) * 1000;
        }
        return body.items;
      } catch (err) {
        // Another tab (or a previous page load) used up the limit: wait for the reset once, then retry.
        if (err.resetAt && !retried) {
          retried = true;
          Object.assign(searchLimit, { remaining: 0, reset: err.resetAt });
          continue;
        }
        throw err;
      }
    }
  }

  return {
    /** The token's owner (local mode only). */
    viewer: () => get('/user'),
    user: (login) => get(`/users/${encodeURIComponent(login)}`),

    /**
     * Most recently starred first, each as { starredAt, repo }. Without `login`, the token owner's
     * stars. The first page's Link header says how many pages there are; the rest load in parallel.
     */
    async starred(limit, login) {
      const path = login ? `/users/${encodeURIComponent(login)}/starred` : '/user/starred';
      const page = (n) =>
        request(`${path}?per_page=100&page=${n}&sort=created&direction=desc`, {
          accept: 'application/vnd.github.star+json',
        });
      const first = await page(1);
      const lastUrl = first.headers.get('link')?.match(/<([^>]+)>;\s*rel="last"/)?.[1];
      const lastPage = lastUrl ? Number(new URL(lastUrl).searchParams.get('page')) || 1 : 1;
      const wanted = Math.min(lastPage, Math.ceil(limit / 100));
      const rest = await Promise.all(Array.from({ length: Math.max(0, wanted - 1) }, (_, i) => page(i + 2)));
      return [first, ...rest]
        .flatMap((r) => r.body)
        .map((item) => ({ starredAt: item.starred_at, repo: item.repo }))
        .slice(0, limit);
    },

    search,
    star: (fullName) => request(`/user/starred/${assertRepoName(fullName)}`, { method: 'PUT' }),
    unstar: (fullName) => request(`/user/starred/${assertRepoName(fullName)}`, { method: 'DELETE' }),
  };
}
