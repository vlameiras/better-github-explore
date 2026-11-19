// Builds the daily feed for one GitHub account and writes it as JSON for the static site.
// Runs in GitHub Actions before each Pages deploy: node scripts/build-daily.mjs <login> <out.json>
// Uses the same code the page runs, with the workflow's token for the higher rate limits.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createClient } from '../public/lib/github.js';
import { buildFeed } from '../public/lib/feed.js';

const [login, out] = process.argv.slice(2);
if (!login || !out) {
  console.error('usage: node scripts/build-daily.mjs <login> <out.json>');
  process.exit(2);
}

const client = createClient({
  token: process.env.GITHUB_TOKEN,
  onWait: (until) => until && console.log(`waiting for the search limit until ${new Date(until).toISOString()}`),
});

const started = Date.now();
const user = await client.user(login);
const viewer = { login: user.login, avatar: user.avatar_url, url: user.html_url };
let last = 0;
const { profile, feed } = await buildFeed(client, {
  viewerLogin: user.login,
  starsOf: user.login,
  now: started,
  onProgress: ({ done, total }) => {
    if (done !== last && total) console.log(`search ${(last = done)}/${total}`);
  },
});

// An empty feed means the searches failed (e.g. rate limited); keep the previous one instead.
if (!feed.length) {
  console.error('No picks found; not writing a daily feed.');
  process.exit(1);
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({ version: 1, generatedAt: started, viewer, profile, feed }));
console.log(`${feed.length} picks from ${profile.starCount} stars in ${((Date.now() - started) / 1000).toFixed(1)}s → ${out}`);
