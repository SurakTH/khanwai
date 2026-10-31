import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const headers={'X-Book-Request':'1'};
const library=async page=>(await(await page.request.get('/api/library')).json()).state;
const png=async(size=192)=>(await readFile(`public/icon-${size}.png`)).toString('base64');
async function paste(page,{data,type='image/png',text}={}) {
  await page.locator('.photo-paste-options').evaluate(el=>el.open=true);
  await page.locator('#photo-paste').evaluate((area,{data,type,text})=>{
    const transfer=new DataTransfer();
    if(data)transfer.items.add(new File([Uint8Array.from(atob(data),char=>char.charCodeAt(0))],'clipboard-image',{type}));
    if(text)transfer.setData('text/plain',text);
    area.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}));
  },{data,type,text});
}
async function add(page,title='หนังสือที่วางปก') {
  await page.locator('.page-heading [data-add]').click();await page.locator('[name=title]').fill(title);await page.locator('[name=label]').fill('1');
}
test.beforeEach(async({page})=>{
  expect((await page.request.post('/api/auth/register',{headers,data:{email:`paste-${randomUUID()}@example.test`,password:'paste-test-password',name:'นักอ่านทดสอบ'}})).status()).toBe(201);
  await page.goto('/');await expect(page.locator('#series-count')).toHaveText('0');
});

test('pasted image previews without saving, survives draft review and reload, and keeps normal text paste outside the cover area',async({page})=>{
  await add(page);
  expect(await page.locator('.photo-paste-options').evaluate(el=>el.open)).toBe(false);
  const positions=await page.locator('#review-form').evaluate(form=>({photo:form.querySelector('.photo-editor').getBoundingClientRect().top,fields:form.querySelector('.form-grid').getBoundingClientRect().bottom}));
  expect(positions.photo).toBeGreaterThanOrEqual(positions.fields);
  await paste(page,{data:await png()});await expect(page.locator('#photo-status')).toContainText('เตรียมรูปแล้ว');
  await expect(page.locator('#photo-preview img')).toHaveAttribute('src',/^data:image\/jpeg;base64,/);
  expect((await library(page)).series).toHaveLength(0);
  const source=await page.locator('#photo-preview img').getAttribute('src');
  await paste(page,{text:'https://example.test/image.png'});await expect(page.locator('#photo-status')).toContainText('คัดลอกรูปภาพ');
  await expect(page.locator('#photo-preview img')).toHaveAttribute('src',source);
  await page.locator('[name=author]').evaluate(el=>{
    const data=new DataTransfer();data.setData('text/plain','ข้อความผู้เขียน');
    const event=new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true});el.dispatchEvent(event);
    if(event.defaultPrevented)throw Error('Cover paste handler intercepted an unrelated field');
  });
  await page.getByRole('button',{name:'เก็บไว้ในถาดรอตรวจ'}).click();await page.locator('nav [data-page=drafts]').click();
  await page.getByRole('button',{name:'ตรวจข้อมูล',exact:true}).click();await expect(page.locator('#photo-preview img')).toBeVisible();
  await page.getByRole('button',{name:'ตรวจแล้ว · เพิ่มเข้าชั้น'}).click();await expect(page.locator('#modal')).not.toBeVisible();
  await expect.poll(async()=>(await library(page)).series.length).toBe(1);await page.reload();await expect(page.locator('.book-card img')).toHaveCount(1);
});

test('batch, series cover and entry cover use the same paste flow and retain photos after saving',async({page})=>{
  await add(page,'ชุดจากคลิปบอร์ด');await page.getByRole('button',{name:'หลายเล่มในชุด',exact:true}).click();
  await page.locator('.batch-photo > summary').click();await paste(page,{data:await png()});await expect(page.locator('#photo-status')).toContainText('เตรียมรูปแล้ว');
  await page.locator('[name=end]').fill('2');await page.getByRole('button',{name:'ตรวจรายการก่อนเพิ่ม →'}).click();await page.getByRole('button',{name:'ยืนยันเพิ่มเข้าชั้น',exact:true}).click();
  await expect(page.getByRole('heading',{name:'รายละเอียดบนชั้น',exact:true})).toBeVisible();
  await expect.poll(async()=>Boolean((await library(page)).series[0]?.coverData)).toBe(true);
  const initial=(await library(page)).series[0];
  await page.locator('[data-edit-series-photo]').click();await paste(page,{data:await png(512)});await expect(page.locator('#photo-status')).toContainText('เตรียมรูปแล้ว');
  await page.getByRole('button',{name:'บันทึกรูปปก',exact:true}).click();await expect.poll(async()=>(await library(page)).series[0].coverData).not.toBe(initial.coverData);
  const entryId=initial.entries[0].id;await page.locator(`[data-entry-actions="${entryId}"] summary`).click();await page.locator(`[data-edit-photo="${entryId}"]`).click();
  await paste(page,{data:await png()});await expect(page.locator('#photo-status')).toContainText('เตรียมรูปแล้ว');await page.getByRole('button',{name:'บันทึกรูปปก',exact:true}).click();
  await expect.poll(async()=>Boolean((await library(page)).series[0].entries[0].coverData)).toBe(true);
  const final=(await library(page)).series[0];expect(final.entries.map(e=>e.id)).toEqual(initial.entries.map(e=>e.id));
});

test('denied or unavailable clipboard preserves the old cover and the file picker remains usable',async({page})=>{
  await add(page);await page.locator('#photo-file').setInputFiles('public/icon-192.png');await expect(page.locator('#photo-status')).toContainText('เตรียมรูปแล้ว');
  const old=await page.locator('#photo-preview img').getAttribute('src');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{read:()=>Promise.reject(new DOMException('Denied','NotAllowedError'))}}));
  await page.getByRole('button',{name:'วางรูปจากคลิปบอร์ด'}).click();await expect(page.locator('#photo-status')).toContainText('อนุญาต');
  await expect(page.locator('#photo-preview img')).toHaveAttribute('src',old);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
  await page.getByRole('button',{name:'วางรูปจากคลิปบอร์ด'}).click();await expect(page.locator('#photo-paste')).toBeFocused();
  await paste(page,{data:await png(),type:'image/gif'});await expect(page.locator('#photo-status')).toContainText('JPG, PNG หรือ WebP');
  await expect(page.locator('#photo-preview img')).toHaveAttribute('src',old);
  await page.locator('#photo-file').setInputFiles('public/icon-512.png');await expect(page.locator('#photo-status')).toContainText('เตรียมรูปแล้ว');
  await expect(page.locator('#photo-preview img')).not.toHaveAttribute('src',old);
});

test('offline pasted covers survive reload and sync to owner photo storage after reconnecting',async({page,context})=>{
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await context.setOffline(true);
  await add(page,'ปกที่วางตอนออฟไลน์');await paste(page,{data:await png()});await expect(page.locator('#photo-status')).toContainText('เตรียมรูปแล้ว');
  await page.getByRole('button',{name:'ตรวจแล้ว · เพิ่มเข้าชั้น'}).click();await expect(page.locator('#modal')).not.toBeVisible();
  await expect(page.locator('#connection')).toContainText('รอซิงก์');await page.reload();await expect(page.locator('.book-card img')).toHaveCount(1);
  await context.setOffline(false);await page.locator('#connection').click();await expect(page.locator('#connection')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');
  const saved=(await library(page)).series[0].entries[0].coverData;expect(saved).toMatch(/^\/api\/photos\//);expect((await page.request.get(saved)).ok()).toBe(true);
});

test('removing or leaving a cover editor cancels a pending clipboard result',async({page})=>{
  await add(page);await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{read:()=>new Promise(resolve=>window.resolveCoverPaste=resolve)}}));
  await page.getByRole('button',{name:'วางรูปจากคลิปบอร์ด'}).click();await expect(page.locator('.photo-editor')).toHaveAttribute('aria-busy','true');
  await page.getByRole('button',{name:'ลบรูป',exact:true}).click();
  const resolve=async()=>page.evaluate(data=>{
    const blob=new Blob([Uint8Array.from(atob(data),char=>char.charCodeAt(0))],{type:'image/png'});
    window.resolveCoverPaste([{types:['image/png'],getType:async()=>blob}]);
  },await png());
  await resolve();await expect(page.locator('#photo-preview img')).toHaveCount(0);await expect(page.locator('#photo-status')).toContainText('ลบรูป');
  await page.getByRole('button',{name:'วางรูปจากคลิปบอร์ด'}).click();await page.getByRole('button',{name:'ปิดหน้าต่าง'}).click();
  await add(page,'ฟอร์มใหม่');await resolve();await expect(page.locator('#photo-preview img')).toHaveCount(0);await expect(page.locator('#photo-status')).not.toContainText('เตรียมรูปแล้ว');
  await page.setViewportSize({width:320,height:800});expect(await page.locator('#modal').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.locator('.photo-paste-options').evaluate(el=>el.open=true);
  expect(await page.locator('#photo-paste').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
});

test('native clipboard image paste works with the keyboard and the explicit paste button',async({page,context,isMobile})=>{
  test.skip(isMobile,'Native desktop clipboard; mobile menu behavior requires device testing');
  await context.grantPermissions(['clipboard-read','clipboard-write']);await add(page);
  await page.evaluate(async data=>{
    const blob=new Blob([Uint8Array.from(atob(data),char=>char.charCodeAt(0))],{type:'image/png'});
    await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
  },await png());
  await page.locator('.photo-paste-options summary').click();await page.locator('#photo-paste').focus();await page.keyboard.press('Control+V');await expect(page.locator('#photo-status')).toContainText('เตรียมรูปแล้ว');
  await page.getByRole('button',{name:'ลบรูป',exact:true}).click();await page.getByRole('button',{name:'วางรูปจากคลิปบอร์ด'}).click();
  await expect(page.locator('#photo-status')).toContainText('เตรียมรูปแล้ว');await expect(page.locator('#photo-preview img')).toHaveCount(1);
});
