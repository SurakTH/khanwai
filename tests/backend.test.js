import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server.mjs';
import { LibraryStorage } from '../src/storage.mjs';
import { restoreBackup } from '../src/cli.mjs';
import { seedState } from '../public/lib.js';
import { emptyLibrary, recordDiff, flattenLibrary } from '../public/sync-core.js';

const PASSWORD = 'test-only-book-password-2026';
function client(base) {
  let cookie = '';
  return { get cookie() { return cookie; }, async request(route, method = 'GET', body, headers = {}) {
    const response = await fetch(base + route, { method, headers: { Cookie: cookie, ...(body !== undefined ? { 'Content-Type': 'application/json', 'X-Book-Request': '1', Origin: base } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const value = response.headers.get('content-type')?.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
    return { status: response.status, body: value, headers: response.headers };
  } };
}
async function setup(t, options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'book-backend-'));
  const app = createApp({ dataDirectory: directory, ...options }); app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${app.address().port}`;
  t.after(async () => { if (app.listening) await new Promise(resolve => { app.closeAllConnections(); app.close(resolve); }); await rm(directory, { recursive: true, force: true }); });
  return { app, base, directory, client: () => client(base) };
}
async function signup(c, email = `${randomUUID()}@example.test`) {
  const result = await c.request('/api/auth/register', 'POST', { email, name: 'นักอ่านทดสอบ', password: PASSWORD });
  assert.equal(result.status, 201); return result.body.user;
}
async function seed(c) {
  const state = seedState();
  const operation = { id: randomUUID(), changes: recordDiff(emptyLibrary(), state).map(change => ({ ...change, baseRevision: 0 })) };
  const result = await c.request('/api/sync', 'POST', operation); assert.equal(result.status, 200, JSON.stringify(result.body));
  return (await c.request('/api/library')).body;
}
function operation(snapshot, changes, id = randomUUID()) { return { id, changes: changes.map(change => ({ ...change, baseRevision: snapshot.versions[change.key] ?? 0 })) }; }

test('real accounts use hashed passwords, HttpOnly sessions, private defaults and origin checks', async t => {
  const fixture = await setup(t), c = fixture.client(), user = await signup(c);
  const record = fixture.app.storage.user(user.id);
  assert.notEqual(record.password_hash, PASSWORD); assert.match(record.password_hash, /^scrypt:/);
  const session = fixture.app.storage.db.prepare('SELECT * FROM sessions WHERE owner=?').get(user.id);
  assert.notEqual(session.token_hash, c.cookie.split('=')[1]);
  assert.deepEqual((await c.request('/api/library')).body.state, emptyLibrary());
  assert.equal((await c.request('/api/auth/me')).body.user.id, user.id);
  const duplicate = await c.request('/api/auth/register', 'POST', { email: user.email, name: 'N', password: PASSWORD }); assert.equal(duplicate.status, 409);
  const login = fixture.client();
  assert.equal((await login.request('/api/auth/login', 'POST', { email: user.email, password: 'wrong-password' })).status, 401);
  const logged = await login.request('/api/auth/login', 'POST', { email: user.email, password: PASSWORD });
  assert.equal(logged.status, 200); assert.match(logged.headers.get('set-cookie'), /HttpOnly/); assert.match(logged.headers.get('set-cookie'), /SameSite=Lax/);
  assert.equal((await login.request('/api/auth/logout', 'POST', {}, { 'X-Book-Request': '' })).status, 403);
  assert.equal((await login.request('/api/auth/logout', 'POST', {}, { Origin: 'https://other.example' })).status, 403);
  assert.equal((await login.request('/api/auth/logout', 'POST', {}, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await login.request('/api/auth/logout', 'POST', {})).status, 200);
  assert.equal((await login.request('/api/auth/me')).status, 401);
});

test('accounts cannot read each other’s library, exports, photos or operation dependencies', async t => {
  const fixture = await setup(t), a = fixture.client(), b = fixture.client();
  const alice = await signup(a), bob = await signup(b); const snapshot = await seed(a);
  assert.deepEqual((await b.request('/api/library')).body.state, emptyLibrary());
  assert.deepEqual((await b.request('/api/export')).body, emptyLibrary());
  const entry = snapshot.state.series[0].entries[0], image = await readFile('public/icon-192.png');
  const op = operation(snapshot, [{ key: `entry:${entry.id}`, value: { ...entry, seriesId: snapshot.state.series[0].id, coverData: `data:image/png;base64,${image.toString('base64')}` } }]);
  assert.equal((await a.request('/api/sync', 'POST', op)).status, 200);
  const photoUrl = (await a.request('/api/library')).body.state.series[0].entries[0].coverData;
  const photo = await a.request(photoUrl); assert.equal(photo.status, 200); assert.deepEqual(photo.body, image);
  assert.equal((await b.request(photoUrl)).status, 404);
  const crossDependency = { id: randomUUID(), changes: [{ key: `entry:${entry.id}`, value: null, baseRevision: { operationId: op.id } }] };
  assert.equal((await b.request('/api/sync', 'POST', crossDependency)).status, 409);
  // IDs may be the same across accounts; all rows remain owner-scoped.
  await seed(b); assert.equal((await b.request('/api/library')).body.state.series[0].entries[0].coverData, undefined);
  const invalidPhoto = operation((await b.request('/api/library')).body, [{ key: `entry:${entry.id}`, value: { ...entry, seriesId: 'sample-0', coverData: photoUrl } }]);
  assert.equal((await b.request('/api/sync', 'POST', invalidPhoto)).status, 400);
  assert.notEqual(alice.id, bob.id);
  assert.equal((await fixture.client().request('/api/export')).status, 401);
});

test('revision checks merge independent edits, reject same-record conflicts and deduplicate retries', async t => {
  const fixture = await setup(t), c = fixture.client(); await signup(c); const before = await seed(c);
  const series = before.state.series[0], entry = series.entries[0];
  const rename = operation(before, [{ key: `series:${series.id}`, value: { ...flattenLibrary(before.state).get(`series:${series.id}`), title: 'ชื่อจากเครื่องแรก' } }]);
  assert.equal((await c.request('/api/sync', 'POST', rename)).status, 200);
  const edit = operation(before, [{ key: `entry:${entry.id}`, value: { ...entry, seriesId: series.id, location: 'เครื่องที่สอง' } }]);
  assert.equal((await c.request('/api/sync', 'POST', edit)).status, 200);
  const replay = await c.request('/api/sync', 'POST', edit); assert.equal(replay.status, 200); assert.equal(replay.body.replayed, true);
  const collision = operation(before, [{ key: `entry:${entry.id}`, value: { ...entry, seriesId: series.id, location: 'เวอร์ชันเก่า' } }]);
  const conflict = await c.request('/api/sync', 'POST', collision); assert.equal(conflict.status, 409); assert.equal(conflict.body.error, 'conflict');
  assert.equal(conflict.body.details.conflicts[0].current.location, 'เครื่องที่สอง');
  const reused = { ...edit, changes: edit.changes.map(change => ({ ...change, value: { ...change.value, quantity: 9 } })) };
  assert.equal((await c.request('/api/sync', 'POST', reused)).status, 409);
  const after = (await c.request('/api/library')).body;
  assert.equal(after.state.series[0].title, 'ชื่อจากเครื่องแรก'); assert.equal(after.state.series[0].entries.length, 4);
  assert.equal((await c.request(`/api/sync?after=${before.cursor}`)).body.changes.length, 2);
});

test('offline operations can depend on preceding committed revisions without duplicate records', async t => {
  const fixture = await setup(t), c = fixture.client(); await signup(c); const before = await seed(c);
  const entry = before.state.series[0].entries[0], key = `entry:${entry.id}`;
  const first = operation(before, [{ key, value: { ...entry, seriesId: 'sample-0', location: 'ชั้น A' } }]);
  const second = { id: randomUUID(), changes: [{ key, value: { ...entry, seriesId: 'sample-0', location: 'ชั้น B' }, baseRevision: { operationId: first.id } }] };
  assert.equal((await c.request('/api/sync', 'POST', first)).status, 200);
  assert.equal((await c.request('/api/sync', 'POST', first)).body.replayed, true);
  assert.equal((await c.request('/api/sync', 'POST', second)).status, 200);
  const saved = (await c.request('/api/library')).body;
  assert.equal(saved.state.series[0].entries[0].location, 'ชั้น B'); assert.equal(saved.state.series[0].entries.length, 4);
});

test('deleted parents are tombstoned and stale child creation cannot silently restore them', async t => {
  const fixture = await setup(t), c = fixture.client(); await signup(c); const before = await seed(c);
  const after = structuredClone(before.state); after.series = after.series.filter(s => s.id !== 'sample-0');
  const remove = operation(before, recordDiff(before.state, after)); assert.equal((await c.request('/api/sync', 'POST', remove)).status, 200);
  const stale = operation(before, [{ key:'entry:new-stale', value: { id:'new-stale', seriesId:'sample-0', kind:'volume', label:'7', isbn:'', status:'owned', quantity:1 } }]);
  const response = await c.request('/api/sync', 'POST', stale);
  assert.equal(response.status, 409); assert.equal(response.body.details.conflicts[0].reason, 'parent_deleted');
  const snapshot = (await c.request('/api/library')).body;
  assert.ok(!snapshot.state.series.some(s => s.id === 'sample-0')); assert.ok(snapshot.versions['series:sample-0'] > before.versions['series:sample-0']);
});

test('invalid operations roll back atomically and photo exports are portable', async t => {
  const fixture = await setup(t), c = fixture.client(); await signup(c); const before = await seed(c);
  const entry = before.state.series[0].entries[0], key = `entry:${entry.id}`;
  const invalid = operation(before, [{ key, value: { ...entry, seriesId:'sample-0', quantity:-1 } }]);
  assert.equal((await c.request('/api/sync','POST', invalid)).status, 400);
  assert.equal((await c.request('/api/library')).body.cursor, before.cursor);
  const image = await readFile('public/icon-192.png');
  const photo = operation(before, [{ key, value: { ...entry, seriesId:'sample-0', coverData:`data:image/png;base64,${image.toString('base64')}` } }]);
  assert.equal((await c.request('/api/sync','POST',photo)).status, 200);
  const exported = (await c.request('/api/export')).body;
  assert.equal(exported.series[0].entries[0].coverData, `data:image/png;base64,${image.toString('base64')}`);
});

test('SQLite backup and restore recover accounts, rows and images and reject corrupt backups', async t => {
  const fixture = await setup(t), c = fixture.client(); const user = await signup(c); const before = await seed(c);
  const image = await readFile('public/icon-192.png'), entry = before.state.series[0].entries[0];
  assert.equal((await c.request('/api/sync','POST',operation(before,[{ key:`entry:${entry.id}`,value:{...entry,seriesId:'sample-0',coverData:`data:image/png;base64,${image.toString('base64')}`} }]))).status,200);
  const current=(await c.request('/api/library')).body;
  const seriesData=flattenLibrary(current.state).get('series:sample-0');
  assert.equal((await c.request('/api/sync','POST',operation(current,[{key:'series:sample-0',value:{...seriesData,metadataSeed:{isbn:'9786161847012',label:'10',source:'NLT'}}}]))).status,200);
  const backupDirectory = path.join(fixture.directory,'backup-copy'), restoredDirectory = path.join(fixture.directory,'restored');
  const manifest = await fixture.app.storage.backupTo(backupDirectory); assert.equal(manifest.files.length,1);
  restoreBackup(backupDirectory,restoredDirectory);
  const restored = new LibraryStorage(restoredDirectory);
  try {
    assert.deepEqual(restored.exportAccount(user.id), (await c.request('/api/export')).body);
    assert.equal(restored.snapshot(user.id).state.series[0].metadataSeed.label,'10');
    assert.equal(restored.db.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);
    assert.equal(restored.db.prepare('SELECT COUNT(*) n FROM maintenance').get().n,0);
  } finally { restored.close(); }
  assert.throws(()=>restoreBackup(backupDirectory,restoredDirectory),/ว่าง/);
  await writeFile(path.join(backupDirectory,manifest.files[0].path),'corrupt');
  assert.throws(()=>restoreBackup(backupDirectory,path.join(fixture.directory,'bad-restore')),/เสียหรือไม่ครบ/);
});

test('password changes revoke other sessions; deletion removes account data and private photos', async t => {
  const fixture = await setup(t), a = fixture.client(), b = fixture.client(); const user = await signup(a);
  await b.request('/api/auth/login','POST',{email:user.email,password:PASSWORD});
  await seed(a);
  assert.equal((await a.request('/api/auth/password','POST',{currentPassword:PASSWORD,password:'new-test-password-2026'})).status,200);
  assert.equal((await b.request('/api/auth/me')).status,401);
  assert.equal((await a.request('/api/auth/me')).status,200);
  assert.equal((await a.request('/api/account','DELETE',{password:PASSWORD})).status,401);
  assert.equal((await a.request('/api/account','DELETE',{password:'new-test-password-2026'})).status,200);
  assert.equal(fixture.app.storage.user(user.id),undefined);
  assert.equal((await a.request('/api/library')).status,401);
  assert.equal(fixture.app.storage.db.prepare('SELECT COUNT(*) n FROM series WHERE owner=?').get(user.id).n,0);
});

test('registration can be closed and repeated authentication attempts are limited', async t => {
  const closed = await setup(t,{allowRegistration:false});
  assert.equal((await closed.client().request('/api/auth/register','POST',{email:'a@example.test',name:'A',password:PASSWORD})).status,403);
  const fixture = await setup(t), c = fixture.client();
  for(let i=0;i<12;i++) assert.equal((await c.request('/api/auth/login','POST',{email:'none@example.test',password:PASSWORD})).status,401);
  assert.equal((await c.request('/api/auth/login','POST',{email:'none@example.test',password:PASSWORD})).status,429);
});

test('lookup settings are owner-scoped, revision checked, persisted and respected by the ISBN endpoint',async t=>{
 const calls=[];
 const fixture=await setup(t,{lookupFetcher:async url=>{
  calls.push(new URL(url).hostname);
  return Response.json({docs:[{pnx:{display:{title:['หนังสือทดสอบ เล่ม 10'],language:['tha']},addata:{isbn:['9786161847012'],au:['ผู้เขียน'],pub:['สำนักพิมพ์']},control:{recordid:['test-record']}}}]});
 }});
 const a=fixture.client(),b=fixture.client(),user=await signup(a);await signup(b);
 const original=(await a.request('/api/settings')).body;assert.deepEqual(original.isbnProviders,['google','openlibrary']);
 const saved=await a.request('/api/settings','PUT',{owner:user.id,revision:0,isbnProviders:['nlt']});assert.equal(saved.status,200);
 assert.deepEqual((await b.request('/api/settings')).body.isbnProviders,['google','openlibrary']);
 assert.equal((await b.request('/api/settings','PUT',{owner:user.id,revision:0,isbnProviders:[]})).status,403);
 assert.equal((await a.request('/api/settings','PUT',{owner:user.id,revision:0,isbnProviders:[]})).status,409);
 assert.equal((await a.request('/api/settings','PUT',{owner:user.id,revision:1,isbnProviders:['nlt','nlt']})).status,400);
 assert.equal((await a.request('/api/settings','PUT',{owner:user.id,revision:1,isbnProviders:[],apiKey:'do-not-store'})).status,400);
 const value=await a.request('/api/isbn?isbn=9786161847012');assert.equal(value.body.status,'found');assert.deepEqual(calls,['nlt.primo.exlibrisgroup.com']);
 assert.equal((await a.request('/api/settings','PUT',{owner:user.id,revision:1,isbnProviders:[]})).status,200);
 assert.equal((await a.request('/api/isbn?isbn=9786161847012')).body.status,'disabled');assert.equal(calls.length,1);
 const otherConnection=new LibraryStorage(fixture.directory);try{assert.deepEqual(otherConnection.settings(user.id).isbnProviders,[]);}finally{otherConnection.close();}
 const backup=path.join(fixture.directory,'backup-settings');await fixture.app.storage.backupTo(backup);
 const restored=path.join(fixture.directory,'restored-settings');restoreBackup(backup,restored);
 const checked=new LibraryStorage(restored);try{assert.deepEqual(checked.settings(user.id).isbnProviders,[]);assert.deepEqual(checked.settings(user.id).revision,2);}finally{checked.close();}
});

test('schema v1 migrates to provider preferences without changing existing accounts or books',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'book-migration-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const storage=new LibraryStorage(directory),owner=storage.createUser('migration@example.test','M','unused-hash').id;
 const state=seedState();storage.apply(owner,{id:randomUUID(),changes:recordDiff(emptyLibrary(),state).map(c=>({...c,baseRevision:0}))});
 storage.db.exec('DROP TABLE preferences; PRAGMA user_version=1;');
 const oldBackup=path.join(directory,'v1-backup');await storage.backupTo(oldBackup);storage.close();
 const migrated=new LibraryStorage(directory);
 try{assert.ok(migrated.user(owner));assert.equal(migrated.db.prepare('PRAGMA user_version').get().user_version,2);assert.deepEqual(migrated.settings(owner).isbnProviders,['google','openlibrary']);assert.deepEqual(migrated.snapshot(owner).state,state);}finally{migrated.close();}
 const restoredPath=path.join(directory,'restored-v1');restoreBackup(oldBackup,restoredPath);const restored=new LibraryStorage(restoredPath);try{assert.deepEqual(restored.snapshot(owner).state,state);assert.deepEqual(restored.settings(owner).isbnProviders,['google','openlibrary']);}finally{restored.close();}
});

test('private tags validate at the server, sync and export per owner, and survive SQLite backup', async t => {
  const fixture=await setup(t),a=fixture.client(),b=fixture.client();await signup(a);await signup(b);
  const snapshot=await seed(a),series=snapshot.state.series[0];const {entries,...data}=series;
  const invalid=await a.request('/api/sync','POST',operation(snapshot,[{key:`series:${series.id}`,value:{...data,tags:['x'.repeat(51)]}}]));assert.equal(invalid.status,400);
  const valid=await a.request('/api/sync','POST',operation(snapshot,[{key:`series:${series.id}`,value:{...data,tags:['สะสม','งานหนังสือ']}}]));assert.equal(valid.status,200);
  assert.deepEqual((await a.request('/api/export')).body.series[0].tags,['สะสม','งานหนังสือ']);assert.deepEqual((await b.request('/api/export')).body.series,[]);
  const operator=new LibraryStorage(fixture.directory),backup=path.join(fixture.directory,'tag-backup');try{await operator.backupTo(backup);}finally{operator.close();}
  const restored=path.join(fixture.directory,'tag-restored');restoreBackup(backup,restored);const storage=new LibraryStorage(restored);try{const rows=storage.db.prepare('SELECT data FROM series WHERE deleted=0').all().map(r=>JSON.parse(r.data));assert.deepEqual(rows.find(s=>s.id===series.id).tags,['สะสม','งานหนังสือ']);}finally{storage.close();}
});

test('reading and box member progress validate server-side, stay private and survive SQLite backup',async t=>{
 const fixture=await setup(t),a=fixture.client(),b=fixture.client();const owner=await signup(a);await signup(b);const snapshot=await seed(a),entry=snapshot.state.series[2].entries[0],key=`entry:${entry.id}`,seriesId=snapshot.state.series[2].id;
 const value={...entry,seriesId,readingStatus:'unread',readingByMember:{'1':'read','2':'planned'}};
 assert.equal((await a.request('/api/sync','POST',operation(snapshot,[{key,value:{...value,readingByMember:{'99':'read'}}}]))).status,400);
 assert.equal((await a.request('/api/sync','POST',operation(snapshot,[{key,value}]))).status,200);
 const exported=(await a.request('/api/export')).body;assert.deepEqual(exported.series[2].entries[0].readingByMember,{'1':'read','2':'planned'});assert.deepEqual((await b.request('/api/export')).body.series,[]);
 const backup=path.join(fixture.directory,'reading-backup'),restored=path.join(fixture.directory,'reading-restored');await fixture.app.storage.backupTo(backup);restoreBackup(backup,restored);const storage=new LibraryStorage(restored);try{assert.deepEqual(storage.snapshot(owner.id).state.series[2].entries[0].readingByMember,{'1':'read','2':'planned'});}finally{storage.close();}
});
