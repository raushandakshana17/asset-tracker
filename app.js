import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, getDoc, deleteDoc, onSnapshot, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import * as L from './logic.js';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  sort: '<path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3"/>',
  box: '<path d="M4 5h16v4H4zM6 9v10h12V9M10 13h4"/>',
  undo: '<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M12 11v5M9.5 13.5h5"/>',
};
const ic = (n, s = 22) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const ICONS = ['🍳', '👕', '👟', '💻', '🛋️', '🔌', '📚', '🧰', '🎒', '🧴', '🚲', '🎮', '🛏️', '🍽️', '🚿', '🚗', '🪴', '🧺', '🏠', '📦'];
const KIND = { collection: { label: 'collection', Label: 'Collection', def: '📁' }, location: { label: 'location', Label: 'Location', def: '📍' } };

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- firebase ---------- */
const configured = firebaseConfig && firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith('YOUR_');
let auth, db;
if (configured) {
  const fb = initializeApp(firebaseConfig);
  auth = getAuth(fb);
  db = initializeFirestore(fb, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
}

const S = {
  user: undefined, groups: [], assets: [], gReady: false, aReady: false,
  sort: localStorage.getItem('sort') || 'recent', q: '', status: 'all', inc: false,
  imgCache: {}, installEv: null, form: { img: null, thumb: null, removed: false },
};
let unsubs = [];
const colRef = (n) => collection(db, 'users', S.user.uid, n);
const docRef = (n, id) => doc(db, 'users', S.user.uid, n, id);
const upsert = (list, item) => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i > -1) list[i] = { ...list[i], ...item }; else list.push(item);
};
const fail = (e) => { console.error(e); toast('Couldn’t save. Check your connection and try again.'); };

function listen() {
  unsubs.forEach((u) => u());
  unsubs = [];
  S.gReady = S.aReady = false;
  S.groups = []; S.assets = [];
  if (!S.user) return;
  unsubs.push(onSnapshot(colRef('groups'), (snap) => {
    S.groups = snap.docs.map((d) => ({ id: d.id, kind: 'collection', ...d.data() }));
    S.gReady = true; onData();
  }, fail));
  unsubs.push(onSnapshot(colRef('assets'), (snap) => {
    S.assets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    S.aReady = true; onData();
  }, fail));
}

if (configured) {
  onAuthStateChanged(auth, (u) => { S.user = u; listen(); render(); });
}

/* ---------- routing ---------- */
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/');
  return { name: parts[0] || 'home', id: parts[1], params: new URLSearchParams(qs || '') };
}
const isForm = () => ['add', 'edit'].includes(route().name);
function onData() { if (!S.rendered || !isForm()) render(); }
window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0, 0); });
const go = (h) => { location.hash = h; };

/* ---------- small view helpers ---------- */
const groupEmoji = (id) => (id && L.byId(S.groups, id) ? L.byId(S.groups, id).icon || KIND[L.byId(S.groups, id).kind]?.def : null);
function thumb(a) {
  if (a.thumb) return `<div class="thumb"><img src="${a.thumb}" alt="" loading="lazy"></div>`;
  return `<div class="thumb">${groupEmoji(a.collectionId) || groupEmoji(a.locationId) || '📦'}</div>`;
}
function assetRow(a) {
  const ret = L.isRetired(a);
  const place = [a.locationId, a.collectionId].map((id) => (id && L.byId(S.groups, id) ? L.byId(S.groups, id).name : '')).filter(Boolean).join(' · ');
  const sub = [a.brand, place].filter(Boolean).join(' · ') || 'No location or parent';
  const qty = Number(a.qty) || 1;
  return `<a class="row${ret ? ' ret' : ''}" href="#/a/${a.id}">${thumb(a)}
    <div class="rb"><p class="rt">${esc(a.name)}${ret ? '<span class="pill ret">Retired</span>' : ''}</p><p class="rs">${esc(sub)}</p></div>
    <div class="rp"><p class="rv">${L.inr(L.lineValue(a))}</p><p class="rs">${qty > 1 ? `${qty} × ${L.inr(a.price)}` : (ret ? 'not counted' : '')}</p></div></a>`;
}
function assetList(list, emptyMsg) {
  if (!list.length) return `<div class="empty big"><div class="em">📦</div><div><b>${esc(emptyMsg[0])}</b><small>${esc(emptyMsg[1])}</small></div></div>`;
  const sorted = L.sortAssets(list, S.sort);
  let html = '', sep = false;
  for (const a of sorted) {
    if (L.isRetired(a) && !sep) { html += '<p class="divider">Retired · not counted in value</p>'; sep = true; }
    html += assetRow(a);
  }
  return `<div class="list">${html}</div>`;
}
function sortControl() {
  const cur = L.SORTS.find((s) => s[0] === S.sort) || L.SORTS[0];
  return `<label class="sort"><span class="sr">Sort assets</span><span class="ic-box">${ic('sort', 20)}</span>
    <select data-act="sort" aria-label="Sort assets">${L.SORTS.map(([k, l]) => `<option value="${k}"${S.sort === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
}
const sortNote = () => `<p class="sortlabel">Sorted by ${esc((L.SORTS.find((s) => s[0] === S.sort) || L.SORTS[0])[1].toLowerCase())}. Retired items stay at the bottom.</p>`;
const topbar = ({ title, back, right = '' }) => `<header class="top">${back ? `<button class="ib" data-act="back" aria-label="Back">${ic('back')}</button>` : ''}<h1 class="${back ? 'sm' : ''}">${title}</h1>${right || (back ? '<span style="width:40px"></span>' : '')}</header>`;
function tile(g) {
  const r = L.rollup(S.assets, S.groups, g.id);
  return `<a class="tile" href="#/g/${g.id}"><span class="em">${g.icon || KIND[g.kind].def}</span><div><b>${esc(g.name)}</b><small>${r.count} item${r.count === 1 ? '' : 's'} · ${L.inrShort(r.value)}</small></div></a>`;
}
function groupSection(kind) {
  const k = KIND[kind];
  const tops = S.groups.filter((g) => g.kind === kind && !g.parentId).sort((a, b) => a.name.localeCompare(b.name));
  const heading = `<div class="sec-h"><h2>${kind === 'collection' ? 'Collections' : 'Locations'}</h2></div>`;
  if (!tops.length) {
    return heading + `<div class="empty"><div class="em">${k.def}</div><div><b>${kind === 'collection' ? 'Start your first collection' : 'Add your first location'}</b><small>${kind === 'collection' ? 'Group things like clothes or electronics.' : 'Rooms or places where things are kept.'}</small></div><button class="btn sm" data-act="newgroup" data-kind="${kind}">Create</button></div>`;
  }
  return heading + `<div class="grid">${tops.map(tile).join('')}<button class="tile add" data-act="newgroup" data-kind="${kind}"><span class="em">${ic('plus', 20)}</span>New ${k.label}</button></div>`;
}

/* ---------- views ---------- */
function homeView() {
  const t = L.totals(S.assets);
  const recent = L.sortAssets(S.assets, 'recent').slice(0, 5);
  return `${topbar({ title: 'My assets', right: `<a class="ib" href="#/settings" aria-label="Settings">${ic('gear')}</a>` })}
  <section class="hero"><p class="lab">Total value</p><p class="num">${L.inr(t.value)}</p>
    <p class="sub">${t.count} active item${t.count === 1 ? '' : 's'}</p>
    ${t.retired ? `<span class="retnote">${t.retired} retired · not counted</span>` : ''}</section>
  ${groupSection('collection')}${groupSection('location')}
  <div class="sec-h"><h2>Recently added</h2>${S.assets.length ? '<a class="meta" href="#/all">See all</a>' : ''}</div>
  ${S.assets.length ? assetList(recent, ['', '']) : `<div class="empty big"><div class="em">📦</div><div><b>No assets yet</b><small>Add your first one. You can place it in a location, a collection, both, or neither.</small></div><a class="btn primary" href="#/add">Add your first asset</a></div>`}`;
}

function allView() {
  const f = S.assets.filter((a) => L.matches(a, S.q, S.groups) && (S.status === 'all' || (S.status === 'retired') === L.isRetired(a)));
  const chip = (k, l) => `<button class="chip${S.status === k ? ' on' : ''}" data-act="filter" data-v="${k}">${l}</button>`;
  return `${topbar({ title: 'All assets' })}
  <div class="tools"><input id="q" class="search" type="search" placeholder="Search name, brand, or place" value="${esc(S.q)}" aria-label="Search assets">${sortControl()}</div>
  <div class="chips">${chip('all', 'All')}${chip('active', 'Active')}${chip('retired', 'Retired')}</div>
  ${sortNote()}<div id="allList">${assetList(f, S.assets.length ? ['No matches', 'Try a different search or filter.'] : ['No assets yet', 'Tap the + button to add one.'])}</div>`;
}

function groupView(id) {
  const g = L.byId(S.groups, id);
  if (!g) return `${topbar({ title: 'Not found', back: true })}${notFound('That folder no longer exists.')}`;
  const r = L.rollup(S.assets, S.groups, id);
  const subs = S.groups.filter((x) => x.parentId === id).sort((a, b) => a.name.localeCompare(b.name));
  const list = L.assetsIn(S.assets, S.groups, id, S.inc);
  const crumbs = L.pathIds(S.groups, id);
  const k = KIND[g.kind];
  return `${topbar({ title: `${g.icon || k.def} ${esc(g.name)}`, back: true, right: `<button class="ib" data-act="groupmenu" data-id="${id}" aria-label="More actions">${ic('dots')}</button>` })}
  <p class="crumbs"><a href="#/">Home</a>${crumbs.map((c, i) => ` › ${i === crumbs.length - 1 ? esc(L.byId(S.groups, c).name) : `<a href="#/g/${c}">${esc(L.byId(S.groups, c).name)}</a>`}`).join('')}</p>
  <div class="stat"><div><b>${L.inr(r.value)}</b><small>value</small></div><div><b>${r.count}</b><small>active item${r.count === 1 ? '' : 's'}</small></div>${r.retired ? `<div><b style="color:var(--ret-ink)">${r.retired}</b><small>retired</small></div>` : ''}</div>
  <div class="sec-h"><h2>Inside ${esc(g.name)}</h2></div>
  ${subs.length ? `<div class="grid" style="margin-bottom:6px">${subs.map(tile).join('')}<button class="tile add" data-act="newgroup" data-kind="${g.kind}" data-parent="${id}"><span class="em">${ic('plus', 20)}</span>New sub-${k.label}</button></div>`
    : `<button class="btn sm ghost" data-act="newgroup" data-kind="${g.kind}" data-parent="${id}">${ic('plus', 16)} New sub-${k.label}</button>`}
  <div class="sec-h"><h2>Assets</h2><div class="tools" style="margin:0">${subs.length ? `<button class="chip${S.inc ? ' on' : ''}" data-act="toggleinc">Include sub-${k.label}s</button>` : ''}${sortControl()}</div></div>
  ${sortNote()}${assetList(list, ['Nothing here yet', `Tap + to add an asset to ${g.name}.`])}`;
}

function notFound(msg) { return `<div class="empty big"><div class="em">🔍</div><div><b>Not found</b><small>${esc(msg)}</small></div><a class="btn" href="#/">Go home</a></div>`; }

function assetView(id) {
  const a = L.byId(S.assets, id);
  if (!a) return `${topbar({ title: 'Not found', back: true })}${notFound('This asset may have been deleted.')}`;
  const ret = L.isRetired(a);
  const link = (gid) => (gid && L.byId(S.groups, gid) ? `<a href="#/g/${gid}">${esc(L.groupPath(S.groups, gid))}</a>` : '');
  const w = L.warrantyInfo(a.warrantyUntil);
  const rows = [
    ['Location', link(a.locationId)], ['Parent', link(a.collectionId)], ['Brand', esc(a.brand)],
    ['Purchase date', L.fmtDate(a.purchaseDate)], ['Price per unit', a.price !== null && a.price !== undefined ? L.inr(a.price) : ''],
    ['Quantity', Number(a.qty) || 1],
    ['Total value', ret ? '<span style="color:var(--ret-ink)">Not counted (retired)</span>' : L.inr(L.lineValue(a))],
    ['Warranty until', L.fmtDate(a.warrantyUntil)], ['Notes', esc(a.notes)],
  ].filter(([, v]) => v !== '' && v !== null && v !== undefined);
  const cached = S.imgCache[id] || a.thumb;
  return `${topbar({ title: '', back: true, right: `<div style="display:flex"><a class="ib" href="#/edit/${id}" aria-label="Edit asset">${ic('edit')}</a><button class="ib danger" data-act="delasset" data-id="${id}" aria-label="Delete asset">${ic('trash')}</button></div>` }).replace('<h1 class="sm"></h1>', '<span></span>')}
  <div class="heroimg${ret ? ' ret' : ''}" id="hero">${cached ? `<img src="${cached}" alt="${esc(a.name)}">` : (groupEmoji(a.collectionId) || groupEmoji(a.locationId) || '📦')}</div>
  <h1 class="title">${esc(a.name)}</h1>
  ${ret ? `<div class="banner"><b>Retired${a.retireReason ? ` · ${esc(a.retireReason)}` : ''}${a.retiredOn ? ` · ${L.fmtDate(a.retiredOn)}` : ''}</b>This asset isn’t counted in your total value.</div>`
    : (w ? `<span class="pill ${w.state === 'active' ? 'ok' : 'warn'}">${esc(w.text)}</span>` : '')}
  <div style="margin-top:6px">${rows.map(([k, v]) => `<div class="kv"><span>${k}</span><span>${v}</span></div>`).join('')}</div>
  <div class="acts">${ret
    ? `<button class="btn" data-act="reactivate" data-id="${id}">${ic('undo', 18)} Reactivate asset</button>`
    : `<button class="btn" data-act="retire" data-id="${id}">${ic('box', 18)} Retire asset</button>`}</div>`;
}

function groupOptions(kind, selected) {
  const gs = S.groups.filter((g) => g.kind === kind).map((g) => ({ id: g.id, p: L.groupPath(S.groups, g.id) })).sort((a, b) => a.p.localeCompare(b.p));
  return `<option value="">None</option>${gs.map((g) => `<option value="${g.id}"${g.id === selected ? ' selected' : ''}>${esc(g.p)}</option>`).join('')}<option value="__new">+ Create new ${KIND[kind].label}</option>`;
}
function pickField(kind, label, selected, hintIfEmpty) {
  const has = S.groups.some((g) => g.kind === kind);
  return `<div class="fld"><label for="f-${kind}">${label} <span class="opt">· optional</span></label>
    <select id="f-${kind}" name="${kind === 'location' ? 'locationId' : 'collectionId'}" data-act="pick" data-kind="${kind}">${groupOptions(kind, selected)}</select>
    <input class="newname" id="new-${kind}" name="new-${kind}" placeholder="Name your new ${KIND[kind].label}" style="display:none" maxlength="60" aria-label="New ${KIND[kind].label} name">
    ${has ? '' : `<p class="hint">${hintIfEmpty}</p>`}</div>`;
}

function formView(id, params) {
  const editing = !!id;
  const a = editing ? L.byId(S.assets, id) : { status: 'active', qty: 1, locationId: params.get('loc'), collectionId: params.get('col') };
  if (editing && !a) return `${topbar({ title: 'Not found', back: true })}${notFound('This asset may have been deleted.')}`;
  S.form = { img: null, thumb: null, removed: false };
  const ret = a.status === 'retired';
  const prev = a.thumb;
  return `<header class="top"><button class="ib" data-act="back" aria-label="Cancel">${ic('x')}</button><h1 class="sm">${editing ? 'Edit asset' : 'Add asset'}</h1><button class="txtbtn" form="assetForm" type="submit">Save</button></header>
  <form id="assetForm" data-id="${id || ''}" novalidate>
    <label class="photo" id="photoBox">${prev ? `<img src="${prev}" alt="">` : `${ic('camera', 26)}<span>Add photo</span>`}<input type="file" accept="image/*" id="file" aria-label="Add photo"></label>
    ${prev ? '<button type="button" class="btn sm ghost" data-act="rmphoto" style="margin:-6px 0 12px">Remove photo</button>' : ''}
    <div class="fld"><label for="f-name">Name</label><input id="f-name" name="name" value="${esc(a.name)}" placeholder="Mixer grinder" maxlength="80" autocomplete="off"><p class="err" id="err-name" hidden>Enter a name</p></div>
    <div class="fld"><label for="f-brand">Brand <span class="opt">· optional</span></label><input id="f-brand" name="brand" value="${esc(a.brand)}" placeholder="Philips" maxlength="60" autocomplete="off"></div>
    ${pickField('location', 'Location', a.locationId, 'Where it is, like a room. Nothing created yet.')}
    ${pickField('collection', 'Parent', a.collectionId, 'What it belongs to, like a collection. Nothing created yet.')}
    <div class="g2">
      <div class="fld"><label for="f-date">Purchase date</label><input id="f-date" type="date" name="purchaseDate" value="${esc(a.purchaseDate)}"></div>
      <div class="fld"><label for="f-price">Price per unit (₹)</label><input id="f-price" type="number" inputmode="decimal" min="0" step="any" name="price" value="${a.price ?? ''}" placeholder="6499"><p class="err" id="err-price" hidden>Enter a price of 0 or more</p></div>
    </div>
    <div class="g2">
      <div class="fld"><label for="f-qty">Quantity</label><input id="f-qty" type="number" inputmode="numeric" min="1" step="1" name="qty" value="${a.qty ?? 1}"><p class="err" id="err-qty" hidden>Enter a whole number, 1 or more</p></div>
      <div class="fld"><label for="f-war">Warranty until <span class="opt">· optional</span></label><input id="f-war" type="date" name="warrantyUntil" value="${esc(a.warrantyUntil)}"></div>
    </div>
    <div class="fld"><span class="lbl">Status</span><div class="seg" role="radiogroup" aria-label="Status">
      <label><input type="radio" name="status" value="active"${ret ? '' : ' checked'}><span>Active</span></label>
      <label><input type="radio" name="status" value="retired"${ret ? ' checked' : ''}><span class="r">Retired</span></label></div>
      <p class="hint">Retired means disposed, sold, or no longer in use. It’s kept in your list but not counted in value.</p></div>
    <div class="retbox" id="retFields"${ret ? '' : ' hidden'}>
      <div class="g2"><div class="fld"><label for="f-rr">Reason</label><select id="f-rr" name="retireReason">${['Disposed', 'Sold', 'Donated', 'Broken', 'Lost', 'Other'].map((r) => `<option${a.retireReason === r ? ' selected' : ''}>${r}</option>`).join('')}</select></div>
      <div class="fld"><label for="f-ro">Retired on</label><input id="f-ro" type="date" name="retiredOn" value="${esc(a.retiredOn || L.todayISO())}"></div></div></div>
    <div class="fld"><label for="f-notes">Notes <span class="opt">· optional</span></label><textarea id="f-notes" name="notes" placeholder="Model, invoice number, anything else" maxlength="500">${esc(a.notes)}</textarea></div>
    <button class="btn primary block" type="submit">${editing ? 'Save changes' : 'Add asset'}</button>
  </form>`;
}

function settingsView() {
  return `${topbar({ title: 'Settings', back: true })}
  <div class="list"><div class="row"><div class="rb"><p class="rt">${esc(S.user.displayName || 'Signed in')}</p><p class="rs">${esc(S.user.email || '')}</p></div></div></div>
  <div class="acts">
    ${S.installEv ? '<button class="btn" data-act="install">Install app</button>' : '<p class="hint">To install: on iPhone, tap Share then Add to Home Screen. On Android, open the browser menu and tap Install app.</p>'}
    <button class="btn" data-act="export">Export backup (JSON)</button>
    <button class="btn" data-act="signout">Sign out</button>
  </div>
  <p class="hint" style="margin-top:14px">Backups include all details and small photo previews. Full-size photos stay in your cloud data.</p>`;
}

function authView() {
  return `<div class="center"><div style="font-size:54px">📦</div><h1>Home assets</h1>
    <p>Keep track of what you own, what it cost, and where it lives. Sign in to sync across your devices.</p>
    <button class="btn primary" data-act="signin" style="height:48px;padding:0 24px">Continue with Google</button></div>`;
}
function setupView() {
  return `<div class="center"><div style="font-size:54px">🔧</div><h1>Connect Firebase</h1>
    <div class="setup"><p style="color:var(--ink)">Open <code>firebase-config.js</code> and paste in your Firebase web app settings, then reload. Setup steps are in <code>README.md</code>.</p></div></div>`;
}

/* ---------- render ---------- */
function render() {
  const app = $('#app');
  if (!configured) { app.innerHTML = setupView(); return; }
  if (S.user === undefined) { app.innerHTML = '<div class="center"><p>Loading…</p></div>'; return; }
  if (!S.user) { app.innerHTML = authView(); return; }
  if (!S.gReady || !S.aReady) { app.innerHTML = '<div class="center"><p>Loading your assets…</p></div>'; return; }
  S.rendered = true;
  const r = route();
  let html = '', showNav = true;
  switch (r.name) {
    case 'g': html = groupView(r.id); break;
    case 'all': html = allView(); break;
    case 'a': html = assetView(r.id); break;
    case 'add': html = formView(null, r.params); showNav = false; break;
    case 'edit': html = formView(r.id, r.params); showNav = false; break;
    case 'settings': html = settingsView(); showNav = false; break;
    default: html = homeView();
  }
  const g = r.name === 'g' ? L.byId(S.groups, r.id) : null;
  const addQ = g ? `?${g.kind === 'location' ? 'loc' : 'col'}=${g.id}` : '';
  app.innerHTML = html + (showNav ? `<nav class="nav" aria-label="Main"><div class="nav-in">
    <a class="n${r.name === 'home' || r.name === 'g' ? ' on' : ''}" href="#/">${ic('home')}<span>Home</span></a>
    <a class="fab" href="#/add${addQ}" aria-label="Add asset">${ic('plus', 26)}</a>
    <a class="n${r.name === 'all' ? ' on' : ''}" href="#/all">${ic('search')}<span>All assets</span></a></div></nav>` : '');
  if (r.name === 'a') loadFull(r.id);
}

async function loadFull(id) {
  if (S.imgCache[id]) return;
  const a = L.byId(S.assets, id);
  if (!a || !a.thumb) return;
  try {
    const snap = await getDoc(docRef('images', id));
    if (snap.exists()) {
      S.imgCache[id] = snap.data().data;
      const hero = $('#hero');
      if (hero && route().id === id) hero.innerHTML = `<img src="${S.imgCache[id]}" alt="${esc(a.name)}">`;
    }
  } catch (e) { /* offline: keep the preview */ }
}

/* ---------- sheets ---------- */
function sheet(html) {
  $('#modal').innerHTML = `<div class="overlay" data-act="closesheet"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  const f = $('#modal input:not([type=hidden]), #modal select, #modal button');
  if (f) f.focus();
}
function closeSheet() { $('#modal').innerHTML = ''; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

function groupModal({ kind, id, parentId }) {
  const g = id ? L.byId(S.groups, id) : null;
  kind = g ? g.kind : kind;
  const k = KIND[kind];
  const blocked = new Set(g ? L.subtreeIds(S.groups, g.id) : []);
  const par = g ? g.parentId : parentId;
  const opts = S.groups.filter((x) => x.kind === kind && !blocked.has(x.id)).map((x) => ({ id: x.id, p: L.groupPath(S.groups, x.id) })).sort((a, b) => a.p.localeCompare(b.p));
  const icon = g ? g.icon || k.def : k.def;
  sheet(`<h2>${g ? `Rename ${k.label}` : `New ${par ? 'sub-' : ''}${k.label}`}</h2><p class="d">${kind === 'location' ? 'A place where things are kept, like Kitchen or Garage.' : 'A group of things, like Electronics or Clothes.'}</p>
  <form id="groupForm" data-kind="${kind}" data-id="${id || ''}" novalidate>
    <div class="fld"><label for="g-name">Name</label><input id="g-name" name="name" value="${esc(g ? g.name : '')}" maxlength="60" placeholder="${kind === 'location' ? 'Balcony' : 'Cameras'}" autocomplete="off"><p class="err" id="err-gname" hidden>Enter a name</p></div>
    <div class="fld"><label for="g-par">Inside <span class="opt">· optional</span></label><select id="g-par" name="parentId"><option value="">Top level</option>${opts.map((o) => `<option value="${o.id}"${o.id === par ? ' selected' : ''}>${esc(o.p)}</option>`).join('')}</select></div>
    <div class="fld"><span class="lbl">Icon</span><input type="hidden" name="icon" id="g-icon" value="${icon}"><div class="iconpick">${ICONS.map((e) => `<button type="button" data-act="pickicon" data-v="${e}" class="${e === icon ? 'on' : ''}" aria-label="Icon ${e}">${e}</button>`).join('')}</div></div>
    <div class="btnrow"><button type="button" class="btn" data-act="closesheet">Cancel</button><button type="submit" class="btn primary">${g ? 'Save changes' : `Create ${k.label}`}</button></div>
  </form>`);
}

function confirmSheet({ title, text, act, id, label }) {
  sheet(`<h2>${esc(title)}</h2><p class="d">${esc(text)}</p><div class="btnrow"><button class="btn" data-act="closesheet">Cancel</button><button class="btn danger" data-act="${act}" data-id="${id}">${esc(label)}</button></div>`);
}

/* ---------- actions ---------- */
function newGroupDoc(name, kind, parentId, icon) {
  const ref = doc(colRef('groups'));
  const data = { name, kind, parentId: parentId || null, icon: icon || KIND[kind].def, createdAt: Date.now() };
  setDoc(ref, data).catch(fail);
  upsert(S.groups, { id: ref.id, ...data });
  return ref.id;
}

function saveGroup(f) {
  const name = f.elements.name.value.trim();
  if (!name) { $('#err-gname').hidden = false; f.elements.name.focus(); return; }
  const id = f.dataset.id, kind = f.dataset.kind;
  const parentId = f.parentId.value || null, icon = f.icon.value;
  if (id) {
    const data = { name, parentId, icon };
    setDoc(docRef('groups', id), data, { merge: true }).catch(fail);
    upsert(S.groups, { id, ...data });
    toast(`${KIND[kind].Label} saved`);
  } else {
    newGroupDoc(name, kind, parentId, icon);
    toast(`${KIND[kind].Label} created`);
  }
  closeSheet(); render();
}

function deleteGroup(id) {
  const g = L.byId(S.groups, id);
  if (!g) return;
  const up = g.parentId || null, field = L.fieldFor(g.kind);
  const batch = writeBatch(db);
  S.groups.filter((x) => x.parentId === id).forEach((c) => { batch.update(docRef('groups', c.id), { parentId: up }); c.parentId = up; });
  S.assets.filter((a) => a[field] === id).forEach((a) => { batch.update(docRef('assets', a.id), { [field]: up }); a[field] = up; });
  batch.delete(docRef('groups', id));
  batch.commit().catch(fail);
  S.groups = S.groups.filter((x) => x.id !== id);
  closeSheet();
  go(up ? `#/g/${up}` : '#/');
  toast(`${KIND[g.kind].Label} deleted`);
}

function readNum(v) { return v === '' || v === null ? null : Number(v); }

function saveAsset(f) {
  const id = f.dataset.id || null;
  const name = f.elements.name.value.trim();
  const price = readNum(f.price.value), qty = readNum(f.qty.value);
  const errs = { name: !name, price: price === null || !(price >= 0), qty: qty === null || !Number.isInteger(qty) || qty < 1 };
  Object.entries(errs).forEach(([k, bad]) => { $('#err-' + k).hidden = !bad; });
  if (errs.name || errs.price || errs.qty) { const first = errs.name ? f.elements.name : errs.price ? f.price : f.qty; first.focus(); return; }
  const resolve = (kind, sel, nameInput) => {
    if (sel.value !== '__new') return sel.value || null;
    const n = nameInput.value.trim();
    return n ? newGroupDoc(n, kind, null) : null;
  };
  const locationId = resolve('location', f.locationId, f['new-location']);
  const collectionId = resolve('collection', f.collectionId, f['new-collection']);
  const retired = f.status.value === 'retired';
  const data = {
    name, brand: f.brand.value.trim(), locationId, collectionId, price, qty,
    purchaseDate: f.purchaseDate.value || null, warrantyUntil: f.warrantyUntil.value || null,
    status: retired ? 'retired' : 'active',
    retireReason: retired ? f.retireReason.value : null, retiredOn: retired ? f.retiredOn.value || L.todayISO() : null,
    notes: f.notes.value.trim(), updatedAt: Date.now(),
  };
  if (!id) data.createdAt = Date.now();
  if (S.form.thumb) data.thumb = S.form.thumb;
  if (S.form.removed) data.thumb = '';
  const ref = id ? docRef('assets', id) : doc(colRef('assets'));
  setDoc(ref, data, { merge: true }).catch(fail);
  if (S.form.img) { setDoc(docRef('images', ref.id), { data: S.form.img }).catch(fail); S.imgCache[ref.id] = S.form.img; }
  if (S.form.removed) { deleteDoc(docRef('images', ref.id)).catch(() => {}); delete S.imgCache[ref.id]; }
  upsert(S.assets, { id: ref.id, ...data });
  location.replace(`#/a/${ref.id}`);
  toast(id ? 'Changes saved' : 'Asset added');
}

function deleteAsset(id) {
  deleteDoc(docRef('assets', id)).catch(fail);
  deleteDoc(docRef('images', id)).catch(() => {});
  S.assets = S.assets.filter((a) => a.id !== id);
  delete S.imgCache[id];
  closeSheet();
  history.length > 1 ? history.go(-1) : go('#/');
  toast('Asset deleted');
  setTimeout(render, 50);
}

function setStatus(id, patch) {
  setDoc(docRef('assets', id), { ...patch, updatedAt: Date.now() }, { merge: true }).catch(fail);
  upsert(S.assets, { id, ...patch });
  render();
}

function resizeImage(file, max, quality) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
    img.src = url;
  });
}

async function signIn() {
  const provider = new GoogleAuthProvider();
  try { await signInWithPopup(auth, provider); }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) {
      try { await signInWithRedirect(auth, provider); } catch (e2) { toast('Couldn’t sign in. Try again.'); }
    } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      toast(e.code === 'auth/unauthorized-domain' ? 'Add this site’s domain in Firebase Authentication settings.' : 'Couldn’t sign in. Try again.');
    }
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), groups: S.groups, assets: S.assets }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `assets-backup-${L.todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- events ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  if (act === 'closesheet') { if (e.target === el || el.tagName === 'BUTTON') closeSheet(); return; }
  switch (act) {
    case 'back': history.length > 1 ? history.back() : go('#/'); break;
    case 'signin': signIn(); break;
    case 'signout': signOut(auth); go('#/'); break;
    case 'export': exportData(); break;
    case 'install': S.installEv.prompt(); S.installEv = null; break;
    case 'filter': S.status = el.dataset.v; render(); break;
    case 'toggleinc': S.inc = !S.inc; render(); break;
    case 'newgroup': groupModal({ kind: el.dataset.kind, parentId: el.dataset.parent || null }); break;
    case 'pickicon':
      $('#g-icon').value = el.dataset.v;
      document.querySelectorAll('.iconpick button').forEach((b) => b.classList.toggle('on', b === el));
      break;
    case 'groupmenu': {
      const g = L.byId(S.groups, id), k = KIND[g.kind];
      sheet(`<h2>${esc(g.name)}</h2><p class="d">${esc(L.groupPath(S.groups, id))}</p>
        <button class="menuitem" data-act="addhere" data-id="${id}">${ic('plus', 20)} Add asset here</button>
        <button class="menuitem" data-act="addsub" data-id="${id}">${ic('folder', 20)} Add sub-${k.label}</button>
        <button class="menuitem" data-act="renamegroup" data-id="${id}">${ic('pen', 20)} Rename or move</button>
        <button class="menuitem danger" data-act="delgroup" data-id="${id}">${ic('trash', 20)} Delete ${k.label}</button>`);
      break;
    }
    case 'addhere': { const g = L.byId(S.groups, id); closeSheet(); go(`#/add?${g.kind === 'location' ? 'loc' : 'col'}=${id}`); break; }
    case 'addsub': groupModal({ kind: L.byId(S.groups, id).kind, parentId: id }); break;
    case 'renamegroup': groupModal({ id }); break;
    case 'delgroup': {
      const g = L.byId(S.groups, id), n = S.assets.filter((a) => a[L.fieldFor(g.kind)] === id).length, c = S.groups.filter((x) => x.parentId === id).length;
      confirmSheet({ title: `Delete ${g.name}`, text: `${n} asset${n === 1 ? '' : 's'} and ${c} sub-${KIND[g.kind].label}${c === 1 ? '' : 's'} inside will move up one level. Nothing else is deleted.`, act: 'confirmdelgroup', id, label: `Delete ${KIND[g.kind].label}` });
      break;
    }
    case 'confirmdelgroup': deleteGroup(id); break;
    case 'delasset': { const a = L.byId(S.assets, id); confirmSheet({ title: `Delete ${a.name}`, text: 'This removes the asset and its photo. You can’t undo this. If you just don’t use it anymore, retire it instead.', act: 'confirmdelasset', id, label: 'Delete asset' }); break; }
    case 'confirmdelasset': deleteAsset(id); break;
    case 'retire':
      sheet(`<h2>Retire this asset</h2><p class="d">It stays in your list, marked as retired, and is no longer counted in value.</p>
        <form id="retireForm" data-id="${id}"><div class="g2"><div class="fld"><label for="rt-r">Reason</label><select id="rt-r" name="reason">${['Disposed', 'Sold', 'Donated', 'Broken', 'Lost', 'Other'].map((r) => `<option>${r}</option>`).join('')}</select></div>
        <div class="fld"><label for="rt-d">Retired on</label><input id="rt-d" type="date" name="on" value="${L.todayISO()}"></div></div>
        <div class="btnrow"><button type="button" class="btn" data-act="closesheet">Cancel</button><button type="submit" class="btn primary">Retire asset</button></div></form>`);
      break;
    case 'reactivate': setStatus(id, { status: 'active', retireReason: null, retiredOn: null }); toast('Asset reactivated'); break;
    case 'rmphoto':
      S.form = { img: null, thumb: null, removed: true };
      $('#photoBox').innerHTML = `${ic('camera', 26)}<span>Add photo</span><input type="file" accept="image/*" id="file" aria-label="Add photo">`;
      el.remove();
      break;
    default:
  }
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'assetForm') saveAsset(f);
  else if (f.id === 'groupForm') saveGroup(f);
  else if (f.id === 'retireForm') {
    setStatus(f.dataset.id, { status: 'retired', retireReason: f.reason.value, retiredOn: f.on.value || L.todayISO() });
    closeSheet(); toast('Asset retired');
  }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.act === 'sort') { S.sort = t.value; localStorage.setItem('sort', S.sort); render(); }
  else if (t.dataset.act === 'pick') {
    const box = $('#new-' + t.dataset.kind);
    box.style.display = t.value === '__new' ? 'block' : 'none';
    if (t.value === '__new') box.focus();
  } else if (t.name === 'status') {
    $('#retFields').hidden = t.value !== 'retired';
  } else if (t.id === 'file' && t.files[0]) {
    try {
      S.form.img = await resizeImage(t.files[0], 900, 0.72);
      S.form.thumb = await resizeImage(t.files[0], 200, 0.7);
      S.form.removed = false;
      $('#photoBox').innerHTML = `<img src="${S.form.thumb}" alt="Selected photo"><input type="file" accept="image/*" id="file" aria-label="Replace photo">`;
    } catch (err) { toast('That image couldn’t be read. Try another.'); }
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'q') {
    S.q = e.target.value;
    const f = S.assets.filter((a) => L.matches(a, S.q, S.groups) && (S.status === 'all' || (S.status === 'retired') === L.isRetired(a)));
    $('#allList').innerHTML = assetList(f, S.assets.length ? ['No matches', 'Try a different search or filter.'] : ['No assets yet', 'Tap the + button to add one.']);
  }
});

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEv = e; });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
render();
