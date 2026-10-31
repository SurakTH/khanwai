import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState, validateState, coverage } from '../public/lib.js';
import { activeLibrary, moveToTrash, restoreFromTrash, trashItems } from '../public/trash.js';
import { unreadCandidates, pickUnread } from '../public/unread-picker.js';
import { restoreWarnings } from '../public/trash-ui.js';
import { flattenLibrary, expandLibrary, mergeImport } from '../public/sync-core.js';
import { setSeriesReading } from '../public/reading.js';
import { bulkPatch } from '../public/shelf-tools.js';

test('random picks only owned unread labels, deduplicates read copies and honors box overrides and location', () => {
  const series = { id:'one',entries:[
    {id:'box',kind:'box',label:'ชุด',members:['1','2','3'],status:'owned',readingByMember:{'1':'read','2':'planned'},location:'A'},
    {id:'copy',kind:'volume',label:'3',status:'owned',readingStatus:'read',location:'B'},
    {id:'four',kind:'volume',label:'4',status:'owned',location:'A'},
    {id:'five',kind:'volume',label:'5',status:'ordered'},
    {id:'six',kind:'volume',label:'6',status:'wishlist'},
    {id:'seven',kind:'volume',label:'7',status:'owned',readingStatus:'reading'},
    {id:'eight',kind:'volume',label:'8',status:'owned',trashedAt:'2026-10-31T00:00:00.000Z'}
  ] };
  const before=structuredClone(series), candidates=unreadCandidates([series]);
  assert.deepEqual(candidates[0].labels,['4']);assert.deepEqual(unreadCandidates([series],'A')[0].labels,['4']);
  assert.deepEqual(unreadCandidates([series],'B'),[]);assert.deepEqual(unreadCandidates([{...series,trashedAt:'now'}]),[]);
  assert.deepEqual(series,before);assert.equal(pickUnread([],undefined),null);
  const two={series:{id:'two'},labels:['1']};assert.equal(pickUnread([...candidates,two],'one',()=>0).series.id,'two');
});

test('trash and recovery retain IDs, photos, box reading, ownership and independent older trash', () => {
  const state=seedState(), before=structuredClone(state), series=state.series[0], entry=series.entries[0];
  moveToTrash(state,'entry',entry.id);validateState(state);
  assert.equal(activeLibrary(state).series[0].entries.length,series.entries.length-1);
  assert.equal(coverage(series).length,coverage(before.series[0]).length-1);
  assert.equal(trashItems(state)[0].kind,'entry');
  moveToTrash(state,'series',series.id);assert.equal(activeLibrary(state).series.length,state.series.length-1);
  assert.equal(trashItems(state).length,1);assert.equal(trashItems(state)[0].kind,'series');
  restoreFromTrash(state,'series',series.id);assert.equal(trashItems(state)[0].kind,'entry');
  restoreFromTrash(state,'entry',entry.id);assert.deepEqual(state,before);
  assert.deepEqual(expandLibrary(flattenLibrary(state)),state);
  moveToTrash(state,'entry',entry.id);
  const archived=structuredClone(entry);setSeriesReading(series,'read');
  assert.throws(()=>bulkPatch(state,[entry.id],{readingStatus:'planned'}),/ถูกลบหรือเปลี่ยน/);assert.deepEqual(entry,archived);
  const merged=mergeImport(state,{schemaVersion:2,series:[],drafts:[]});assert.ok(merged.state.series[0].entries[0].trashedAt);
  const copy={...entry,id:'restored-copy'};delete copy.trashedAt;series.entries.push(copy);
  assert.ok(restoreWarnings(state,'entry',entry.id).length);
  entry.trashedAt='invalid';assert.throws(()=>validateState(state),/วันที่/);
});

test('restoring a box preserves member reading and copies while whole-series reading skips the archived box', () => {
  const state=seedState(),series=state.series.find(s=>s.entries.some(e=>e.kind==='box')),box=series.entries.find(e=>e.kind==='box');
  box.readingByMember={[box.members[0]]:'read'};box.readingStatus='planned';box.quantity=2;
  const original=structuredClone(box);
  moveToTrash(state,'entry',box.id);setSeriesReading(series,'read');
  assert.ok(!activeLibrary(state).series.find(s=>s.id===series.id).entries.some(e=>e.id===box.id));
  restoreFromTrash(state,'entry',box.id);assert.deepEqual(box,original);validateState(state);
});
