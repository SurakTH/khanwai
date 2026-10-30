import test from 'node:test';
import assert from 'node:assert/strict';
import { createIsbnLookup } from '../src/isbn.mjs';
const ISBN='9780306406157';
const book = isbn => ({ [`ISBN:${isbn}`]:{title:'หนังสือจากแหล่งสำรอง',authors:[{name:'ผู้เขียน'}],publishers:[{name:'สำนักพิมพ์'}],identifiers:{isbn_10:['0306406152']},url:'https://openlibrary.org/books/OL1M'} });

test('Google quota exhaustion falls back to exact Open Library metadata with honest source and missing language',async()=>{
 const calls=[];
 const lookup=createIsbnLookup({intervalMs:0,fetcher:async url=>{calls.push(url);return url.includes('googleapis')?new Response('',{status:429}):Response.json(book(ISBN));}});
 const value=await lookup('0306406152');
 assert.equal(value.status,'found');assert.deepEqual(value.providers,[{name:'Google Books',status:'rate_limited'},{name:'Open Library',status:'found'}]);assert.equal(value.candidates[0].source,'Open Library');assert.equal(value.candidates[0].isbn,ISBN);assert.equal(value.candidates[0].language,'');assert.equal(calls.length,2);
 value.candidates[0].title='private edit';
 assert.equal((await lookup(ISBN)).candidates[0].title,'หนังสือจากแหล่งสำรอง');assert.equal(calls.length,2);
});
test('fallback does not treat another edition or missing identifiers as an ISBN match',async()=>{
 for(const identifiers of [{isbn_13:['9780140328721']},{}]){
 const lookup=createIsbnLookup({intervalMs:0,fetcher:async url=>url.includes('googleapis')?Response.json({}):Response.json({[`ISBN:${ISBN}`]:{title:'Wrong',identifiers}})});
 assert.equal((await lookup(ISBN)).status,'not_found');
 }
});
test('errors and empty responses stay distinct when the fallback also fails',async()=>{
 for(const [googleStatus,openStatus,expected] of [[429,200,'rate_limited'],[503,200,'unavailable'],[200,200,'not_found'],[200,429,'rate_limited']]){
 const lookup=createIsbnLookup({intervalMs:0,fetcher:async url=>{const status=url.includes('googleapis')?googleStatus:openStatus;return status===200?Response.json({}):new Response('',{status});}});
 assert.equal((await lookup(ISBN)).status,expected);
 }
});
test('equivalent concurrent ISBN lookups share requests; cached misses expire and quota cooldown skips Google',async()=>{
 let time=0,calls=[];
 const lookup=createIsbnLookup({intervalMs:0,now:()=>time,fetcher:async url=>{calls.push(url);await Promise.resolve();return url.includes('googleapis')?new Response('',{status:429}):Response.json({});}});
 await Promise.all([lookup('0306406152'),lookup(ISBN)]);assert.equal(calls.length,2);
 time=16000;await lookup(ISBN);assert.equal(calls.length,3);assert.ok(calls.at(-1).includes('openlibrary'));
 time=61000;await lookup(ISBN);assert.equal(calls.length,5);
});
test('Open Library starts at most one request per configured interval and public misses are not permanent',async()=>{
 let time=0;const starts=[];
 const lookup=createIsbnLookup({now:()=>time,sleep:async ms=>{time+=ms;},fetcher:async url=>{if(url.includes('openlibrary'))starts.push(time);return Response.json({});}});
 await Promise.all([lookup(ISBN),lookup('9780140328721')]);assert.deepEqual(starts,[0,1100]);
 time=301101;await lookup(ISBN);assert.equal(starts.length,3);
});
test('a server API key is used only upstream; 403 quota errors can use the fallback',async()=>{
 let googleUrl;
 const lookup=createIsbnLookup({intervalMs:0,apiKey:'test-key-only',fetcher:async url=>{
 if(url.includes('googleapis')){googleUrl=url;return Response.json({error:{errors:[{reason:'dailyLimitExceeded'}]}},{status:403});}
 return Response.json(book(ISBN));
 }});
 const value=await lookup(ISBN);assert.equal(new URL(googleUrl).searchParams.get('key'),'test-key-only');assert.equal(value.status,'found');assert.ok(!JSON.stringify(value).includes('test-key-only'));
});

test('selected providers run in order; changing selection never reuses results from disabled sources',async()=>{
 const calls=[];
 const lookup=createIsbnLookup({intervalMs:0,fetcher:async url=>{calls.push(new URL(url).hostname);return url.includes('openlibrary')?Response.json(book(ISBN)):Response.json({});}});
 assert.equal((await lookup(ISBN,['openlibrary'])).status,'found');
 assert.equal((await lookup(ISBN,['google'])).status,'not_found');
 assert.deepEqual(calls,['openlibrary.org','www.googleapis.com']);
 assert.equal((await lookup(ISBN,[])).status,'disabled');assert.equal(calls.length,2);
 await assert.rejects(lookup(ISBN,['https://arbitrary.example']),/เลือกแหล่ง/);
});
test('NLT exact ISBN metadata uses its source, explicit volume and language; mismatched records are rejected',async()=>{
 const fixture={docs:[{pnx:{display:{title:['ชื่อเรื่อง เล่ม 10'],language:['tha']},addata:{isbn:['978-616-184-701-2'],au:['ผู้เขียน'],pub:['สำนักพิมพ์']},control:{recordid:['alma-test']}}}]};
 const lookup=createIsbnLookup({intervalMs:0,fetcher:async()=>Response.json(fixture)});
 const found=await lookup('9786161847012',['nlt']);assert.equal(found.status,'found');
 assert.equal(found.candidates[0].label,'10');assert.equal(found.candidates[0].language,'ไทย');assert.equal(found.candidates[0].edition,'');assert.equal(found.candidates[0].source,'หอสมุดแห่งชาติ (NLT)');
 assert.equal((await lookup(ISBN,['nlt'])).status,'not_found');
});
