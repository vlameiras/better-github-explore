import { createClient } from './lib/github.js';
import { buildFeed } from './lib/feed.js';
import { createStore, parseHandle } from './lib/store.js';

const $ = (sel) => document.querySelector(sel);
const DAY = 86_400_000;

const NEW_VISIT_GAP = 30 * 60_000; // hidden longer than this → coming back is a new visit
const DEFAULTS = { starLimit: 1000, refreshHours: 6, forkMinStars: 200 };

const ui = { view: 'new', sort: 'score', q: '', facet: null }; // facet: { kind: 'topic'|'lang', value }
const store = createStore();

// Two modes, one page. Local (`npm start`): GitHub calls go through the server's token proxy, so
// private stars and starring work. Hosted (GitHub Pages): visitors first see the owner's daily
// feed, built ahead of time by GitHub Actions (daily.json), and can switch to their own handle,
// which is then scanned in the browser with public data.
let mode = { local: false, settings: DEFAULTS };
let client;
let daily = null; // the published daily feed, when the site has one
let account; // storage key: 'local', 'daily:<login>' or 'user:<login>'
let state; // persisted per account
let run = null; // while refreshing: { done, total, feed, waitUntil }
let data = null; // what render() draws, derived from state and run
let waitTicker = null;

// When the previous visit ended: null = first ever visit, undefined = not resolved yet.
// Held for the whole visit so the "seen" divider doesn't jump when you tab away to open a repo.
let baseline;
let hiddenAt = 0;

const session = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* storage unavailable: fine */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

function resolveBaseline() {
  if (baseline !== undefined) return;
  const saved = session.get('baseline');
  const left = Number(session.get('hiddenAt'));
  if (saved !== null && !(left && Date.now() - left > NEW_VISIT_GAP)) {
    baseline = saved === 'none' ? null : Number(saved);
    return;
  }
  baseline = state.lastVisit ?? null;
  session.set('baseline', baseline ?? 'none');
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const compact = (n) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k` : String(Math.round(n));

function ago(ts) {
  const d = (Date.now() - (typeof ts === 'number' ? ts : Date.parse(ts))) / DAY;
  if (d < 1 / 24) return 'just now';
  if (d < 1) return `${Math.round(d * 24)}h ago`;
  if (d < 60) return `${Math.round(d)}d ago`;
  return `${Math.round(d / 30)}mo ago`;
}

function save() {
  store.save(account, state);
}

const slimViewer = (u) => ({ login: u.login, avatar: u.avatar_url, url: u.html_url });

function describe(err) {
  if (err.resetAt) {
    const at = new Date(err.resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return mode.local
      ? `GitHub rate limit reached, try again after ${at}`
      : `GitHub's limit for requests without signing in is used up until ${at}`;
  }
  if (err instanceof TypeError) return "Can't reach GitHub";
  return err.message;
}

const isNew = (item) => Date.now() - Date.parse(item.createdAt) < 2 * DAY; // created in the last 48h

function visibleItems() {
  const q = ui.q.trim().toLowerCase();
  let items = data.items.filter((i) => (ui.view === 'dismissed' ? i.dismissed : !i.dismissed));
  if (ui.view === 'new') items = items.filter(isNew);
  if (ui.view === 'week') items = items.filter((i) => Date.now() - Date.parse(i.createdAt) < 7 * DAY);
  if (ui.facet?.kind === 'topic') items = items.filter((i) => i.topics.includes(ui.facet.value));
  if (ui.facet?.kind === 'lang') items = items.filter((i) => i.language === ui.facet.value);
  if (q) {
    items = items.filter((i) =>
      [i.fullName, i.description, i.language, ...i.topics].some((f) => f?.toLowerCase().includes(q)),
    );
  }
  const by = {
    score: (a, b) => b.score - a.score, // fit blended with momentum: the feed's own ranking
    match: (a, b) => b.relevance - a.relevance || b.score - a.score, // the "% match" shown on cards
    momentum: (a, b) => b.starsPerDay - a.starsPerDay,
    newest: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  }[ui.sort];
  return items.sort(by);
}

// New view: picks that arrived since the last visit first, then a divider, then the ones already seen.
function feedHtml(items) {
  if (ui.view !== 'new' || baseline == null) return items.map(card).join('');
  const arrived = items.filter((i) => Date.parse(i.createdAt) > baseline);
  const seen = items.filter((i) => Date.parse(i.createdAt) <= baseline);
  if (!seen.length) return arrived.map(card).join('');
  const label = arrived.length ? 'Seen on your last visit' : 'Nothing new since your last visit';
  const divider = `<li class="divider" role="separator"><span>${label} · ${ago(baseline)}</span></li>`;
  return arrived.map(card).join('') + divider + seen.map(card).join('');
}

function reasons(item) {
  const out = [];
  if (item.matchedTopics.length) out.push(`you follow <b>${item.matchedTopics.map(esc).join(', ')}</b>`);
  if (item.languageFit >= 0.3) out.push(`you star a lot of <b>${esc(item.language)}</b>`);
  if (item.matchedKeywords.length && item.matchedTopics.length < 2) {
    out.push(`mentions <b>${item.matchedKeywords.map(esc).join(', ')}</b>`);
  }
  if (item.similar.length) out.push(`like ${item.similar.map((s) => `<b>${esc(s)}</b>`).join(' and ')}`);
  if (!out.length && item.sources.includes('hot')) out.push('trending across GitHub this week');
  return out;
}

// Topics you follow first (they're the reason it's here), a few others for context, the rest as "+N".
function topicChips(item) {
  const matched = new Set(item.matchedTopics);
  const mine = item.topics.filter((t) => matched.has(t));
  const others = item.topics.filter((t) => !matched.has(t));
  const shown = [...mine, ...others.slice(0, 3)].slice(0, 6);
  const hidden = item.topics.filter((t) => !shown.includes(t));
  const chips = shown.map(
    (t) => `<li><button class="chip${matched.has(t) ? ' on' : ''}" data-topic="${esc(t)}">${esc(t)}</button></li>`,
  );
  if (hidden.length) chips.push(`<li class="chip-more" title="${esc(hidden.join(', '))}">+${hidden.length}</li>`);
  return chips.join('');
}

function card(item) {
  const why = reasons(item);
  const match = Math.round(item.relevance * 100);
  return `
  <li class="card${item.dismissed ? ' is-dismissed' : ''}" data-name="${esc(item.fullName)}">
    <div class="card-head">
      <img class="avatar" src="${esc(item.avatar)}&s=64" alt="" loading="lazy" width="32" height="32" />
      <a class="name" href="${esc(item.url)}" target="_blank" rel="noopener">
        <span class="owner">${esc(item.owner)} /</span> ${esc(item.fullName.split('/')[1])}
      </a>
      ${isNew(item) && ui.view !== 'new' ? '<span class="badge-new">New</span>' : ''}
      ${item.isFork ? '<span class="badge-fork" title="Popular fork">Fork</span>' : ''}
      <span class="match" title="How well this fits your stars">${match}% match</span>
    </div>
    ${item.description ? `<p class="desc">${esc(item.description)}</p>` : ''}
    ${why.length ? `<p class="why">Because ${why.join(' · ')}</p>` : ''}
    ${item.topics.length ? `<ul class="topics">${topicChips(item)}</ul>` : ''}
    <div class="card-foot">
      <span class="stat" title="Stars">★ ${compact(item.stars)}</span>
      <span class="stat hot" title="Stars per day since creation">↗ ${compact(item.starsPerDay)}/day</span>
      ${item.language ? `<span class="stat">${esc(item.language)}</span>` : ''}
      <span class="stat muted">created ${ago(item.createdAt)}</span>
      <span class="spacer"></span>
      ${
        mode.local
          ? `<button class="btn small${item.starred ? ' starred' : ''}" data-act="star">${item.starred ? '★ Starred' : '☆ Star'}</button>`
          : `<a class="btn small" href="${esc(item.url)}" target="_blank" rel="noopener" title="Starring needs you signed in on GitHub">☆ Star on GitHub</a>`
      }
      <button class="btn small ghost" data-act="dismiss">${item.dismissed ? 'Restore' : 'Not interested'}</button>
    </div>
  </li>`;
}

function renderTaste() {
  const p = data.profile;
  if (!p) return ($('#taste').innerHTML = '');
  const block = (title, entries, kind) => {
    const max = entries[0]?.[1] || 1;
    return `<section><h2>${title}</h2><ul class="bars">${entries
      .map(([name, w]) => {
        const active = ui.facet?.kind === kind && ui.facet.value === name;
        return `<li><button class="bar${active ? ' active' : ''}" data-${kind}="${esc(name)}">
          <span class="bar-fill" style="width:${Math.max(6, (w / max) * 100)}%"></span>
          <span class="bar-label">${esc(name)}</span></button></li>`;
      })
      .join('')}</ul></section>`;
  };
  $('#taste').innerHTML = `
    <p class="taste-intro">${
      p.starCount
        ? `Learned from ${whose()} <b>${p.starCount.toLocaleString()}</b> most recent stars. Recent stars count more.`
        : `${mode.local ? 'You have' : `<b>@${esc(data.viewer?.login)}</b> has`} no public stars yet, so this shows what’s trending.`
    }</p>
    ${block('Topics', p.topics.slice(0, 14), 'topic')}
    ${block('Languages', p.languages.slice(0, 6), 'lang')}`;
}


const viewingDaily = () => account?.startsWith('daily:');

const whose = () => (mode.local || !data.viewer ? 'your' : `<b>@${esc(data.viewer.login)}</b>’s`);

// The current feed for drawing. During the very first refresh, partial picks show as they arrive;
// later refreshes keep the previous feed on screen until the new one is complete.
function snapshot() {
  const showPartial = run?.feed && !state.feed.length;
  const feed = showPartial ? run.feed : state.feed;
  return {
    viewer: state.viewer,
    profile: (showPartial && run.profile) || state.profile,
    lastRefresh: state.lastRefresh,
    lastError: state.lastError,
    refreshing: Boolean(run),
    items: feed.map((item) => ({ ...item, dismissed: item.fullName in state.dismissed })),
  };
}

function renderStatus() {
  const { lastRefresh, refreshing, lastError } = data;
  const live = data.items.filter((i) => !i.dismissed);
  const newCount = live.filter(isNew).length;
  const wait = run?.waitUntil ? Math.max(0, Math.ceil((run.waitUntil - Date.now()) / 1000)) : 0;

  const prefix = viewingDaily() && !lastError ? `Daily picks from @${data.viewer.login} · ` : '';
  const text = refreshing
    ? wait
      ? `Waiting for GitHub’s search limit · resuming in ${wait}s`
      : run.total
        ? `Scanning GitHub · ${run.done} of ${run.total} searches`
        : 'Reading stars…'
    : lastError
      ? `Last refresh failed: ${lastError}`
      : lastRefresh
        ? `${ui.view === 'all' ? `${live.length} picks · ` : ''}${newCount ? `${newCount} new` : 'Nothing new'} · updated ${ago(lastRefresh)}`
        : 'Not refreshed yet';
  $('#status').textContent = prefix + text;
  $('#status').classList.toggle('error', Boolean(lastError) && !refreshing);
}

function render() {
  if (!state) return;
  data = snapshot();
  const { viewer, refreshing } = data;

  const newCount = data.items.filter((i) => !i.dismissed && isNew(i)).length;
  renderStatus();
  $('#slow-notice').hidden = !(refreshing && !mode.local);
  $('#refresh').disabled = refreshing;
  $('#refresh').textContent = refreshing ? 'Refreshing…' : 'Refresh';

  if (viewer) {
    const me = $('#me');
    me.hidden = false;
    me.href = viewer.url;
    me.innerHTML = `<img src="${esc(viewer.avatar)}&s=64" alt="${esc(viewer.login)}" width="28" height="28" />`;
    if (!mode.local) $('#switch').textContent = viewingDaily() ? 'Use your own stars' : `@${viewer.login}`;
  }

  $('#new-count').textContent = newCount || '';

  for (const b of document.querySelectorAll('#views button')) {
    b.setAttribute('aria-selected', String(b.dataset.view === ui.view));
  }

  const af = $('#active-filter');
  af.hidden = !ui.facet;
  if (ui.facet) {
    af.innerHTML = `Showing <b>${esc(ui.facet.value)}</b> <button class="link" data-clear-facet>clear</button>`;
  }

  renderTaste();

  const items = visibleItems();
  $('#feed').innerHTML = feedHtml(items);
  $('#end').hidden = !(ui.view === 'new' && items.length && !ui.q.trim() && !ui.facet);
  const empty = $('#empty');
  empty.hidden = items.length > 0;
  empty.textContent = !data.lastRefresh
    ? refreshing
      ? mode.local
        ? 'Building your first feed. This takes under a minute.'
        : 'Building the first feed. Picks appear here as they’re found.'
      : 'No feed yet. Press Refresh to build one.'
    : ui.view === 'new'
      ? 'Nothing created in the last 48 hours matches your taste yet. Check back after the next refresh.'
      : ui.view === 'dismissed'
        ? 'Nothing dismissed.'
        : 'No repos match these filters.';
}

function onWait(until) {
  if (!run) return;
  run.waitUntil = until;
  clearInterval(waitTicker);
  if (until) waitTicker = setInterval(() => (run?.waitUntil ? renderStatus() : clearInterval(waitTicker)), 1000);
  renderStatus();
}

// Daily feed: nothing to scan, just pick up the latest published file.
async function loadDaily() {
  try {
    const res = await fetch('daily.json', { cache: 'no-cache' });
    const json = res.ok ? await res.json() : null;
    return json?.feed && json.viewer ? json : null;
  } catch {
    return null;
  }
}

function applyDaily() {
  Object.assign(state, {
    viewer: daily.viewer,
    profile: daily.profile,
    feed: daily.feed,
    lastRefresh: daily.generatedAt,
    lastError: null,
    checkedAt: Date.now(),
  });
  save();
}

async function refreshDaily() {
  const latest = await loadDaily();
  if (latest) daily = latest;
  applyDaily();
  render();
}

async function refresh() {
  if (viewingDaily()) return refreshDaily();
  if (run) return;
  run = { done: 0, total: 0, feed: null, profile: null, waitUntil: 0 };
  render();
  try {
    // Hosted mode already looked the user up when the handle was entered; that saves a request.
    const viewer = mode.local || !state.viewer ? slimViewer(await (mode.local ? client.viewer() : client.user(store.handle()))) : state.viewer;
    const now = Date.now();
    const { profile, feed } = await buildFeed(client, {
      viewerLogin: viewer.login,
      starsOf: mode.local ? null : viewer.login,
      starLimit: mode.settings.starLimit,
      forkMinStars: mode.settings.forkMinStars,
      now,
      onProgress: (p) => {
        Object.assign(run, p);
        render();
      },
    });
    Object.assign(state, { viewer, profile, feed, lastRefresh: now, lastError: null });
  } catch (err) {
    console.error('refresh failed:', err);
    state.lastError = describe(err);
  } finally {
    run = null;
    clearInterval(waitTicker);
    save();
    render();
  }
}

const isStale = () =>
  viewingDaily()
    ? Date.now() - (state.checkedAt ?? 0) > 3_600_000 // look for a newer daily.json at most hourly
    : !state.lastRefresh || Date.now() - state.lastRefresh > mode.settings.refreshHours * 3_600_000;

let toastTimer;
function toast(html, onUndo) {
  const t = $('#toast');
  t.innerHTML = `<span>${html}</span>${onUndo ? '<button class="link">Undo</button>' : ''}`;
  t.hidden = false;
  if (onUndo) t.querySelector('button').onclick = () => { t.hidden = true; onUndo(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 5000);
}

function setDismissed(item, dismissed) {
  if (dismissed) state.dismissed[item.fullName] = Date.now();
  else delete state.dismissed[item.fullName];
  save();
  render();
}

async function setStarred(item, starred) {
  const stored = state.feed.find((i) => i.fullName === item.fullName);
  if (!stored) return;
  stored.starred = starred;
  render();
  try {
    await (starred ? client.star(item.fullName) : client.unstar(item.fullName));
    save();
    if (starred) toast(`Starred <b>${esc(item.fullName)}</b>`, () => setStarred(item, false));
  } catch (err) {
    stored.starred = !starred;
    render();
    toast(`Couldn't star: ${esc(describe(err))}`);
  }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('button');
  if (!el || !data) return;

  if (el.dataset.view) {
    ui.view = el.dataset.view;
    return render();
  }
  if ('clearFacet' in el.dataset) {
    ui.facet = null;
    return render();
  }
  if (el.dataset.topic || el.dataset.lang) {
    const facet = el.dataset.topic ? { kind: 'topic', value: el.dataset.topic } : { kind: 'lang', value: el.dataset.lang };
    const same = ui.facet?.kind === facet.kind && ui.facet.value === facet.value;
    ui.facet = same ? null : facet;
    return render();
  }

  const name = el.closest('.card')?.dataset.name;
  const item = name && data.items.find((i) => i.fullName === name);
  if (!item) return;
  if (el.dataset.act === 'star') setStarred(item, !item.starred);
  if (el.dataset.act === 'dismiss') {
    const dismissing = !item.dismissed;
    setDismissed(item, dismissing);
    if (dismissing) toast(`Hid <b>${esc(item.fullName)}</b>`, () => setDismissed(item, false));
  }
});

$('#refresh').onclick = () => refresh();

$('#q').oninput = (e) => {
  ui.q = e.target.value;
  render();
};
$('#sort').onchange = (e) => {
  ui.sort = e.target.value;
  render();
};

// Leaving the page stamps the visit. Coming back after a long gap starts a new one; a short
// trip to another tab (opening a repo) keeps the same divider. Also refreshes a stale feed.
document.addEventListener('visibilitychange', () => {
  if (!state) return;
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
    session.set('hiddenAt', String(hiddenAt));
    state.lastVisit = hiddenAt;
    save();
    return;
  }
  if (hiddenAt && Date.now() - hiddenAt > NEW_VISIT_GAP) {
    baseline = undefined;
    session.del('baseline');
    resolveBaseline();
  }
  if (isStale()) refresh();
  else render();
});

// --- Choosing whose stars to learn from (hosted mode) ---

function showSetup({ error, canCancel = false } = {}) {
  $('#setup').hidden = false;
  $('#app').hidden = true;
  $('#refresh').hidden = true;
  $('#switch').hidden = true;
  $('#me').hidden = true; // render() shows it again on the way back
  $('#setup-cancel').hidden = !canCancel;
  const backToDaily = $('#setup-daily');
  backToDaily.hidden = !daily || viewingDaily();
  if (daily) backToDaily.textContent = `Or browse @${daily.viewer.login}’s daily picks`;
  $('#status').textContent = 'Discovery ranked by GitHub stars';
  $('#status').classList.remove('error');
  const err = $('#setup-error');
  err.hidden = !error;
  err.textContent = error ?? '';
  const input = $('#handle');
  input.value = store.handle() ?? '';
  input.focus();
}

function showApp() {
  $('#setup').hidden = true;
  $('#app').hidden = false;
  $('#refresh').hidden = viewingDaily(); // the daily feed is rebuilt by GitHub Actions, not here
  $('#own-banner').hidden = !viewingDaily();
  if (viewingDaily()) $('#own-owner').textContent = `@${daily.viewer.login}`;
  $('#switch').hidden = mode.local;
}

$('#switch').onclick = () => showSetup({ canCancel: true });
$('#setup-daily').onclick = () => {
  store.setHandle(null);
  location.reload();
};
$('#setup-cancel').onclick = () => {
  showApp();
  render();
};

// Both handle forms (the setup screen and the banner on the daily feed) work the same way.
async function submitHandle(form) {
  const input = form.querySelector('input');
  const button = form.querySelector('button[type=submit]');
  const error = form.querySelector('[role=alert]');
  const fail = (msg) => {
    error.hidden = false;
    error.textContent = msg;
    button.disabled = false;
  };
  const handle = parseHandle(input.value);
  if (!handle) return fail('That doesn’t look like a GitHub username.');
  button.disabled = true;
  try {
    const user = await client.user(handle);
    if (user.type === 'Organization') return fail(`@${user.login} is an organization. Organizations can’t star repos; try a person’s account.`);
    const key = `user:${user.login.toLowerCase()}`;
    const saved = store.load(key);
    saved.viewer = slimViewer(user);
    store.save(key, saved);
    store.setHandle(user.login);
    // Reload so any refresh still running for the previous account stops cleanly.
    location.reload();
  } catch (err) {
    fail(err.status === 404 ? `There’s no GitHub user called @${handle}.` : describe(err));
  }
}

for (const form of [$('#setup-form'), $('#own-form')]) {
  form.onsubmit = (e) => {
    e.preventDefault();
    submitHandle(form);
  };
}

// --- Start ---

async function detectMode() {
  try {
    const res = await fetch('local.json', { cache: 'no-store' });
    if (res.ok) return await res.json(); // only the local server answers this
  } catch {
    /* static hosting */
  }
  return { local: false };
}

function openAccount(key) {
  account = key;
  state = store.load(account);
  resolveBaseline();
  showApp();
  render();
  if (isStale()) refresh();
}

async function boot() {
  const found = await detectMode();
  mode = { ...found, settings: { ...DEFAULTS, ...found.settings } };
  client = createClient(mode.local ? { base: 'gh', onWait } : { onWait });

  if (mode.local) {
    // One-time carry-over from when the server kept the feed in data/state.json.
    if (!store.has('local') && found.legacy) {
      const { feed, profile, viewer, dismissed, lastRefresh, lastVisit } = found.legacy;
      store.save('local', { feed, profile, viewer, dismissed, lastRefresh, lastVisit });
    }
    return openAccount('local');
  }

  daily = await loadDaily();
  const handle = store.handle();
  if (handle) return openAccount(`user:${handle.toLowerCase()}`);
  if (!daily) return showSetup();
  account = `daily:${daily.viewer.login.toLowerCase()}`;
  state = store.load(account);
  applyDaily();
  resolveBaseline();
  showApp();
  render();
}

boot();
