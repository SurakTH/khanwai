// Opt-in Docker acceptance test. Creates and removes only its unique scratch project/volume.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { moveToTrash } from '../public/trash.js';
import { changeCategory } from '../public/categories.js';
import { seedState } from '../public/lib.js';
import { recordDiff, emptyLibrary } from '../public/sync-core.js';
const project = `book-smoke-${randomUUID().slice(0,8)}`, port = process.env.SMOKE_PORT ?? '4197';
const targetImage=process.env.KHANWAI_IMAGE ?? 'khanwai:0.10.0';
const environment = { ...process.env, KHANWAI_IMAGE:process.env.MIGRATE_FROM_IMAGE ?? targetImage, PORT:port, DATA_DIR:'/data', BIND_ADDRESS:'127.0.0.1' };
const compose = (...args) => execFileSync('docker',['compose','-p',project,...args],{env:environment,stdio:['ignore','pipe','pipe']}).toString();
let cookie = '';
async function request(route, method='GET', body) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {method,headers:{Connection: "close",Cookie:cookie,...(body?{'Content-Type':'application/json','X-Book-Request':'1'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(response.headers.has('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0];
  assert.equal(response.ok,true,`${route}: ${response.status}`);
  return response;
}
try {
  compose('up','-d','--wait');
  const credentials={email:`${randomUUID()}@example.test`,password:'docker-smoke-only-password',name:'Docker test'};
  await request('/api/auth/register','POST',credentials);
  const state=seedState(); state.series=state.series.slice(0,1);
  state.series[0].entries[0].readingStatus='reading';
  state.series[0].entries.push({id:'reading-box',kind:'box',label:'บ็อกซ์เสริม',members:['8','9'],status:'owned',quantity:1,isbn:'',readingStatus:'unread',readingByMember:{'8':'read'}});
  state.series[0].tags=['ฉบับสะสม','งานหนังสือ'];
  state.series[0].metadataSeed={isbn:'9786161847012',label:'10',source:'NLT'};
  state.series[0].entries[0].coverData=`data:image/png;base64,${(await readFile('public/icon-192.png')).toString('base64')}`;
  await request('/api/sync','POST',{id:randomUUID(),changes:recordDiff(emptyLibrary(),state).map(change=>({...change,baseRevision:0}))});
  const originalExport=await (await request('/api/export')).json();
  if(process.env.MIGRATE_FROM_IMAGE) compose('exec','-T','app','node','src/cli.mjs','backup','/data/backups/pre-migration');
  environment.KHANWAI_IMAGE=targetImage;
  compose('up','-d','--force-recreate','--wait');
  assert.deepEqual(await (await request('/api/export')).json(),originalExport);
  const categorySnapshot=await (await request('/api/library')).json(), categoryState=structuredClone(categorySnapshot.state);
  changeCategory(categoryState,{action:'rename',name:categoryState.series[0].category,value:'การ์ตูนวาย'});
  changeCategory(categoryState,{action:'add',value:'ยังไม่มีหนังสือ'});
  await request('/api/sync','POST',{id:randomUUID(),changes:recordDiff(categorySnapshot.state,categoryState).map(change=>({...change,baseRevision:categorySnapshot.versions[change.key]??0}))});
  const trashSnapshot=await (await request('/api/library')).json(), trashState=structuredClone(trashSnapshot.state);
  moveToTrash(trashState,'entry',trashState.series[0].entries.at(-1).id);
  await request('/api/sync','POST',{id:randomUUID(),changes:recordDiff(trashSnapshot.state,trashState).map(change=>({...change,baseRevision:trashSnapshot.versions[change.key]??0}))});
  const exported=await (await request('/api/export')).json();
  assert.ok(exported.series[0].entries.at(-1).trashedAt);
  assert.ok(exported.categories.includes('การ์ตูนวาย'));
  assert.ok(exported.categories.includes('ยังไม่มีหนังสือ'));
  const initialSettings=await (await request('/api/settings')).json();
  await request('/api/settings','PUT',{owner:initialSettings.owner,revision:initialSettings.revision,isbnProviders:['nlt','openlibrary']});
  compose('exec','-T','app','node','src/cli.mjs','backup','/data/backups/acceptance');
  compose('exec','-T','app','node','src/cli.mjs','restore','/data/backups/acceptance','/data/restored-acceptance');
  environment.DATA_DIR='/data/restored-acceptance';
  compose('up','-d','--wait');
  cookie=''; await request('/api/auth/login','POST',credentials);
  assert.deepEqual(await (await request('/api/export')).json(),exported);
  const snapshot=await (await request('/api/library')).json();
  const photo=await request(snapshot.state.series[0].entries[0].coverData);
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()),await readFile('public/icon-192.png'));
  assert.deepEqual((await (await request('/api/settings')).json()).isbnProviders,['nlt','openlibrary']);
  if(process.env.MIGRATE_FROM_IMAGE){
    environment.KHANWAI_IMAGE=process.env.MIGRATE_FROM_IMAGE;
    compose('run','--rm','--no-deps','app','node','src/cli.mjs','restore','/data/backups/pre-migration','/data/rollback-acceptance');
    environment.DATA_DIR='/data/rollback-acceptance';compose('up','-d','--wait');
    cookie='';await request('/api/auth/login','POST',credentials);
    assert.deepEqual(await (await request('/api/export')).json(),originalExport);
    console.log('Docker migration + rollback passed with original books and photos.');
  }
  console.log('Docker acceptance passed: volume persistence, SQLite + photo backup, restore, login and portable export.');
} finally { compose('down','-v'); }
