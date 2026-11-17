const $ = (sel) => document.querySelector(sel);
const DAY = 86_400_000;

const ui = { view: 'all', sort: 'score', q: '', facet: null }; // facet: { kind: 'topic'|'lang', value }
let data = null;
let pollTimer = null;

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

async function api(path, body) {
  const res = await fetch(path, body === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json;
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
    score: (a, b) => b.score - a.score,
    momentum: (a, b) => b.starsPerDay - a.starsPerDay,
    newest: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  }[ui.sort];
  return items.sort(by);
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

function card(item) {
  const matched = new Set(item.matchedTopics);
  const why = reasons(item);
  const match = Math.round(item.relevance * 100);
  return `
  <li class="card${item.dismissed ? ' is-dismissed' : ''}" data-name="${esc(item.fullName)}">
    <div class="card-head">
      <img class="avatar" src="${esc(item.avatar)}&s=64" alt="" loading="lazy" width="32" height="32" />
      <a class="name" href="${esc(item.url)}" target="_blank" rel="noopener">
        <span class="owner">${esc(item.owner)} /</span> ${esc(item.fullName.split('/')[1])}
      </a>
      ${isNew(item) ? '<span class="badge-new">New</span>' : ''}
      ${item.isFork ? '<span class="badge-fork" title="Popular fork">Fork</span>' : ''}
      <span class="match" title="How well this fits your stars">
        <span class="match-bar"><span style="width:${match}%"></span></span>${match}%
      </span>
    </div>
    ${item.description ? `<p class="desc">${esc(item.description)}</p>` : ''}
    ${why.length ? `<p class="why">Because ${why.join(' · ')}</p>` : ''}
    ${item.topics.length ? `<ul class="topics">${item.topics
      .slice(0, 8)
      .map((t) => `<li><button class="chip${matched.has(t) ? ' on' : ''}" data-topic="${esc(t)}">${esc(t)}</button></li>`)
      .join('')}</ul>` : ''}
    <div class="card-foot">
      <span class="stat" title="Stars">★ ${compact(item.stars)}</span>
      <span class="stat hot" title="Stars per day since creation">↗ ${compact(item.starsPerDay)}/day</span>
      ${item.language ? `<span class="stat">${esc(item.language)}</span>` : ''}
      <span class="stat muted">created ${ago(item.createdAt)}</span>
      <span class="spacer"></span>
      <button class="btn small${item.starred ? ' starred' : ''}" data-act="star">${item.starred ? '★ Starred' : '☆ Star'}</button>
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
    <p class="taste-intro">Learned from your <b>${p.starCount.toLocaleString()}</b> most recent stars. Recent stars count more.</p>
    ${block('Topics', p.topics.slice(0, 14), 'topic')}
    ${block('Languages', p.languages.slice(0, 6), 'lang')}`;
}

function render() {
  if (!data) return;
  const { viewer, lastRefresh, refreshing, lastError } = data;

  $('#status').textContent = refreshing
    ? 'Refreshing… scanning GitHub for repos you might like'
    : lastError
      ? `Last refresh failed: ${lastError}`
      : lastRefresh
        ? `Updated ${ago(lastRefresh)} · ${data.items.filter((i) => !i.dismissed).length} picks`
        : 'Not refreshed yet';
  $('#status').classList.toggle('error', Boolean(lastError) && !refreshing);
  $('#refresh').disabled = refreshing;
  $('#refresh').textContent = refreshing ? 'Refreshing…' : 'Refresh';

  if (viewer) {
    const me = $('#me');
    me.hidden = false;
    me.href = viewer.url;
    me.innerHTML = `<img src="${esc(viewer.avatar)}&s=64" alt="${esc(viewer.login)}" width="28" height="28" />`;
  }

  const newCount = data.items.filter((i) => !i.dismissed && isNew(i)).length;
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
  $('#feed').innerHTML = items.map(card).join('');
  const empty = $('#empty');
  empty.hidden = items.length > 0;
  empty.textContent = !data.lastRefresh
    ? 'Building your first feed. This takes about 20 seconds.'
    : ui.view === 'new'
      ? 'Nothing created in the last 48 hours matches your taste yet. Check back after the next refresh.'
      : ui.view === 'dismissed'
        ? 'Nothing dismissed.'
        : 'No repos match these filters.';

  clearTimeout(pollTimer);
  if (refreshing) pollTimer = setTimeout(load, 3000);
}

async function load() {
  try {
    data = await api('/api/feed');
    render();
  } catch (err) {
    $('#status').textContent = `Can't reach the server: ${err.message}`;
    $('#status').classList.add('error');
  }
}

let toastTimer;
function toast(html, onUndo) {
  const t = $('#toast');
  t.innerHTML = `<span>${html}</span>${onUndo ? '<button class="link">Undo</button>' : ''}`;
  t.hidden = false;
  if (onUndo) t.querySelector('button').onclick = () => { t.hidden = true; onUndo(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 5000);
}

async function setDismissed(item, dismissed) {
  item.dismissed = dismissed;
  render();
  try {
    await api('/api/dismiss', { fullName: item.fullName, undo: !dismissed });
  } catch (err) {
    item.dismissed = !dismissed;
    render();
    toast(`Couldn't update: ${esc(err.message)}`);
  }
}

async function setStarred(item, starred) {
  item.starred = starred;
  render();
  try {
    await api('/api/star', { fullName: item.fullName, undo: !starred });
    if (starred) toast(`Starred <b>${esc(item.fullName)}</b>`, () => setStarred(item, false));
  } catch (err) {
    item.starred = !starred;
    render();
    toast(`Couldn't star: ${esc(err.message)}`);
  }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('button');
  if (!el) return;

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

$('#refresh').onclick = async () => {
  data.refreshing = true;
  render();
  try {
    data = await api('/api/refresh', {});
  } catch (err) {
    toast(`Refresh failed: ${esc(err.message)}`);
  }
  render();
};

$('#q').oninput = (e) => {
  ui.q = e.target.value;
  render();
};
$('#sort').onchange = (e) => {
  ui.sort = e.target.value;
  render();
};

// Pick up background refreshes when you come back to the tab.
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && load());

load();
