const EMPTY = {
  viewer: null,
  profile: null,
  feed: [],
  dismissed: {}, // fullName → ms timestamp
  lastRefresh: null,
  lastError: null,
  lastVisit: null, // ms timestamp of when the page was last left
};

const HANDLE_KEY = 'bge:handle';
const stateKey = (account) => `bge:state:${account}`;
const GITHUB_LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/** Accepts "octocat", "@octocat" or a github.com profile URL; returns the login or null. */
export function parseHandle(input) {
  let s = String(input ?? '').trim().replace(/^@/, '');
  const url = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)/i);
  if (url) s = url[1];
  return GITHUB_LOGIN.test(s) ? s : null;
}

/**
 * Per-account state in localStorage. Every access is guarded: storage can be missing or throw
 * (private windows, blocked site data), and the page must still work, just without memory.
 */
export function createStore(storage = globalThis.localStorage) {
  const get = (k) => {
    try {
      return storage?.getItem(k) ?? null;
    } catch {
      return null;
    }
  };
  const set = (k, v) => {
    try {
      storage.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  };
  const del = (k) => {
    try {
      storage.removeItem(k);
    } catch {
      /* ignore */
    }
  };

  return {
    handle: () => get(HANDLE_KEY),
    setHandle: (h) => (h ? set(HANDLE_KEY, h) : del(HANDLE_KEY)),
    has: (account) => get(stateKey(account)) !== null,
    load(account) {
      try {
        return { ...structuredClone(EMPTY), ...JSON.parse(get(stateKey(account))) };
      } catch {
        return structuredClone(EMPTY);
      }
    },
    save: (account, state) => set(stateKey(account), JSON.stringify(state)),
  };
}
