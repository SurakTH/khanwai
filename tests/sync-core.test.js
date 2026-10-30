import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState } from '../public/lib.js';
import { mergeImport } from '../public/sync-core.js';
test('import recognizes ISBN-10/13 as the same edition while keeping ebook separate', () => {
  const current = seedState();
  current.series[0].entries[0].isbn = '0306406152';
  const incoming = structuredClone(current);
  incoming.series = [incoming.series[0]]; incoming.drafts = [];
  incoming.series[0].id = 'imported-series';
  incoming.series[0].entries = [{ ...incoming.series[0].entries[0], id:'imported-entry', isbn:'9780306406157' }];
  const duplicate = mergeImport(current, incoming);
  assert.equal(duplicate.added, 0); assert.equal(duplicate.skipped, 1);
  incoming.series[0].format = 'ebook';
  const separate = mergeImport(current, incoming);
  assert.equal(separate.added, 1);
});
