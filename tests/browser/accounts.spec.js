import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { seedState } from '../../public/lib.js';
import { recordDiff, emptyLibrary } from '../../public/sync-core.js';
const headers = { 'X-Book-Request': '1' };
async function register(context) {
  const credentials = { email: `${randomUUID()}@example.test`, password: 'accounts-test-only-password', name: 'นักอ่าน' };
  expect((await context.request.post('/api/auth/register', { headers, data: credentials })).status()).toBe(201);
  const seeded = await context.request.post('/api/sync', { headers, data: { id: randomUUID(), changes: recordDiff(emptyLibrary(), seedState()).map(c => ({ ...c, baseRevision: 0 })) } });
  expect(seeded.ok()).toBe(true); return credentials;
}
async function ready(page) { await page.goto('/'); await expect(page.locator('#series-count')).toHaveText('6'); await expect(page.locator('#connection')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว'); }
async function store(page, fn, argument) {
  await page.evaluate(async () => { window.testStore = (await import('/app.js')).account; });
  return page.evaluate(fn, argument);
}
// Independent browser contexts represent separate devices; no shared IndexedDB or cookies.
test('same account sees saved changes from another device; another account sees no private books', async ({ browser, context, page, baseURL }) => {
  const credentials = await register(context); await ready(page);
  const second = await browser.newContext({ baseURL });
  try {
    expect((await second.request.post('/api/auth/login', { headers, data: credentials })).ok()).toBe(true);
    const other = await second.newPage(); await ready(other);
    await store(page, async () => { const store = window.testStore; await store.mutate(s=>{s.series[0].title='ชื่อจากเครื่องแรก';s.series[0].entries[0].status='ordered';}); await store.sync(); });
    await other.reload(); await expect(other.locator('.book-card[data-detail="sample-0"]')).toContainText('ชื่อจากเครื่องแรก');
    expect((await (await second.request.get('/api/library')).json()).state.series[0].entries[0].status).toBe('ordered');
    await store(other,async()=>{await window.testStore.mutate(s=>s.series[0].entries[0].status='owned');await window.testStore.sync();});
    await expect.poll(async()=>(await (await second.request.get('/api/library')).json()).state.series[0].entries[0].status).toBe('owned');
    await page.reload();await expect(page.locator('#connection')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');
    expect(await store(page,async()=>window.testStore.state.series[0].entries[0].status)).toBe('owned');
    await second.request.post('/api/auth/logout', { headers, data: {} });
    await register(second); await other.reload();
    await expect(other.locator('.book-card[data-detail="sample-0"]')).not.toContainText('ชื่อจากเครื่องแรก');
  } finally { await second.close(); }
});
test('offline changes survive a reload and retry without adding duplicate entries', async ({ context, page }) => {
  await register(context); await ready(page); await store(page, async () => { const store = window.testStore; return store.pending });
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;}); await page.reload();
  await context.setOffline(true);
  await store(page, async () => { const store = window.testStore; await store.mutate(s=>s.series[0].entries[0].location='ตู้ที่แก้ตอนออฟไลน์'); return store.pending; });
  await page.reload();
  expect(await store(page, async () => { const store = window.testStore; return store.state.series[0].entries[0].location; })).toBe('ตู้ที่แก้ตอนออฟไลน์');
  expect(await store(page, async () => { const store = window.testStore; return store.pending; })).toBe(1);
  await context.setOffline(false);
  await store(page, async () => { const store = window.testStore; await store.sync(); await store.sync(); });
  await expect.poll(() => store(page, async () => window.testStore.pending)).toBe(0);
  const snapshot = await (await page.request.get('/api/library')).json();
  expect(snapshot.state.series[0].entries[0].location).toBe('ตู้ที่แก้ตอนออฟไลน์');
  expect(snapshot.state.series[0].entries).toHaveLength(4);
});
test('conflicting edits preserve local work and require choosing before server changes', async ({ context, page }) => {
  await register(context); await ready(page); await store(page, async () => { const store = window.testStore; return store.pending; });
  await context.setOffline(true);
  await store(page, async () => { const store = window.testStore; await store.mutate(s=>s.series[0].title='ชื่อในเครื่อง'); });
  // APIRequestContext does not use browser offline emulation: simulate another device.
  const snapshot = await (await context.request.get('/api/library')).json();
  const current = snapshot.state.series[0]; const { entries, ...series } = current;
  const response = await context.request.post('/api/sync', { headers, data: { id: randomUUID(), changes:[{ key:`series:${series.id}`, baseRevision:snapshot.versions[`series:${series.id}`], value:{...series,title:'ชื่อบนเซิร์ฟเวอร์'} }] } });
  expect(response.ok()).toBe(true);
  await context.setOffline(false); await store(page, async () => { const store = window.testStore; await store.sync(); });
  expect(await store(page, async () => { const store = window.testStore; return Boolean(store.cache.conflict); })).toBe(true);
  expect(await store(page, async () => { const store = window.testStore; return store.state.series[0].title; })).toBe('ชื่อในเครื่อง');
  expect((await (await context.request.get('/api/library')).json()).state.series[0].title).toBe('ชื่อบนเซิร์ฟเวอร์');
  await page.reload(); await page.locator('#connection').click();
  await expect(page.locator('#conflict-form')).toContainText('ชื่อในเครื่อง');
  await expect(page.locator('#conflict-form')).toContainText('ชื่อบนเซิร์ฟเวอร์');
  await page.locator('[name="keep-0"]').check();
  await page.getByRole('button',{name:'ใช้ข้อมูลที่เลือกแล้วซิงก์'}).click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await expect(page.locator('#connection')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');
  expect((await (await context.request.get('/api/library')).json()).state.series[0].title).toBe('ชื่อในเครื่อง');
});
test('expired session keeps pending changes for the original account', async ({ context, page }) => {
  const credentials = await register(context); await ready(page); await store(page, async () => { const store = window.testStore; return store.pending; });
  await context.setOffline(true); await store(page, async () => { const store = window.testStore; await store.mutate(s=>s.series[0].title='งานก่อนเซสชันหมด'); });
  await page.locator('.page-heading [data-add]').click();
  await page.locator('[name="title"]').fill('ฟอร์มก่อนเซสชันหมด');
  await context.request.post('/api/auth/logout',{ headers,data:{} });
  await context.setOffline(false); await store(page, async () => { const store = window.testStore; await store.sync(); });
  expect(await store(page, async () => { const store = window.testStore; return store.needsLogin; })).toBe(true);
  expect(await store(page, async () => { const store = window.testStore; return store.pending; })).toBe(1);
  await expect(page.locator('#auth-modal')).toBeVisible();
  await page.locator('#auth-modal [name="email"]').fill(credentials.email);
  await page.locator('#auth-modal [name="password"]').fill(credentials.password);
  await page.locator('#auth-modal [type="submit"]').click();
  await expect(page.locator('#auth-modal')).not.toBeVisible();
  await expect(page.locator('#modal [name="title"]')).toHaveValue('ฟอร์มก่อนเซสชันหมด');
  await expect.poll(() => store(page, async () => window.testStore.pending)).toBe(0);
  expect((await (await context.request.get('/api/library')).json()).state.series[0].title).toBe('งานก่อนเซสชันหมด');
});

test('a stale tab cannot overwrite another tab’s unsent offline edits', async ({ context, page }) => {
  await register(context); await ready(page);
  const other = await context.newPage(); await ready(other);
  await context.setOffline(true);
  await store(page, async () => { await window.testStore.mutate(s=>s.series[0].title='งานรอส่งแท็บแรก'); });
  const rejected = await store(other, async () => { try { await window.testStore.mutate(s=>s.series[0].title='แท็บเก่า'); return false; } catch { return window.testStore.needsReload; } });
  expect(rejected).toBe(true);
  await other.reload();
  expect(await store(other, async () => window.testStore.state.series[0].title)).toBe('งานรอส่งแท็บแรก');
  await context.setOffline(false); await other.close();
});

test('private cover is available offline only for its account and is cleared on logout', async ({ context, page }) => {
  await register(context);
  const { readFile } = await import('node:fs/promises');
  const snapshot = await (await context.request.get('/api/library')).json();
  const series = snapshot.state.series[0], entry = series.entries[0];
  const coverData = `data:image/png;base64,${(await readFile('public/icon-192.png')).toString('base64')}`;
  expect((await context.request.post('/api/sync',{headers,data:{id:randomUUID(),changes:[{key:`entry:${entry.id}`,baseRevision:snapshot.versions[`entry:${entry.id}`],value:{...entry,seriesId:series.id,coverData}}]}})).ok()).toBe(true);
  await ready(page); await page.evaluate(async()=>{await navigator.serviceWorker.ready;}); await page.reload();
  const photo = (await (await context.request.get('/api/library')).json()).state.series[0].entries[0].coverData;
  expect(await page.evaluate(async url=>(await fetch(url)).status,photo)).toBe(200);
  await context.setOffline(true);
  expect(await page.evaluate(async url=>(await fetch(url)).status,photo)).toBe(200);
  await context.setOffline(false);
  await page.locator('nav [data-page="settings"]').click();
  await page.getByRole('button',{name:'ออกจากระบบ',exact:true}).click();
  await expect(page.locator('#auth-form')).toBeVisible();
  expect(await page.evaluate(async()=> (await caches.keys()).filter(k=>k.startsWith('khanwai-private-')))).toEqual([]);
  await register(context); await page.reload();
  expect((await context.request.get(photo)).status()).toBe(404);
  await context.setOffline(true);
  expect(await page.evaluate(async url=>(await fetch(url)).status,photo)).toBe(503);
});

test('registration form creates a real empty account and saves its first reviewed book', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-auth-mode="register"]').click();
  await page.locator('#auth-form [name="name"]').fill('นักอ่านใหม่');
  await page.locator('#auth-form [name="email"]').fill(`${randomUUID()}@example.test`);
  await page.locator('#auth-form [name="password"]').fill('new-account-browser-password');
  await page.locator('#auth-form [type="submit"]').click();
  await expect(page.locator('#series-count')).toHaveText('0');
  await page.locator('.page-heading [data-add]').click();
  await page.locator('[name="title"]').fill('เล่มแรกของบัญชี');
  await page.locator('[name="label"]').fill('1');
  await page.getByRole('button',{name:'ตรวจแล้ว · เพิ่มเข้าชั้น'}).click();
  await expect(page.locator('#series-count')).toHaveText('1');
  await expect(page.locator('#connection')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');
  expect((await (await page.request.get('/api/library')).json()).state.series[0].title).toBe('เล่มแรกของบัญชี');
});

test('an outbox rejected by the server can be exported before explicitly discarding it', async ({ context, page }) => {
  await register(context); await ready(page);
  await page.route('**/api/sync',route => route.request().method()==='POST' ? route.fulfill({status:400,json:{error:'invalid_library',message:'ข้อมูลชุดนี้ส่งไม่ได้'}}) : route.continue());
  await store(page,async()=>{ await window.testStore.mutate(s=>s.series[0].title='งานที่ส่งไม่ได้'); await window.testStore.sync(); });
  await page.locator('nav [data-page="settings"]').click();
  await page.getByRole('button',{name:'กู้ข้อมูลจากเซิร์ฟเวอร์',exact:true}).click();
  const downloaded=page.waitForEvent('download');
  await page.locator('#modal #export').click();
  const download=await downloaded;
  const { readFile }=await import('node:fs/promises');
  expect(JSON.parse(await readFile(await download.path(),'utf8')).series[0].title).toBe('งานที่ส่งไม่ได้');
  await page.getByRole('button',{name:'ยืนยันละทิ้งคิวและโหลดใหม่'}).click();
  await expect(page.locator('#modal')).not.toBeVisible();
  expect(await store(page,async()=>window.testStore.pending)).toBe(0);
  expect(await store(page,async()=>window.testStore.state.series[0].title)).not.toBe('งานที่ส่งไม่ได้');
});

test('a server restored to an earlier cursor can refresh the local snapshot', async ({ context, page }) => {
  await register(context); await ready(page);
  await store(page,async()=>{ const store=window.testStore; await store.saveCache({...store.cache,cursor:store.cache.cursor+10000}); await store.sync(); });
  expect(await store(page,async()=>window.testStore.error)).toBe('');
  expect(await store(page,async()=>window.testStore.cache.cursor)).toBe((await (await page.request.get('/api/library')).json()).cursor);
});

test('a lost acknowledgement retries the original operation without duplicating the new volume', async ({ context, page }) => {
  await register(context); await ready(page);
  let dropped=false;
  await page.route('**/api/sync',async route=>{
    if(route.request().method()==='POST' && !dropped) { dropped=true; expect((await route.fetch()).ok()).toBe(true); await route.abort(); }
    else await route.continue();
  });
  await store(page,async()=>{
    const store=window.testStore;
    await store.mutate(s=>s.series[0].entries.push({...s.series[0].entries[0],id:crypto.randomUUID(),label:'99'}));
    await store.sync();
  });
  expect(dropped).toBe(true);
  expect(await store(page,async()=>window.testStore.pending)).toBe(1);
  expect((await (await context.request.get('/api/library')).json()).state.series[0].entries).toHaveLength(5);
  await page.unroute('**/api/sync');
  await store(page,async()=>{await window.testStore.sync();});
  expect(await store(page,async()=>window.testStore.pending)).toBe(0);
  expect((await (await context.request.get('/api/library')).json()).state.series[0].entries).toHaveLength(5);
});

test('a temporary server outage opens the existing account cache instead of losing access to the shelf', async ({ context, page }) => {
  await register(context); await ready(page);
  await page.route('**/api/auth/me',route=>route.fulfill({status:503,json:{error:'unavailable',message:'เซิร์ฟเวอร์พักชั่วคราว'}}));
  await page.reload();
  await expect(page.locator('#series-count')).toHaveText('6');
  await expect(page.locator('#connection')).toContainText('ออฟไลน์');
  await expect(page.locator('#auth-form')).toHaveCount(0);
});

test('two rapid taps on review confirmation create only one book', async ({ page }) => {
  await page.goto('/');
  const credentials={email:`${randomUUID()}@example.test`,password:'double-tap-test-password',name:'นักอ่าน'};
  await page.request.post('/api/auth/register',{headers,data:credentials});
  await page.reload(); await expect(page.locator('#series-count')).toHaveText('0');
  await page.locator('.page-heading [data-add]').click();
  await page.locator('[name="title"]').fill('หนังสือที่แตะยืนยันเร็ว');
  await page.locator('[name="label"]').fill('1');
  await page.evaluate(()=>{const form=document.querySelector('#review-form');form.requestSubmit();form.requestSubmit();});
  await expect(page.locator('#series-count')).toHaveText('1');
  await expect(page.locator('#connection')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');
  const state=(await (await page.request.get('/api/library')).json()).state;
  expect(state.series).toHaveLength(1); expect(state.series[0].entries).toHaveLength(1);
});

test('a waiting PWA update leaves the open form and durable outbox intact', async ({ context, page }) => {
  await register(context); await ready(page);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;}); await page.reload();
  await expect(page.locator('#connection')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');
  await context.route('**/api/sync',route=>route.request().method()==='POST'?route.abort():route.continue());
  await store(page,async()=>{const store=window.testStore;await store.mutate(s=>s.series[0].title='งานรอส่งก่อนอัปเดต');await store.sync();});
  await page.locator('.page-heading [data-add]').click();
  await page.locator('[name="title"]').fill('ฟอร์มที่ยังกรอกอยู่');
  const script=`/sw.js?acceptance=${randomUUID()}`;
  await page.evaluate(async script=>{await navigator.serviceWorker.register(script,{scope:'/'});},script);
  await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration('/')).waiting))).toBe(true);
  await expect(page.locator('[name="title"]')).toHaveValue('ฟอร์มที่ยังกรอกอยู่');
  expect(await store(page,async()=>window.testStore.pending)).toBe(1);
  // The user closes the old page; the waiting worker can now activate normally.
  await page.close();
  const reopened=await context.newPage(); await reopened.goto('/icon.svg');
  // Observe activation before app.js registers the canonical worker URL again.
  await expect.poll(()=>reopened.evaluate(async()=> (await navigator.serviceWorker.getRegistration('/'))?.active?.scriptURL)).toContain(script);
  await reopened.goto('/');
  expect(await store(reopened,async()=>window.testStore.pending)).toBe(1);
  expect(await store(reopened,async()=>window.testStore.state.series[0].title)).toBe('งานรอส่งก่อนอัปเดต');
  await context.unroute('**/api/sync');
  await store(reopened,async()=>{await window.testStore.sync();});
  expect(await store(reopened,async()=>window.testStore.pending)).toBe(0);
});
