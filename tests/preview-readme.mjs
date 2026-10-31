// Public README assets: synthetic books/account only, isolated from the real app.
import { createApp } from '../server.mjs';
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { seedState } from '../public/lib.js';
import { recordDiff, emptyLibrary } from '../public/sync-core.js';
import { randomUUID } from 'node:crypto';

const directory=await mkdtemp(join(tmpdir(),'book-readme-')),app=createApp({dataDirectory:directory});
app.listen(0,'127.0.0.1');await once(app,'listening');
const origin=`http://127.0.0.1:${app.address().port}`,browser=await chromium.launch();
const destination='docs/images/readme';
try {
  await mkdir(destination,{recursive:true});
  const page=await browser.newPage({baseURL:origin,viewport:{width:1440,height:900},deviceScaleFactor:1}),headers={'X-Book-Request':'1'};
  expect((await page.request.post('/api/auth/register',{headers,data:{email:'reader@example.test',password:'readme-fixture-only',name:'ชั้นหนังสือตัวอย่าง'}})).status()).toBe(201);
  const state=seedState();
  state.series[0].entries[0].readingStatus='read';state.series[0].entries[1].readingStatus='reading';
  state.series[0].tags=['เล่มโปรด'];state.series[0].entries[0].location='ตู้ข้างหน้าต่าง';
  state.series[2].entries[0].readingByMember={'1':'read','2':'unread','3':'planned'};
  expect((await page.request.post('/api/sync',{headers,data:{id:randomUUID(),changes:recordDiff(emptyLibrary(),state).map(change=>({...change,baseRevision:0}))}})).ok()).toBe(true);
  await page.goto('/');await expect(page.locator('#series-count')).toHaveText('6');await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('#connection')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');
  const desktop=await page.screenshot();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const mobile=await page.screenshot();
  await page.setViewportSize({width:1180,height:1060});
  await page.locator('nav [data-page=check]').click();await page.getByRole('textbox',{name:'ค้นหาหนังสือ'}).fill('พันลี้');
  await page.locator('#check-volume').fill('2');
  await expect(page.locator('[data-check-result=sample-2]')).toBeVisible();
  await page.screenshot({path:`${destination}/check-before-buy.png`});
  await page.locator('[data-check-result=sample-2] [data-detail]').first().click();
  await expect(page.locator('.detail-entry')).toHaveCount(1);
  await page.locator('[data-box-reading] summary').click();
  await page.screenshot({path:`${destination}/book-details.png`});
  await page.getByRole('button',{name:'ปิดหน้าต่าง'}).click();await page.locator('nav [data-page=shelf]').click();
  await page.locator('.shelf-manage summary').click();await page.locator('#random-unread').click();
  await expect(page.getByRole('heading',{name:'สุ่มได้เรื่องนี้',exact:true})).toBeVisible();
  await page.locator('#modal').screenshot({path:`${destination}/unread-picker.png`});

  const hero=await browser.newPage({viewport:{width:1600,height:1040},deviceScaleFactor:1});
  const font=(await readFile('public/fonts/NotoSansThai.ttf')).toString('base64');
  const icon=(await readFile('public/icon-192.png')).toString('base64');
  await hero.setContent(`<!doctype html><html lang="th"><meta charset="utf-8"><style>
    @font-face{font-family:Thai;src:url(data:font/ttf;base64,${font})}*{box-sizing:border-box}body{margin:0;background:#f0f0e5;color:#294239;font-family:Thai,sans-serif}
    .canvas{position:relative;width:1600px;height:1040px;overflow:hidden;background:radial-gradient(ellipse at 90% 85%,#cad5c0,transparent 52%),#f7f5ee}
    .header{position:absolute;left:52px;right:52px;top:38px;display:flex;align-items:center;gap:22px}.logo{width:82px;height:82px}.title h1{font-size:48px;line-height:1.3;margin:0;font-weight:700}.title p{font-size:20px;margin:5px 0 0;color:#64725b}.pills{display:flex;gap:10px;margin-left:auto}.pills span{padding:10px 19px;border:1px solid #dce1d1;border-radius:30px;font-size:16px;background:#ffffff80;color:#48634f}
    .desktop,.phone{position:absolute;overflow:hidden;background:#f7f5ee;box-shadow:0 18px 54px #293e3524}.desktop{top:174px;left:52px;width:1210px;border:1px solid #d4d9cb;border-radius:14px}.bar{height:33px;display:flex;align-items:center;gap:6px;padding:0 15px;background:#e9ebdf;border-bottom:1px solid #d9dece}.dot{width:7px;height:7px;border-radius:50%;background:#a6b09b}.bar small{margin-left:12px;color:#78846f;letter-spacing:2px;font-size:9px}.desktop img{display:block;width:100%}.phone{top:303px;right:48px;width:282px;border:6px solid #e4e8db;border-radius:30px;box-shadow:0 22px 70px #293e3540}.phone img{display:block;width:100%}.foot{position:absolute;left:55px;bottom:22px;color:#6d7b64;font-size:13px;letter-spacing:1px}
    </style><body><div class="canvas"><div class="header"><img class="logo" src="data:image/png;base64,${icon}" alt=""><div class="title"><h1>คั่นไว้</h1><p>เล่มนี้มีหรือยัง? เช็กก่อนพากลับบ้าน</p></div><div class="pills"><span>หนังสือเล่ม + ebook</span><span>เปิดข้ามเครื่อง</span><span>Docker · PWA</span></div></div><div class="desktop"><div class="bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><small>MY LITTLE LIBRARY</small></div><img src="data:image/png;base64,${desktop.toString('base64')}" alt="หน้าชั้นหนังสือบนคอม"></div><div class="phone"><img src="data:image/png;base64,${mobile.toString('base64')}" alt="หน้าชั้นหนังสือบนมือถือ"></div><div class="foot">YOUR BOOKS, A LITTLE MORE ORGANIZED. · ภาพจากข้อมูลตัวอย่าง</div></div></body></html>`);
  await hero.evaluate(()=>document.fonts.ready);await hero.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  await hero.screenshot({path:`${destination}/overview.png`});
  console.log(`Generated 4 public README images in ${destination}, using only the isolated sample account and built-in book art.`);
} finally {await browser.close();await new Promise(resolve=>{app.closeAllConnections();app.close(resolve);});await rm(directory,{recursive:true,force:true});}
