import { execFileSync } from 'node:child_process';

const API = 'https://api.github.com';
const REPO_NAME = /^[\w.-]+\/[\w.-]+$/;

export function getToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('No GitHub token found. Set GITHUB_TOKEN or run `gh auth login`.');
  }
}

export function assertRepoName(fullName) {
  if (typeof fullName !== 'string' || !REPO_NAME.test(fullName)) {
    throw Object.assign(new Error(`Invalid repository name: ${fullName}`), { status: 400 });
  }
  return fullName;
}

export function createClient(token) {
  async function request(path, { method = 'GET', accept = 'application/vnd.github+json' } = {}) {
    const res = await fetch(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: accept,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'better-github-explore',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw Object.assign(new Error(`GitHub ${method} ${path} → ${res.status}: ${body.slice(0, 200)}`), {
        status: res.status,
      });
    }
    return res.status === 204 ? null : res.json();
  }

  return {
    viewer: () => request('/user'),

    /** Most recently starred first, each as { starredAt, repo }. */
    async starred(limit) {
      const out = [];
      for (let page = 1; out.length < limit; page++) {
        const items = await request(`/user/starred?per_page=100&page=${page}&sort=created&direction=desc`, {
          accept: 'application/vnd.github.star+json',
        });
        for (const item of items) out.push({ starredAt: item.starred_at, repo: item.repo });
        if (items.length < 100) break;
      }
      return out.slice(0, limit);
    },

    async search(q, perPage = 30) {
      const params = new URLSearchParams({ q, sort: 'stars', order: 'desc', per_page: String(perPage) });
      return (await request(`/search/repositories?${params}`)).items;
    },

    star: (fullName) => request(`/user/starred/${assertRepoName(fullName)}`, { method: 'PUT' }),
    unstar: (fullName) => request(`/user/starred/${assertRepoName(fullName)}`, { method: 'DELETE' }),
  };
}
