import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { seedState } from '../../public/lib.js';
import { emptyLibrary, recordDiff } from '../../public/sync-core.js';
import { activeLibrary } from '../../public/trash.js';
const headers={'X-Book-Request':'1'};
async function snapshot(page){return(await(await page.request.get('/api/library')).json());}
async function trash(page){await page.locator('nav [data-page=settings]').click();await page.locator('#open-trash').click();await expect(page.getByRole('heading',{name:'ถังขยะ',exact:true})).toBeVisible();}
test.beforeEach(async({page})=>{
  expect((await page.request.post('/api/auth/register',{headers,data:{email:`trash-${randomUUID()}@example.test`,password:'trash-test-password',name:'นักอ่านทดสอบ'}})).status()).toBe(201);
  const state=seedState();state.series[0].title='หนังสือทดสอบ '+ 'A'.repeat(180);for(const series of state.series)for(const entry of series.entries){entry.readingStatus='read';if(entry.kind==='box')entry.readingByMember={};}
  state.series[0].entries[0].readingStatus='unread';
  state.series[0].entries[0].coverData=`data:image/png;base64,${(await readFile('public/icon-192.png')).toString('base64')}`;
  expect((await page.request.post('/api/sync',{headers,data:{id:randomUUID(),changes:recordDiff(emptyLibrary(),state).map(c=>({...c,baseRevision:0}))}})).ok()).toBe(true);
  await page.goto('/');await expect(page.locator('#series-count')).toHaveText('6');
});

test('random unread uses owned books, respects filters and does not change reading or library data',async({page})=>{
  const before=await snapshot(page);
  await page.locator('.shelf-manage summary').click();await page.locator('#random-unread').click();
  await expect(page.getByRole('heading',{name:'สุ่มได้เรื่องนี้',exact:true})).toBeVisible();
  await expect(page.locator('#modal-content')).toContainText(before.state.series[0].title);
  await expect(page.locator('#pick-again')).toBeDisabled();
  await page.setViewportSize({width:320,height:800});expect(await page.locator('#modal').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  expect((await snapshot(page)).state).toEqual(before.state);
  await page.getByRole('button',{name:'ดูรายละเอียด',exact:true}).click();
  await expect(page.getByRole('heading',{name:'รายละเอียดบนชั้น',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'ปิดหน้าต่าง'}).click();
  await page.locator('#search').fill('ไม่มีหนังสือชื่อนี้');await page.locator('.shelf-manage summary').click();await page.locator('#random-unread').click();
  await expect(page.getByRole('heading',{name:'ยังไม่มีเรื่องให้สุ่ม',exact:true})).toBeVisible();
  expect((await snapshot(page)).state).toEqual(before.state);
});

test('a trashed entry keeps its photo and state, and restores using the same ID',async({page})=>{
  const before=(await snapshot(page)).state,entry=before.series[0].entries[0];
  await page.locator('[data-detail=sample-0]').click();await page.locator(`[data-entry-actions="${entry.id}"] summary`).click();
  page.once('dialog',d=>d.accept());await page.locator(`[data-delete-entry="${entry.id}"]`).click();
  await expect(page.locator(`[data-detail-entry="${entry.id}"]`)).toHaveCount(0);
  await expect.poll(async()=>Boolean((await snapshot(page)).state.series[0].entries[0].trashedAt)).toBe(true);
  expect((await page.request.get(entry.coverData)).ok()).toBe(true);
  await page.getByRole('button',{name:'ปิดหน้าต่าง'}).click();await trash(page);
  await page.locator(`[data-restore-id="${entry.id}"]`).click();await page.getByRole('button',{name:'ยืนยันกู้คืน',exact:true}).click();
  await expect.poll(async()=>(await snapshot(page)).state.series[0].entries[0].trashedAt).toBeUndefined();
  const restored=(await snapshot(page)).state.series[0].entries[0];
  const {updatedAt,...data}=restored;expect(data).toEqual(entry);
  await page.getByRole('button',{name:'ปิดหน้าต่าง'}).click();await page.locator('nav [data-page=shelf]').click();await page.locator('[data-detail=sample-0]').click();
  await expect(page.locator(`[data-detail-entry="${entry.id}"]`)).toBeVisible();
});

test('whole editions disappear across devices and recover offline without losing entries',async({page,context,browser},info)=>{
  const before=(await snapshot(page)).state;
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();
  await page.locator('[data-detail=sample-0]').click();page.once('dialog',d=>d.accept());await page.locator('[data-trash-series=sample-0]').click();
  await expect(page.locator('#series-count')).toHaveText('5');
  await expect.poll(async()=>Boolean((await snapshot(page)).state.series[0].trashedAt)).toBe(true);
  const other=await browser.newContext({storageState:await context.storageState(),baseURL:info.project.use.baseURL});
  try{const p=await other.newPage();await p.goto('/');await expect(p.locator('#series-count')).toHaveText('5');}finally{await other.close();}
  await trash(page);await page.locator('[data-restore-id=sample-0]').click();await context.setOffline(true);
  await page.getByRole('button',{name:'ยืนยันกู้คืน',exact:true}).click();await expect(page.locator('#trash-count')).toHaveText('0 รายการ');
  await page.reload();await expect(page.locator('#series-count')).toHaveText('6');
  await context.setOffline(false);await page.locator('#connection').click();
  await expect.poll(async()=>(await snapshot(page)).state.series[0].trashedAt).toBeUndefined();
  expect((await snapshot(page)).state.series[0].entries).toEqual(before.series[0].entries);
});

test('restoring an entry with a replacement copy requires duplicate review',async({page})=>{
  const first=await snapshot(page),entry=first.state.series[0].entries[0];
  await page.locator('[data-detail=sample-0]').click();await page.locator(`[data-entry-actions="${entry.id}"] summary`).click();page.once('dialog',d=>d.accept());await page.locator(`[data-delete-entry="${entry.id}"]`).click();
  await expect.poll(async()=>Boolean((await snapshot(page)).state.series[0].entries[0].trashedAt)).toBe(true);
  const current=await snapshot(page);
  expect((await page.request.post('/api/sync',{headers,data:{id:randomUUID(),changes:[{key:'entry:replacement-copy',baseRevision:0,value:{...entry,id:'replacement-copy',seriesId:'sample-0'}}]}})).ok()).toBe(true);
  await page.reload();await trash(page);await page.locator(`[data-restore-id="${entry.id}"]`).click();
  await expect(page.locator('[name=confirmDuplicate]')).toBeVisible();
  await page.getByRole('button',{name:'ยืนยันกู้คืน',exact:true}).click();
  expect((await snapshot(page)).state.series[0].entries[0].trashedAt).toBeTruthy();
  await page.locator('[name=confirmDuplicate]').check();await page.getByRole('button',{name:'ยืนยันกู้คืน',exact:true}).click();
  await expect.poll(async()=>activeLibrary((await snapshot(page)).state).series[0].entries.length).toBe(current.state.series[0].entries.length+1);
});

test('drafts recover in the review tray',async({page})=>{
  await page.locator('.page-heading [data-add]').click();await page.locator('[name=title]').fill('เรื่องที่รอตรวจ');
  await page.getByRole('button',{name:'เก็บไว้ในถาดรอตรวจ'}).click();await page.locator('nav [data-page=drafts]').click();
  const row=page.locator('.draft-row').filter({hasText:'เรื่องที่รอตรวจ'});
  const id=await row.locator('[data-remove-draft]').getAttribute('data-remove-draft');
  page.once('dialog',d=>d.accept());await row.locator('[data-remove-draft]').click();await expect(row).toHaveCount(0);
  await expect.poll(async()=>Boolean((await snapshot(page)).state.drafts.find(d=>d.id===id)?.trashedAt)).toBe(true);
  await trash(page);await page.locator(`[data-restore-id="${id}"]`).click();await page.getByRole('button',{name:'ยืนยันกู้คืน',exact:true}).click();
  await expect(page.locator('#trash-count')).toHaveText('0 รายการ');await page.getByRole('button',{name:'ปิดหน้าต่าง'}).click();
  await page.locator('nav [data-page=drafts]').click();await expect(row).toHaveCount(1);
});

test('a series trashed on another device cannot be edited through a stale form',async({page})=>{
  await page.locator('[data-detail=sample-0]').click();await page.locator('[data-edit-series=sample-0]').click();
  await page.locator('[name=title]').fill('การแก้จากฟอร์มเก่า');
  const current=await snapshot(page),{entries,...series}=current.state.series[0];
  expect((await page.request.post('/api/sync',{headers,data:{id:randomUUID(),changes:[{key:'series:sample-0',baseRevision:current.versions['series:sample-0'],value:{...series,trashedAt:new Date().toISOString()}}]}})).ok()).toBe(true);
  await page.evaluate(async()=>{const {account}=await import('/app.js');await account.sync();});
  await page.getByRole('button',{name:'บันทึกข้อมูลเรื่อง',exact:true}).click();
  await expect(page.locator('#toast')).toContainText('ถังขยะ');
  expect((await snapshot(page)).state.series[0].title).toBe(series.title);
  expect((await snapshot(page)).state.series[0].trashedAt).toBeTruthy();
});

test('loading samples preserves personal trash and a category used only in trash can be moved',async({page})=>{
  const current=await snapshot(page),next=structuredClone(current.state),original=next.series[0];
  const personal={...structuredClone(original),id:'personal-trash',title:'หนังสือส่วนตัวในถังขยะ',sample:false,category:'หมวดในถังขยะ',trashedAt:new Date().toISOString(),entries:original.entries.map((entry,index)=>({...entry,id:`personal-entry-${index}`}))};
  next.series.push(personal);
  expect((await page.request.post('/api/sync',{headers,data:{id:randomUUID(),changes:recordDiff(current.state,next).map(c=>({...c,baseRevision:current.versions[c.key]??0}))}})).ok()).toBe(true);
  await page.reload();await page.locator('nav [data-page=settings]').click();
  page.once('dialog',d=>d.accept());await page.locator('#clear-samples').click();await expect(page.locator('#load-samples')).toBeVisible();
  await page.locator('#load-samples').click();await expect(page.locator('#series-count')).toHaveText('6');
  await expect.poll(async()=>Boolean((await snapshot(page)).state.series.find(s=>s.id==='personal-trash')?.trashedAt)).toBe(true);
  await page.locator('#manage-categories').click();await page.locator('.category-row').filter({hasText:'หมวดในถังขยะ'}).getByRole('button',{name:'ลบ',exact:true}).click();
  await expect(page.locator('[name=categoryTarget]')).toBeVisible();await page.locator('[name=categoryTarget]').selectOption('การ์ตูน');
  await page.getByRole('button',{name:'บันทึกหมวดหมู่',exact:true}).click();
  await expect.poll(async()=>(await snapshot(page)).state.series.find(s=>s.id==='personal-trash')?.category).toBe('การ์ตูน');
  const saved=(await snapshot(page)).state.series.find(s=>s.id==='personal-trash');expect(saved.trashedAt).toBe(personal.trashedAt);expect(saved.entries).toEqual(personal.entries);
});
