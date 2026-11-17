import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

const EMPTY = {
  viewer: null,
  profile: null,
  feed: [],
  firstSeen: {}, // fullName → ms timestamp it first showed up in the feed
  dismissed: {}, // fullName → ms timestamp
  seenWatermark: null, // items first seen after this are "new"
  lastRefresh: null,
  lastError: null,
};

export async function loadState(file) {
  try {
    return { ...EMPTY, ...JSON.parse(await readFile(file, 'utf8')) };
  } catch (err) {
    if (err.code === 'ENOENT') return structuredClone(EMPTY);
    throw err;
  }
}

export async function saveState(file, state) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(state));
  await rename(tmp, file); // atomic, so a crash mid-write can't corrupt the state
}
