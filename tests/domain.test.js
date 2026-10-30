import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIsbn, coverage, matchingEntries, searchLibrary, seedState, validateState, migrateState } from '../public/lib.js';

test('ISBN-10/X and ISBN-13 match the same edition; invalid and non-book EAN are rejected', () => {
  assert.equal(normalizeIsbn('0-306-40615-2'), '9780306406157');
  assert.equal(normalizeIsbn('978 0 306 40615 7'), '9780306406157');
  assert.equal(normalizeIsbn('080442957X'), '9780804429573');
  for (const value of ['9780306406158', '0306406153', '4006381333931', '', '9780306406157garbage']) assert.equal(normalizeIsbn(value), null);
});
test('box coverage does not double-count labels and preserves ordered status separately', () => {
  const s = seedState().series[2];
  s.entries.push({ id: 'extra', label: '2', kind: 'volume', quantity: 1, isbn: '', status: 'owned' });
  s.entries.push({ id: 'order', label: '4', kind: 'volume', quantity: 1, isbn: '', status: 'ordered' });
  assert.deepEqual(coverage(s), ['1', '2', '3']);
  assert.deepEqual(coverage(s, 'ordered'), ['4']);
  assert.equal(matchingEntries(s, { label: '1', kind: 'volume', isbn: '' })[0].kind, 'box');
});
test('search finds alias, ordered volumes and canonical ISBN across 10/13 forms', () => {
  const data = seedState();
  data.series[0].entries[0].isbn = '9780306406157';
  assert.equal(searchLibrary(data.series, 'จันทร์เธอ')[0].id, 'sample-0');
  assert.equal(searchLibrary(data.series, '0306406152')[0].id, 'sample-0');
  assert.equal(searchLibrary(data.series, '', 'ordered').length, 2);
  assert.equal(searchLibrary(data.series, 'no such book').length, 0);
});
test('backup round-trip preserves box membership, statuses, aliases and drafts', () => {
  const state = seedState();
  state.drafts.push({ id: 'draft', title: '', author: '', isbn: '9780306406157', label: '', edition: '', language: '', format: 'ebook', category: 'อื่น ๆ', source: 'กรอกเอง' });
  const restored = validateState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
});
test('invalid backups cannot introduce duplicate IDs, invalid status or ISBN', () => {
  for (const change of [
    s => { s.schemaVersion = 99; },
    s => { s.series[0].format = 'audiobook'; },
    s => { s.series[1].id = s.series[0].id; },
    s => { s.series[0].entries[0].status = 'admin'; },
    s => { s.series[0].entries[0].quantity = -1; },
    s => { s.series[0].entries[0].isbn = '9780306406158'; },
    s => { s.series[2].entries[0].members = null; },
  ]) { const s = seedState(); change(s); assert.throws(() => validateState(s)); }
});

test('legacy backup migrates to physical without changing the source or IDs', () => {
  const old = seedState(); old.schemaVersion = 1;
  old.series.forEach(s => { delete s.format; });
  old.drafts.push({ id: 'legacy-draft', title: '', author: '', isbn: '9780306406157', label: '', edition: '', language: '', category: 'อื่น ๆ', source: 'กรอกเอง' });
  const source = JSON.stringify(old);
  const next = migrateState(old);
  assert.equal(next.schemaVersion, 2);
  assert.ok(next.series.every(s => s.format === 'physical'));
  assert.equal(next.drafts[0].format, 'physical');
  assert.equal(next.series[0].entries[0].id, old.series[0].entries[0].id);
  assert.equal(JSON.stringify(old), source);
  assert.throws(() => migrateState({ ...old, schemaVersion: 99 }));
});

test('same title can have physical and ebook editions with independent coverage and filtering', () => {
  const data = seedState(); const printed = data.series[0];
  const digital = structuredClone(printed);
  digital.id = 'digital'; digital.format = 'ebook'; digital.entries = [{ ...digital.entries[0], id: 'digital-1', label: '3', isbn: '' }];
  data.series.push(digital);
  validateState(data);
  assert.equal(searchLibrary(data.series, printed.title, 'all', 'ebook').length, 1);
  assert.deepEqual(coverage(digital), ['3']);
  assert.ok(!coverage(printed).includes('3'));
  assert.equal(matchingEntries(printed, { label: '3', kind: 'volume', isbn: '' }).length, 0);
});
