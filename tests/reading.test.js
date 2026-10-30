import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState, coverage, validateState } from '../public/lib.js';
import { READING_STATUSES, readingItems, readingSummary, setReading, setSeriesReading } from '../public/reading.js';
import { filterShelf, bulkPatch } from '../public/shelf-tools.js';
import { planCsv } from '../public/csv-import.js';
import { emptyLibrary, flattenLibrary, expandLibrary } from '../public/sync-core.js';

test('reading is independent of ownership and legacy defaults to unread without rewriting it',()=>{
 const state=seedState(),before=structuredClone(state);assert.equal(readingItems(state.series[0].entries[0])[0].status,'unread');assert.deepEqual(state,before);
 for(const status of Object.keys(READING_STATUSES)){setReading(state.series[0].entries[0],status);assert.equal(state.series[0].entries[0].status,before.series[0].entries[0].status);assert.deepEqual(coverage(state.series[0]),coverage(before.series[0]));validateState(state);}
 assert.deepEqual(expandLibrary(flattenLibrary(state)),state);
});
test('a member of a box has its own reading state without creating ownership or changing its siblings',()=>{
 const s=seedState().series[2],e=s.entries[0];setReading(e,'unread');setReading(e,'read','1');setReading(e,'planned','2');
 assert.deepEqual(readingItems(e).map(v=>v.status),['read','planned','unread']);assert.deepEqual(e.members,['1','2','3']);assert.deepEqual(coverage(s),['1','2','3']);
 setReading(e,'reading');assert.deepEqual(readingItems(e).map(v=>v.status),['reading','reading','reading']);assert.deepEqual(e.readingByMember,{});
 assert.throws(()=>setReading(e,'read','99'));assert.throws(()=>setReading(e,'finished'));
});
test('reading filters combine with location on the same entry and bulk changes only selected IDs',()=>{
 const state=seedState(),s=state.series[0];s.entries[0].location='ตู้ A';s.entries[1].location='ตู้ B';setReading(s.entries[0],'read');setReading(s.entries[1],'planned');
 assert.equal(filterShelf([s],{location:'ตู้ B',reading:'read'}).length,0);assert.equal(filterShelf([s],{location:'ตู้ A',reading:'read'}).length,1);
 bulkPatch(state,[s.entries[1].id],{readingStatus:'reading'});assert.equal(s.entries[0].readingStatus,'read');assert.equal(s.entries[1].readingStatus,'reading');
 assert.equal(filterShelf([s],{reading:'unread'}).length,1);
});
test('server validation rejects invalid reading values, maps on volumes, and members outside the box',()=>{
 for(const change of [s=>s.series[0].entries[0].readingStatus='finished',s=>s.drafts.push({id:'d',format:'physical',readingStatus:4}),s=>s.series[0].entries[0].readingByMember={'1':'read'},s=>s.series[2].entries[0].readingByMember={'99':'read'},s=>s.series[2].entries[0].readingByMember={'1':'bad'}]){const state=seedState();change(state);assert.throws(()=>validateState(state));}
 const state=seedState();state.series[2].entries[0].readingByMember={'1':'read','2':''};validateState(state);
});
test('reading summaries count each label once, keep formats separate and never include future targets',()=>{
 const state=seedState(),s=state.series[2];setReading(s.entries[0],'read','1');s.entries.push({id:'extra-copy',kind:'volume',label:'1',status:'owned',quantity:2,isbn:'',readingStatus:'unread'});s.target=['1','2','3','4'];
 assert.equal(readingSummary(s).read,1);assert.equal(readingSummary(s)[''],0);assert.equal(readingSummary(s).unread,2);
 assert.equal(Object.values(readingSummary(s)).reduce((a,b)=>a+b,0),3);assert.equal(readingSummary(state.series[3]).read,0);
});
test('CSV accepts explicit Thai/English reading state without inferring ownership and rejects invalid reading fields',()=>{
 const row={index:0,selected:true,title:'ทดสอบ',author:'',edition:'ธรรมดา',language:'ไทย',format:'ebook',category:'การ์ตูน',label:'1',isbn:'',status:'wishlist',quantity:'1',location:'',tags:'',target:'',kind:'volume',members:'',readingStatus:'อ่านแล้ว'};
 const plan=planCsv(emptyLibrary(),[row]);assert.equal(plan.next.series[0].entries[0].readingStatus,'read');assert.equal(plan.next.series[0].entries[0].status,'wishlist');assert.equal(planCsv(emptyLibrary(),[{...row,readingStatus:'bad'}]).results[0].status,'error');
});

test('series actions update existing volumes and box members without changing ownership or creating target entries',()=>{
 const state=seedState(),series=state.series[2],before=structuredClone(series);series.target=['1','2','3','40'];
 for(const status of ['read','planned','unread']){setSeriesReading(series,status);assert.ok(readingItems(series.entries[0]).every(e=>e.status===status));assert.deepEqual(series.entries[0].members,before.entries[0].members);assert.equal(series.entries[0].status,before.entries[0].status);assert.equal(series.entries.length,before.entries.length);}
 assert.throws(()=>setSeriesReading(series,'bad'));
});
test('blank reading values default to unread and old planned CSV labels remain compatible',()=>{
 const e={id:'entry',kind:'volume',label:'1',status:'owned',quantity:1,isbn:'',readingStatus:''};assert.equal(readingItems(e)[0].status,'unread');assert.equal(e.readingStatus,'');
 const row={index:0,selected:true,title:'ทดสอบ',author:'',edition:'ธรรมดา',language:'ไทย',format:'ebook',category:'การ์ตูน',label:'1',isbn:'',status:'owned',quantity:'1',location:'',tags:'',target:'',kind:'volume',members:''};
 assert.equal(planCsv(emptyLibrary(),[row]).next.series[0].entries[0].readingStatus,'unread');
 for(const readingStatus of ['ตั้งใจจะอ่าน','อยากอ่าน'])assert.equal(planCsv(emptyLibrary(),[{...row,readingStatus}]).next.series[0].entries[0].readingStatus,'planned');
});
