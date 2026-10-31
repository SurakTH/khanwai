// Render only an isolated fixture, never the user's account or attached images.
import { createApp } from '../server.mjs';
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { seedState } from '../public/lib.js';
import { recordDiff, emptyLibrary } from '../public/sync-core.js';
const directory=await mkdtemp(join(tmpdir(),'book-trash-preview-')),app=createApp({dataDirectory:directory});
app.listen(0,'127.0.0.1');await once(app,'listening');
const browser=await chromium.launch();
try {
  const page=await browser.newPage({baseURL:`http://127.0.0.1:${app.address().port}`}),headers={'X-Book-Request':'1'};
  expect((await page.request.post('/api/auth/register',{headers,data:{email:`${randomUUID()}@example.test`,password:'trash-preview-only',name:'ตัวอย่างชั้นหนังสือ'}})).status()).toBe(201);
  const state=seedState();state.series=state.series.slice(0,1);state.series[0].title='จดหมายถึงวันพรุ่งนี้';
  state.series[0].entries[0].coverData=`data:image/png;base64,${(await readFile('public/icon-192.png')).toString('base64')}`;
  expect((await page.request.post('/api/sync',{headers,data:{id:randomUUID(),changes:recordDiff(emptyLibrary(),state).map(c=>({...c,baseRevision:0}))}})).ok()).toBe(true);
  await page.goto('/');await expect(page.locator('#series-count')).toHaveText('1');await page.evaluate(()=>document.fonts.ready);
  await mkdir('docs/screenshots',{recursive:true});
  const sizes=[['desktop',1440,1000],['mobile',390,844],['narrow',320,800]];
  for(const [name,width,height] of sizes){
    await page.setViewportSize({width,height});await page.locator('.shelf-manage summary').click();await page.locator('#random-unread').click();
    expect(await page.locator('#modal').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.screenshot({path:`docs/screenshots/unread-pick-${name}.png`});await page.getByRole('button',{name:'ปิดหน้าต่าง'}).click();
  }
  await page.locator('.book-card[data-detail=sample-0]').click();page.once('dialog',d=>d.accept());await page.locator('[data-trash-series=sample-0]').click();
  await page.locator('nav [data-page=settings]').click();await page.locator('#open-trash').click();
  for(const [name,width,height] of sizes){
    await page.setViewportSize({width,height});expect(await page.locator('#modal').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.screenshot({path:`docs/screenshots/trash-${name}.png`});
    await page.locator('[data-restore-id=sample-0]').click();expect(await page.locator('#modal').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.screenshot({path:`docs/screenshots/trash-review-${name}.png`});await page.locator('#trash-back').click();
  }
  console.log('Unread picker/trash/recovery previews passed at 320/390/1440px.');
}finally{await browser.close();await new Promise(resolve=>{app.closeAllConnections();app.close(resolve);});await rm(directory,{recursive:true,force:true});}
