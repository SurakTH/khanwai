import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DEFAULT_CATEGORIES, categoryList, changeCategory, categoryOptions } from '../public/categories.js';
import { seedState, validateState } from '../public/lib.js';
import { flattenLibrary, expandLibrary, recordDiff, emptyLibrary, mergeImport } from '../public/sync-core.js';
import { LibraryStorage } from '../src/storage.mjs';
import { restoreBackup } from '../src/cli.mjs';
import { planCsv } from '../public/csv-import.js';

test('defaults do not rewrite legacy data; add, rename and remove preserve book and box data', () => {
  const state = seedState(), before = structuredClone(state);
  assert.deepEqual(categoryList(state), DEFAULT_CATEGORIES); assert.deepEqual(state, before);
  changeCategory(state, { action: 'add', value: 'การ์ตูนวาย' });
  assert.throws(() => changeCategory(state, { action: 'add', value: ' การ์ตูนวาย ' }), /แล้ว/);
  const original = state.series[0].category;
  state.drafts.push({ id: 'draft-test', category: original });
  changeCategory(state, { action: 'rename', name: original, value: 'หมวดใหม่' });
  assert.equal(state.series[0].category, 'หมวดใหม่'); assert.equal(state.drafts[0].category, 'หมวดใหม่');
  assert.deepEqual(state.series.map(s => s.entries), before.series.map(s => s.entries));
  const snapshot = structuredClone(state);
  assert.throws(() => changeCategory(state, { action: 'delete', name: 'หมวดใหม่' }), /ปลายทาง/);
  assert.deepEqual(state, snapshot);
  changeCategory(state, { action: 'delete', name: 'หมวดใหม่', target: 'การ์ตูนวาย' });
  assert.equal(state.series[0].category, 'การ์ตูนวาย'); assert.equal(state.drafts[0].category, 'การ์ตูนวาย');
  assert.ok(!categoryList(state).includes('หมวดใหม่'));
  assert.throws(() => changeCategory({ categories: ['เดียว'], series: [], drafts: [] }, { action: 'delete', name: 'เดียว' }), /อย่างน้อย/);
});

test('custom categories round trip, retain late references and merge unused categories from backups', () => {
  const state = seedState(); changeCategory(state, { action: 'add', value: 'การ์ตูนวาย' });
  state.series[0].category = 'การ์ตูนวาย';
  assert.deepEqual(expandLibrary(flattenLibrary(state)), state);
  assert.equal(recordDiff(seedState(), state).filter(c => c.key === 'catalog:categories').length, 1);
  assert.ok(categoryList({ ...state, categories: ['ใหม่'] }).includes('การ์ตูนวาย'));
  const imported = { ...emptyLibrary(), categories: ['ยังไม่มีหนังสือ'] };
  assert.ok(mergeImport(state, imported).state.categories.includes('ยังไม่มีหนังสือ'));
  assert.throws(() => validateState({ ...state, categories: ['A', 'Ａ'] }), /ซ้ำ/);
  const escaped = categoryOptions({ ...emptyLibrary(), categories: ['<ทดสอบ>'] }, '<ทดสอบ>', s => s.replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
  assert.ok(!escaped.includes('<ทดสอบ>'));
  const row = { index: 0, selected: true, title: 'CSV', author: '', edition: '1', language: 'ไทย', label: '1', category: 'การ์ตูนวาย', format: 'physical', status: 'owned', kind: 'volume', isbn: '', quantity: '', members: '', readingStatus: '', location: '', tags: '', target: '' };
  const plan = planCsv(state, [row]); assert.equal(plan.additions.length, 1); assert.equal(plan.next.series.at(-1).category, 'การ์ตูนวาย');
});

test('catalog migration, owner isolation, atomic rename, replay, conflict, validation and backup restore', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'book-categories-')); t.after(() => rm(directory, { recursive: true, force: true }));
  let storage = new LibraryStorage(directory);
  const owner = storage.createUser('categories@example.test', 'A', 'test-hash').id;
  const other = storage.createUser('other@example.test', 'B', 'test-hash').id;
  const apply = (before, after) => {
    const versions = storage.snapshot(owner).versions;
    return storage.apply(owner, { id: randomUUID(), changes: recordDiff(before, after).map(c => ({ ...c, baseRevision: versions[c.key] ?? 0 })) });
  };
  apply(emptyLibrary(), seedState());
  storage.db.exec('DROP TABLE catalogs; PRAGMA user_version=2;'); storage.close();
  storage = new LibraryStorage(directory); t.after(() => storage.close());
  assert.equal(storage.db.prepare('PRAGMA user_version').get().user_version, 3);
  assert.deepEqual(storage.snapshot(owner).state, seedState());
  const before = storage.snapshot(owner).state, next = structuredClone(before);
  changeCategory(next, { action: 'rename', name: before.series[0].category, value: 'การ์ตูนวาย' });
  apply(before, next); assert.deepEqual(storage.snapshot(owner).state, next);
  assert.deepEqual(storage.snapshot(other).state, emptyLibrary());
  const versions = storage.snapshot(owner).versions;
  const operation = { id: randomUUID(), changes: [{ key: 'catalog:categories', value: { id: 'categories', names: ['หมวดว่าง'] }, baseRevision: versions['catalog:categories'] }] };
  storage.apply(owner, operation); assert.equal(storage.apply(owner, operation).replayed, true);
  assert.throws(() => storage.apply(owner, { ...operation, id: randomUUID() }), e => e.status === 409);
  const current = storage.snapshot(owner);
  assert.throws(() => storage.apply(owner, { id: randomUUID(), changes: [{ key: 'catalog:categories', value: { id: 'categories', names: ['ซ้ำ', 'ซ้ำ'] }, baseRevision: current.versions['catalog:categories'] }] }), e => e.status === 400);
  assert.deepEqual(storage.snapshot(owner), current);
  const backup = path.join(directory, 'backup'), destination = path.join(directory, 'restored');
  await storage.backupTo(backup); restoreBackup(backup, destination);
  const restored = new LibraryStorage(destination);
  try { assert.deepEqual(restored.exportAccount(owner), storage.exportAccount(owner)); } finally { restored.close(); }
});
