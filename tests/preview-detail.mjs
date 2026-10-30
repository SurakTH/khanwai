// Uses an isolated account/DB, never the user's library or attached cover.
import { createApp } from '../server.mjs';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { chromium,expect } from '@playwright/test';
import { seedState } from '../public/lib.js';
import { recordDiff,emptyLibrary } from '../public/sync-core.js';
const directory=await mkdtemp(join(tmpdir(),'book-detail-preview-')),app=createApp({dataDirectory:directory});
app.listen(0,'127.0.0.1');await once(app,'listening');
const browser=await chromium.launch();
try {
 const page=await browser.newPage({baseURL:`http://127.0.0.1:${app.address().port}`}),headers={'X-Book-Request':'1'};
 expect((await page.request.post('/api/auth/register',{headers,data:{email:`${randomUUID()}@example.test`,password:'detail-preview-password',name:'ตัวอย่าง'}})).status()).toBe(201);
 const state=seedState();state.series=state.series.slice(0,1);const series=state.series[0];series.title='จดหมายถึงวันพรุ่งนี้';series.format='physical';series.target=Array.from({length:10},(_,i)=>String(i+1));series.entries=series.target.map((label,index)=>({id:`preview-${label}`,kind:'volume',label,status:index===4?'ordered':'owned',quantity:1,isbn:index===0?'9780306406157':'',readingStatus:index<3?'read':'unread',location:index===0?'ตู้หนังสือข้างหน้าต่าง':''}));
 expect((await page.request.post('/api/sync',{headers,data:{id:randomUUID(),changes:recordDiff(emptyLibrary(),state).map(c=>({...c,baseRevision:0}))}})).ok()).toBe(true);
 await page.goto('/');await expect(page.locator('#series-count')).toHaveText('1');await page.evaluate(()=>document.fonts.ready);
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['narrow',320,800]]) {
  await page.setViewportSize({width,height});await page.locator('[data-detail=sample-0]').click();
  expect(await page.locator('#modal').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  if(name!=='narrow')await page.screenshot({path:`docs/screenshots/detail-after-${name}.png`});
  if(name==='desktop') {await page.locator('[data-detail-entry=preview-3]').scrollIntoViewIfNeeded();await page.screenshot({path:'docs/screenshots/detail-volumes-desktop.png'});}
  if(name==='mobile') {await page.locator('[data-detail-entry=preview-2]').scrollIntoViewIfNeeded();await page.screenshot({path:'docs/screenshots/detail-volumes-mobile.png'});}
  await page.getByRole('button',{name:'ปิดหน้าต่าง'}).click();
 }
 console.log('Detail screenshots and 320/390/1440px overflow checks passed.');
} finally {await browser.close();await new Promise(resolve=>app.close(resolve));await rm(directory,{recursive:true,force:true});}
