import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState, validateState, searchLibrary, coverage } from '../public/lib.js';
import { collectionSummary, filterShelf, parseTags, targetLabels, bulkPatch } from '../public/shelf-tools.js';
import { emptyLibrary, recordDiff, expandLibrary, flattenLibrary } from '../public/sync-core.js';
import { parseCsv, autoMapping, csvCandidates, planCsv, CSV_TEMPLATE } from '../public/csv-import.js';
const candidate = (extra={}) => ({index:0,selected:true,title:'ทดสอบ',author:'คนเขียน',edition:'ฉบับธรรมดา',language:'ไทย',category:'การ์ตูน',format:'physical',label:'1',isbn:'',status:'owned',quantity:'1',location:'ตู้ A',tags:'สะสม',target:'',kind:'volume',members:'',...extra});
let counter=0;const id=()=>`csv-${++counter}`;
test('target summaries account for boxes, duplicate copies, ordered and unknown targets',()=>{
 const s=seedState().series[2];s.target=['1','2','3','4','5'];s.entries.push({id:'o',kind:'volume',label:'4',status:'ordered',quantity:1,isbn:''},{id:'copy',kind:'volume',label:'1',status:'owned',quantity:2,isbn:''});
 const summary=collectionSummary(s);assert.deepEqual(summary.owned,['1','2','3']);assert.deepEqual(summary.ordered,['4']);assert.deepEqual(summary.missing,['5']);assert.equal(summary.incomplete,true);
 s.target=[];assert.equal(collectionSummary(s).incomplete,false);s.target=['1','2','3'];assert.equal(collectionSummary(s).incomplete,false);
});
test('filters intersect location, tag and known target; search also finds private tags and locations',()=>{
 const data=seedState();data.series[0].tags=['ฉบับสะสม'];data.series[0].entries[0].location='ตู้ A';data.series[0].target=['1','99'];
 assert.deepEqual(filterShelf(data.series,{smart:'incomplete',location:'ตู้ A',tag:'ฉบับสะสม'}).map(s=>s.id),['sample-0']);
 assert.equal(filterShelf(data.series,{location:'ตู้ B',tag:'ฉบับสะสม'}).length,0);
 assert.equal(searchLibrary(data.series,'ฉบับสะสม')[0].id,'sample-0');assert.equal(searchLibrary(data.series,'ตู้ A')[0].id,'sample-0');
});
test('tag validation is bounded server-side; targets use explicit ranges and special labels',()=>{
 assert.deepEqual(parseTags('  Test, test ; สะสม | สะสม '),['Test','สะสม']);assert.deepEqual(targetLabels('1-3, ภาคพิเศษ'),['1','2','3','ภาคพิเศษ']);
 for(const tags of [null,'tag',[1],[' '.repeat(2)],Array(31).fill('a'),['a'.repeat(51)]]){const s=seedState();s.series[0].tags=tags;assert.throws(()=>validateState(s));}
 assert.throws(()=>targetLabels('9-2'));assert.throws(()=>parseTags('x'.repeat(51)));
});
test('bulk patch affects selected IDs only, preserves box membership/quantity/ISBN, and round-trips tags',()=>{
 const data=seedState(),before=structuredClone(data),entry=data.series[2].entries[0];
 bulkPatch(data,[entry.id],{status:'ordered',location:'ตู้ B',tagMode:'add',tags:'สะสม'});
 assert.equal(entry.status,'ordered');assert.equal(entry.location,'ตู้ B');assert.deepEqual(entry.members,before.series[2].entries[0].members);assert.equal(entry.quantity,before.series[2].entries[0].quantity);
 assert.deepEqual(data.series[0],before.series[0]);assert.deepEqual(data.series[2].tags,['สะสม']);
 assert.deepEqual(expandLibrary(flattenLibrary(data)),data);assert.deepEqual(coverage(data.series[2],'ordered'),['1','2','3']);
 bulkPatch(data,[entry.id],{tagMode:'remove',tags:'สะสม'});assert.deepEqual(data.series[2].tags,[]);
 assert.throws(()=>bulkPatch(data,['nonexistent'],{status:'owned'}));
});
test('CSV handles BOM, Thai, quoted commas, escaped quotes and CRLF/multiline fields',()=>{
 const parsed=parseCsv('\uFEFFtitle,author\r\n"เรื่อง,รัก","คน""เขียน"\r\n"อีก\nเรื่อง",คน\r\n');
 assert.deepEqual(parsed.rows,[['เรื่อง,รัก','คน"เขียน'],['อีก\nเรื่อง','คน']]);
 assert.deepEqual(parseCsv('title;label\nทดสอบ;1',';').rows,[['ทดสอบ','1']]);
 for(const text of ['title,author\na','title,title\na,b','title\n"unfinished','title\n"a"b'])assert.throws(()=>parseCsv(text));
 assert.throws(()=>parseCsv('title\n'+Array(1001).fill('a').join('\n')));
});
test('CSV mapping uses column indexes, explicit defaults and rejects double mapping',()=>{
 const table=parseCsv(CSV_TEMPLATE),mapping=autoMapping(table.headers),rows=csvCandidates(table,mapping,{});assert.equal(rows[0].title,'เรื่องตัวอย่าง');assert.equal(planCsv(emptyLibrary(),rows,id).additions.length,1);
 assert.throws(()=>csvCandidates(table,{...mapping,title:mapping.author},{}));
});
test('CSV merges only matching editions, separates ebook and never assigns ISBN to other volumes',()=>{
 const rows=[candidate({isbn:'9780306406157'}),candidate({index:1,label:'2'}),candidate({index:2,format:'ebook',isbn:'9780306406157'}),candidate({index:3,language:'จีน',label:'3'})];
 const plan=planCsv(emptyLibrary(),rows,id);assert.equal(plan.additions.length,4);assert.equal(plan.next.series.length,3);assert.equal(plan.next.series[0].entries[1].isbn,'');
 assert.equal(recordDiff(emptyLibrary(),plan.next).length,7);validateState(plan.next);
});
test('CSV skips same ISBN-10/13, overlapping boxes and repeated rows without changing current records',()=>{
 const base=planCsv(emptyLibrary(),[candidate({isbn:'9780306406157'}),candidate({index:1,kind:'box',label:'บ็อกซ์',members:'2-4'})],id).next;
 const before=structuredClone(base);const plan=planCsv(base,[candidate({isbn:'0306406152'}),candidate({index:1,label:'3'}),candidate({index:2,label:'5'}),candidate({index:3,label:'5'})],id);
 assert.deepEqual(plan.results.map(r=>r.status),['duplicate','duplicate','ready','duplicate']);assert.deepEqual(base,before);
 assert.equal(plan.next.series[0].entries.length,3);assert.equal(plan.next.series[0].entries[0].quantity,1);
});
test('CSV invalid ISBN/quantity/missing edition/ambiguous editions are review errors; excluded rows do not create ownership',()=>{
 const rows=[candidate({isbn:'9780306406158'}),candidate({index:1,quantity:'0'}),candidate({index:2,edition:''}),candidate({index:3,selected:false,label:'4'})];
 const plan=planCsv(emptyLibrary(),rows,id);assert.equal(plan.additions.length,0);assert.deepEqual(plan.results.map(r=>r.status),['error','error','error','excluded']);
 const state=planCsv(emptyLibrary(),[candidate()],id).next;state.series.push({...structuredClone(state.series[0]),id:'duplicate-edition',entries:[]});
 assert.match(planCsv(state,[candidate({label:'2'})],id).results[0].message,/หลายรายการ/);
});
test('CSV unselecting the first duplicate lets the second row be imported, with tags and targets preserved',()=>{
 const rows=[candidate({selected:false}),candidate({index:1,tags:'พิเศษ, สะสม',target:'1-4'})];const plan=planCsv(emptyLibrary(),rows,id);assert.equal(plan.additions.length,1);assert.deepEqual(plan.next.series[0].tags,['พิเศษ','สะสม']);assert.deepEqual(plan.next.series[0].target,['1','2','3','4']);assert.equal(plan.next.series[0].entries.length,1);
});
