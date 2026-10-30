import test from 'node:test';
import assert from 'node:assert/strict';
import { sortShelf, stampShelfChanges } from '../public/shelf-sort.js';
const item = (id, title, extra = {}) => ({ id, title, entries: [], ...extra });
const ids = items => items.map(s => s.id);
test('shelf dates distinguish added from latest volume edits; missing dates stay last', () => {
 const data=[item('unknown','ก'),item('old','ข',{entries:[{reviewedAt:'2024-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'}]}),item('new','ค',{createdAt:'2025-01-01T00:00:00Z'})];
 assert.deepEqual(ids(sortShelf(data)),['new','old','unknown']);
 assert.deepEqual(ids(sortShelf(data,'oldest')),['old','new','unknown']);
 assert.deepEqual(ids(sortShelf(data,'updated')),['old','new','unknown']);
 assert.deepEqual(ids(data),['unknown','old','new']);
 assert.equal(sortShelf([item('bad','ง',{createdAt:'invalid'}),data[2]])[0].id,'new');
});
test('Thai dictionary order, Latin natural numbers, reverse and authors are deterministic', () => {
 const data=[item('b10','Book 10',{author:'Zed'}),item('thai2','ข้าว',{author:'กานต์'}),item('b2','Book 2',{author:''}),item('thai1','เก้า',{author:'กานต์'}),item('b1','Book 1',{author:'Ann'})];
 assert.deepEqual(ids(sortShelf(data,'title')),['thai1','thai2','b1','b2','b10']);
 assert.deepEqual(ids(sortShelf(data,'title-desc')),['b10','b2','b1','thai2','thai1']);
 assert.deepEqual(ids(sortShelf(data,'author')),['thai1','thai2','b1','b10','b2']);
});
test('timestamps track changed records without creating conflicts on unrelated volumes', () => {
 const before={series:[item('s','ก',{entries:[{id:'e1',label:'1',reviewedAt:'2024-01-01T00:00:00Z'},{id:'e2',label:'2'}]})]};
 const after=structuredClone(before);after.series[0].entries[0].status='ordered';
 const now='2026-10-30T00:00:00.000Z';stampShelfChanges(before,after,now);
 assert.equal(after.series[0].updatedAt,undefined);
 assert.equal(after.series[0].entries[0].updatedAt,now);
 assert.deepEqual(after.series[0].entries[1],before.series[0].entries[1]);
 const deleted=structuredClone(before);deleted.series[0].entries.pop();stampShelfChanges(before,deleted,now);assert.equal(deleted.series[0].updatedAt,now);
 const unchanged=structuredClone(before);stampShelfChanges(before,unchanged,now);assert.deepEqual(unchanged,before);
});
test('new series keep imported dates and new volumes do not change original added date', () => {
 const now='2026-10-30T00:00:00.000Z';const after={series:[item('s','ก',{entries:[{id:'e',reviewedAt:'2024-01-01T00:00:00Z'}]})]};
 stampShelfChanges({series:[]},after,now);assert.equal(after.series[0].createdAt,'2024-01-01T00:00:00.000Z');
 const next=structuredClone(after);next.series[0].entries.push({id:'new'});stampShelfChanges(after,next,now);
 assert.equal(next.series[0].createdAt,after.series[0].createdAt);assert.equal(next.series[0].entries[1].createdAt,now);assert.equal(sortShelf([next.series[0]],'updated')[0].id,'s');
});
