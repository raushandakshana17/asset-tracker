// Pure helpers: no DOM, no Firebase. Tested with `node test.mjs`.

export const SORTS = [
  ['recent', 'Recently added'],
  ['price-desc', 'Price: high to low'],
  ['price-asc', 'Price: low to high'],
  ['date-desc', 'Purchased: newest first'],
  ['date-asc', 'Purchased: oldest first'],
  ['name', 'Name A to Z'],
];

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const inr = (n) => money.format(Number(n) || 0);

export function inrShort(n) {
  n = Number(n) || 0;
  const trim = (x) => x.toFixed(2).replace(/\.?0+$/, '');
  if (n >= 1e7) return '₹' + trim(n / 1e7) + ' Cr';
  if (n >= 1e5) return '₹' + trim(n / 1e5) + 'L';
  return inr(n);
}

export const lineValue = (a) => (Number(a.price) || 0) * (Number(a.qty) || 1);
export const isRetired = (a) => a.status === 'retired';
export const byId = (list, id) => list.find((x) => x.id === id);
export const fieldFor = (kind) => (kind === 'location' ? 'locationId' : 'collectionId');

export function pathIds(groups, id) {
  const out = [];
  const seen = new Set();
  let g = byId(groups, id);
  while (g && !seen.has(g.id)) {
    seen.add(g.id);
    out.unshift(g.id);
    g = g.parentId ? byId(groups, g.parentId) : null;
  }
  return out;
}

export const groupPath = (groups, id) =>
  pathIds(groups, id).map((i) => byId(groups, i).name).join(' › ');

export function subtreeIds(groups, id, seen = new Set()) {
  if (seen.has(id)) return [];
  seen.add(id);
  const out = [id];
  groups.filter((g) => g.parentId === id).forEach((c) => out.push(...subtreeIds(groups, c.id, seen)));
  return out;
}

export function assetsIn(assets, groups, id, deep = true) {
  const g = byId(groups, id);
  if (!g) return [];
  const f = fieldFor(g.kind);
  const ids = new Set(deep ? subtreeIds(groups, id) : [id]);
  return assets.filter((a) => ids.has(a[f]));
}

// Count and value never include retired assets.
export function rollup(assets, groups, id) {
  let count = 0, value = 0, retired = 0;
  for (const a of assetsIn(assets, groups, id, true)) {
    const q = Number(a.qty) || 1;
    if (isRetired(a)) retired += q;
    else { count += q; value += lineValue(a); }
  }
  return { count, value, retired };
}

export function totals(assets) {
  let count = 0, value = 0, retired = 0;
  for (const a of assets) {
    const q = Number(a.qty) || 1;
    if (isRetired(a)) retired += q;
    else { count += q; value += lineValue(a); }
  }
  return { count, value, retired };
}

const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
const dateCmp = (dir) => (a, b) => {
  if (!a.purchaseDate && !b.purchaseDate) return 0;
  if (!a.purchaseDate) return 1; // undated always last
  if (!b.purchaseDate) return -1;
  return dir * cmp(a.purchaseDate, b.purchaseDate);
};

// Active assets are sorted first; retired assets always sit at the bottom, sorted the same way.
export function sortAssets(list, key) {
  const fns = {
    recent: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    'price-desc': (a, b) => lineValue(b) - lineValue(a),
    'price-asc': (a, b) => lineValue(a) - lineValue(b),
    'date-desc': dateCmp(-1),
    'date-asc': dateCmp(1),
    name: (a, b) => String(a.name).localeCompare(String(b.name), 'en', { sensitivity: 'base' }),
  };
  const f = fns[key] || fns.recent;
  return list.filter((a) => !isRetired(a)).sort(f).concat(list.filter(isRetired).sort(f));
}

export function matches(a, q, groups) {
  q = q.trim().toLowerCase();
  if (!q) return true;
  const names = [a.locationId, a.collectionId]
    .map((id) => (id && byId(groups, id) ? groupPath(groups, id) : ''))
    .join(' ');
  return [a.name, a.brand, a.notes, names].join(' ').toLowerCase().includes(q);
}

export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  return `${d} ${mon} ${y}`;
}

export function todayISO(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function warrantyInfo(iso, now = new Date()) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const days = Math.round((new Date(y, m - 1, d) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
  if (days < 0) return { state: 'ended', text: 'Warranty ended' };
  const months = Math.round(days / 30.4);
  if (months >= 1) return { state: 'active', text: `Under warranty · ${months} month${months === 1 ? '' : 's'} left` };
  return { state: 'active', text: `Under warranty · ${days} day${days === 1 ? '' : 's'} left` };
}
