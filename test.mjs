import assert from 'node:assert/strict';
import * as L from './logic.js';

const groups = [
  { id: 'k', name: 'Kitchen', kind: 'location', parentId: null },
  { id: 'ka', name: 'Appliances', kind: 'location', parentId: 'k' },
  { id: 'el', name: 'Electronics', kind: 'collection', parentId: null },
];
const A = (o) => ({ qty: 1, status: 'active', ...o });
const assets = [
  A({ id: '1', name: 'Mixer', price: 6499, locationId: 'ka', collectionId: 'el', purchaseDate: '2024-03-14', createdAt: 1 }),
  A({ id: '2', name: 'Plates', price: 300, qty: 6, locationId: 'k', purchaseDate: '2022-01-01', createdAt: 2 }),
  A({ id: '3', name: 'Old mixie', price: 2000, locationId: 'ka', status: 'retired', purchaseDate: '2020-05-05', createdAt: 3 }),
  A({ id: '4', name: 'Kettle', price: 900, collectionId: 'el', createdAt: 4 }),
  A({ id: '5', name: 'Cheap thing', price: 10, status: 'retired', purchaseDate: '2025-01-01', createdAt: 5 }),
];

// Rollups: retired excluded from value and count; asset at parent level included
let r = L.rollup(assets, groups, 'k');
assert.equal(r.value, 6499 + 1800); assert.equal(r.count, 1 + 6); assert.equal(r.retired, 1);
r = L.rollup(assets, groups, 'ka');
assert.equal(r.value, 6499); assert.equal(r.retired, 1);
r = L.rollup(assets, groups, 'el');
assert.equal(r.value, 6499 + 900);
assert.deepEqual(L.totals(assets), { count: 1 + 6 + 1, value: 6499 + 1800 + 900, retired: 2 });

// Sorting: retired always last, for every key
for (const [k] of L.SORTS) {
  const ids = L.sortAssets(assets, k).map((a) => a.id);
  assert.deepEqual(ids.slice(-2).sort(), ['3', '5'], k);
}
assert.deepEqual(L.sortAssets(assets, 'price-desc').map((a) => a.id), ['1', '2', '4', '3', '5']);
assert.deepEqual(L.sortAssets(assets, 'price-asc').map((a) => a.id), ['4', '2', '1', '5', '3']);
assert.deepEqual(L.sortAssets(assets, 'date-desc').map((a) => a.id), ['1', '2', '4', '5', '3']);
assert.deepEqual(L.sortAssets(assets, 'date-asc').map((a) => a.id), ['2', '1', '4', '3', '5']);
assert.equal(assets[0].id, '1'); // input not mutated

// Paths, formatting, search, warranty
assert.equal(L.groupPath(groups, 'ka'), 'Kitchen › Appliances');
assert.equal(L.inrShort(420000), '₹4.2L'); assert.equal(L.inrShort(12500000), '₹1.25 Cr'); assert.equal(L.inrShort(6499), '₹6,499');
assert.equal(L.fmtDate('2024-03-14'), '14 Mar 2024');
assert.ok(L.matches(assets[0], 'kitchen', groups)); assert.ok(!L.matches(assets[0], 'sofa', groups));
const now = new Date(2026, 9, 28);
assert.equal(L.warrantyInfo('2027-03-14', now).state, 'active');
assert.equal(L.warrantyInfo('2026-01-01', now).state, 'ended');
assert.equal(L.warrantyInfo('', now), null);
console.log('all logic tests passed');
