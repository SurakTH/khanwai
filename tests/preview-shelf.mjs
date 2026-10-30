// Isolated visual review: never creates accounts or writes data in the user's instance.
import { createApp } from '../server.mjs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { seedState } from '../public/lib.js';
import { recordDiff, emptyLibrary } from '../public/sync-core.js';
const stage = process.argv[2] ?? 'after';
if (!['before','after'].includes(stage)) throw Error('Use before or after');
const directory=await mkdtemp(join(tmpdir(),'book-shelf-preview-')),app=createApp({dataDirectory:directory});
app.listen(0,'127.0.0.1');await once(app,'listening');
const browser=await chromium.launch(),measurements=[];
try {
 const page=await browser.newPage({baseURL:`http://127.0.0.1:${app.address().port}`}),headers={'X-Book-Request':'1'};
 expect((await page.request.post('/api/auth/register',{headers,data:{email:`${randomUUID()}@example.test`,password:'preview-only-password',name:'นักอ่านทดสอบ'}})).status()).toBe(201);
 const state=seedState();state.series[0].tags=['ฉบับสะสม'];state.series[0].entries[0].readingStatus='read';state.series[0].entries[0].location='ตู้ A ชั้น 2';
 expect((await page.request.post('/api/sync',{headers,data:{id:randomUUID(),changes:recordDiff(emptyLibrary(),state).map(c=>({...c,baseRevision:0}))}})).ok()).toBe(true);
 await page.goto('/');await expect(page.locator('#series-count')).toHaveText('6');await page.evaluate(()=>document.fonts.ready);
 for(const [name,width,height] of [['mobile',390,844],['desktop',1440,1000],['narrow',320,800]]) {
  await page.setViewportSize({width,height});
  const first=await page.locator('.book-card .cover-stage').first().boundingBox();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(stage==='after') {
   const card=await page.locator('.book-card').first().boundingBox(),book=await page.locator('.book-card .cover').first().boundingBox();
   expect(Math.abs(first.x-card.x)).toBeLessThan(1);
   expect(Math.abs(first.width-card.width)).toBeLessThan(1);
   expect(Math.abs(first.height/first.width-(width<=560?1.22:1.12))).toBeLessThan(.01);
   expect(book.height/first.height).toBeGreaterThan(.88);
   expect(book.height).toBeLessThan(first.height);
  }

  measurements.push({name,width,firstCoverY:Math.round(first.y),visibleBooks:await page.locator('.book-card').evaluateAll(cards=>cards.filter(card=>{const r=card.getBoundingClientRect();return r.top<innerHeight-68&&r.bottom>0;}).length)});
  if(name!=='narrow')await page.screenshot({path:`docs/screenshots/shelf-${stage}-${name}.png`});
 }
 if(stage==='after') {
  await page.setViewportSize({width:390,height:844});
  await page.locator('.shelf-filters summary').click();
  await page.screenshot({path:'docs/screenshots/shelf-after-filters-mobile.png',fullPage:true});
  await page.locator('#close-shelf-filters').click();
  await page.getByRole('button',{name:'รายการย่อ',exact:true}).click();
  await page.screenshot({path:'docs/screenshots/shelf-after-list-mobile.png'});
 }
 if(stage==='after') {
  await page.getByRole('button',{name:'ปก',exact:true}).click();
  for(const width of [320,375,430,768,820,1024]) {
   await page.setViewportSize({width,height:900});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect((await page.locator('.shelf-results-bar').boundingBox()).height).toBeLessThanOrEqual(48);
  }
 }
 await writeFile(`/tmp/book-shelf-${stage}-measurements.json`,JSON.stringify(measurements,null,2));
 console.log(JSON.stringify(measurements));
} finally { await browser.close();await new Promise(resolve=>app.close(resolve));await rm(directory,{recursive:true,force:true}); }
