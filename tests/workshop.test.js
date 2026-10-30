import test from 'node:test';
import assert from 'node:assert/strict';
import { batchLabels } from '../public/workshop.js';
import { seedState, validateState } from '../public/lib.js';

test('batch selection preserves target gaps and accepts excluded intervals', () => {
  assert.deepEqual(batchLabels('1', '6', '3, 5-6'), { all: ['1','2','3','4','5','6'], included: ['1','2','4'], skipped: ['3','5','6'] });
  assert.deepEqual(batchLabels('0', '0').included, ['0']);
  for (const args of [['','6'], ['6','1'], ['1','201'], ['1','6','7'], ['1','6','2.5']]) assert.throws(() => batchLabels(...args));
});

test('backup preserves attached cover and location, rejects SVG/URL and oversized images', () => {
  const state = seedState(); state.series[0].entries[0].coverData = 'data:image/jpeg;base64,/9j/AA=='; state.series[0].entries[0].location = 'ตู้ B ชั้น 2';
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))), state);
  for (const image of ['https://example.com/cover.jpg', 'data:image/svg+xml;base64,AAAA', 'data:image/jpeg;base64,' + 'A'.repeat(450001)]) {
    const next = structuredClone(state); next.series[0].entries[0].coverData = image;
    assert.throws(() => validateState(next));
  }
});

test('series metadata seed is a specific volume ISBN and never an ownership entry',async()=>{
 const {batchSeed,seriesTitleFromCandidate}=await import('../public/workshop.js');
 assert.deepEqual(batchSeed('0306406152','10','NLT'),{isbn:'9780306406157',label:'10',source:'NLT'});
 assert.equal(batchSeed('','10'),null);assert.throws(()=>batchSeed('9780306406157',''));assert.throws(()=>batchSeed('wrong','10'));
 assert.equal(seriesTitleFromCandidate({title:'เรื่องตัวอย่าง เล่ม 10',label:'10'}),'เรื่องตัวอย่าง');
 assert.equal(seriesTitleFromCandidate({title:'ชื่อเรื่องที่มีเลข 10',label:'10'}),'ชื่อเรื่องที่มีเลข 10');
 assert.equal(seriesTitleFromCandidate({title:'เรื่องตัวอย่าง เล่ม 10',label:'1'}),'เรื่องตัวอย่าง เล่ม 10');
 const state=seedState(),before=state.series[0].entries.length;
 state.series[0].metadataSeed=batchSeed('9780306406157','10','NLT');validateState(state);assert.equal(state.series[0].entries.length,before);
 const invalid=structuredClone(state);invalid.series[0].metadataSeed.isbn='bad';assert.throws(()=>validateState(invalid));
});
