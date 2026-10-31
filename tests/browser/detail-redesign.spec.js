import { activeLibrary } from '../../public/trash.js';
import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { seedState } from '../../public/lib.js';
import { recordDiff,emptyLibrary } from '../../public/sync-core.js';
const headers={'X-Book-Request':'1'};
async function library(page){return(await(await page.request.get('/api/library')).json()).state;}
function fixture(){const state=seedState();const s=state.series[0];s.target=Array.from({length:10},(_,i)=>String(i+1));s.entries=s.target.map((label,i)=>({id:`detail-${label}`,kind:'volume',label,status:'owned',quantity:i===0?2:1,isbn:i===0?'9780306406157':'',location:i===0?'ตู้ A ชั้นบน':'',readingStatus:i===0?'read':'unread'}));return state;}
test.beforeEach(async({page})=>{
 expect((await page.request.post('/api/auth/register',{headers,data:{email:`detail-${randomUUID()}@example.test`,password:'detail-test-password',name:'ทดสอบรายละเอียด'}})).status()).toBe(201);
 expect((await page.request.post('/api/sync',{headers,data:{id:randomUUID(),changes:recordDiff(emptyLibrary(),fixture()).map(c=>({...c,baseRevision:0}))}})).ok()).toBe(true);
 await page.goto('/');await expect(page.locator('#series-count')).toHaveText('6');await page.locator('[data-detail=sample-0]').click();
});
test('volume cards group their controls, hide secondary actions and fit a 320px dialog without writing state',async({page})=>{
 const before=await library(page);await expect(page.locator('.detail-entry')).toHaveCount(10);await expect(page.locator('[data-detail-entry=detail-1]')).toContainText('9780306406157');await expect(page.locator('[data-detail-entry=detail-1]')).toContainText('2 สำเนา');await expect(page.locator('[data-edit-entry=detail-1]')).not.toBeVisible();
 await page.setViewportSize({width:320,height:800});await page.locator('[data-detail-entry=detail-2]').scrollIntoViewIfNeeded();expect(await page.locator('#modal').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 for(const selector of ['[data-entry-status=detail-2]','[data-entry-reading=detail-2]','[data-entry-actions=detail-2] summary'])expect((await page.locator(selector).boundingBox()).height).toBeGreaterThanOrEqual(44);
 const toggle=page.locator('[data-entry-actions=detail-2] summary');await toggle.focus();await page.keyboard.press('Enter');await expect(page.locator('[data-edit-entry=detail-2]')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#modal')).toBeVisible();await expect(toggle).toBeFocused();await expect(page.locator('[data-edit-entry=detail-2]')).not.toBeVisible();expect(await library(page)).toEqual(before);
});
test('volume actions edit the selected record and deletion still requires confirmation',async({page})=>{
 const before=await library(page);await page.locator('[data-entry-actions=detail-2] summary').click();await page.getByRole('button',{name:'แก้ไขข้อมูล 2',exact:true}).click();await expect(page.locator('#edit-entry-form [name=label]')).toHaveValue('2');await page.locator('#edit-entry-form [name=location]').fill('โต๊ะอ่านหนังสือ');await page.getByRole('button',{name:'บันทึกข้อมูลเล่ม',exact:true}).click();
 await expect.poll(async()=>(await library(page)).series[0].entries[1].location).toBe('โต๊ะอ่านหนังสือ');await page.locator('[data-entry-actions=detail-2] summary').click();const unchanged=await library(page);page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'ลบรายการ 2',exact:true}).click();expect(await library(page)).toEqual(unchanged);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'ลบรายการ 2',exact:true}).click();await expect(page.locator('.detail-entry')).toHaveCount(9);await expect.poll(async()=>activeLibrary(await library(page)).series[0].entries.length).toBe(9);
 const saved=await library(page);expect(activeLibrary(saved).series[0].entries).toEqual(before.series[0].entries.filter(e=>e.id!=='detail-2'));expect(saved.series[0].entries.find(e=>e.id==='detail-2').trashedAt).toBeTruthy();expect(saved.series.slice(1)).toEqual(before.series.slice(1));expect(saved.series[0].target).toEqual(before.series[0].target);await expect(page.locator('.volume-chip.missing')).toHaveText('2');
});
test('changing a late volume preserves scroll and focus, keeps reading separate and leaves box expansion open',async({page})=>{
 const before=await library(page);await page.locator('[data-entry-status=detail-9]').scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'ปิดหน้าต่าง'})).toBeInViewport();const scroll=await page.locator('#modal').evaluate(el=>el.scrollTop);await page.locator('[data-entry-status=detail-9]').selectOption('ordered');await expect(page.locator('[data-entry-status=detail-9]')).toBeFocused();expect(Math.abs((await page.locator('#modal').evaluate(el=>el.scrollTop))-scroll)).toBeLessThan(5);await page.locator('[data-entry-reading=detail-9]').selectOption('planned');await expect(page.locator('[data-entry-reading=detail-9]')).toBeFocused();await expect.poll(async()=>(await library(page)).series[0].entries[8].readingStatus).toBe('planned');
 const saved=await library(page);expect(saved.series[0].entries[8].status).toBe('ordered');expect(saved.series[0].entries[0]).toEqual(before.series[0].entries[0]);expect(saved.series[0].entries).toHaveLength(10);
 await page.getByRole('button',{name:'ปิดหน้าต่าง'}).click();await page.locator('[data-detail=sample-2]').click();await page.locator('[data-box-reading] summary').click();await page.locator('[data-reading-member="1"]').selectOption('read');const boxId=before.series[2].entries[0].id;await page.locator(`[data-entry-status="${boxId}"]`).selectOption('ordered');await expect(page.locator('[data-box-reading]')).toHaveAttribute('open','');await expect(page.locator('[data-reading-member="1"]')).toHaveValue('read');expect((await library(page)).series[2].entries).toHaveLength(1);
});
test('closing read-only details keeps search focus; content received while open still refreshes on close',async({page})=>{
 await page.evaluate(()=>{document.querySelector('#modal').close();document.querySelector('#search').focus();});await page.evaluate(()=>new Promise(requestAnimationFrame));await expect(page.getByRole('textbox',{name:'ค้นหาหนังสือ'})).toBeFocused();await page.getByRole('textbox',{name:'ค้นหาหนังสือ'}).fill('พันลี้');await expect(page.locator('.book-card')).toHaveCount(1);
 await page.getByRole('button',{name:'ล้างคำค้น',exact:true}).click();await page.locator('[data-detail=sample-0]').click();
 const snapshot=await(await page.request.get('/api/library')).json(),next=structuredClone(snapshot.state);next.series[0].title='ชื่อใหม่จากอีกเครื่อง';
 expect((await page.request.post('/api/sync',{headers,data:{id:randomUUID(),changes:recordDiff(snapshot.state,next).map(c=>({...c,baseRevision:snapshot.versions[c.key]??0}))}})).ok()).toBe(true);
 await page.evaluate(async()=>{const {account}=await import('/app.js');await account.sync();});await page.getByRole('button',{name:'ปิดหน้าต่าง'}).click();await expect(page.locator('[data-detail=sample-0]')).toContainText('ชื่อใหม่จากอีกเครื่อง');
});
