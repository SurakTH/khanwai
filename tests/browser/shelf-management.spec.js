import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { seedState } from '../../public/lib.js';
import { recordDiff, emptyLibrary } from '../../public/sync-core.js';
const headers={'X-Book-Request':'1'};
const volume=(id,label,status='owned',location='ตู้ A')=>({id,kind:'volume',label,status,location,quantity:1,isbn:''});
function fixture(){
 const state=seedState();state.series=[state.series[0],state.series[2],state.series[3]];
 state.series[0]={...state.series[0],title:'ชุด ก',author:'ผู้เขียน ก',tags:['สะสม'],target:['1','2','3'],entries:[{...volume('g1','1'),isbn:'9780306406157'},volume('g2','2','ordered')]};
 state.series[1]={...state.series[1],title:'ชุด ข',tags:['พิเศษ'],target:['1','2','3'],entries:[{...volume('box','ชุดบ็อกซ์'),kind:'box',members:['1','2','3']}]};
 state.series[2]={...state.series[2],title:'ชุด ค',tags:[],target:[],entries:[volume('ebook1','1','owned','แอพ ebook')]};return state;
}
async function library(page){return (await(await page.request.get('/api/library')).json()).state;}
async function settings(page){await page.locator('nav [data-page=settings]').click();}
async function csvStart(page,text){await settings(page);await page.getByRole('button',{name:'นำเข้าจาก CSV',exact:true}).click();await page.locator('#csv-file').setInputFiles({name:'books.csv',mimeType:'text/csv',buffer:Buffer.from(text)});await expect(page.locator('#csv-mapping')).toBeVisible();}
async function bulkStart(page, ids=['sample-0']){
 await page.locator('.shelf-manage summary').click();await page.getByRole('button',{name:'เลือกหลายรายการ',exact:true}).click();
 for(const id of ids)await page.locator(`[data-select-series="${id}"]`).check();
 await page.getByRole('button',{name:'ตรวจและแก้รายการที่เลือก'}).click();await expect(page.locator('#bulk-form')).toBeVisible();
}
test.beforeEach(async({page})=>{
 expect((await page.request.post('/api/auth/register',{headers,data:{email:`shelf-${randomUUID()}@example.test`,password:'shelf-browser-password',name:'ทดสอบชั้น'}})).status()).toBe(201);
 expect((await page.request.post('/api/sync',{headers,data:{id:randomUUID(),changes:recordDiff(emptyLibrary(),fixture()).map(c=>({...c,baseRevision:0}))}})).ok()).toBe(true);
 await page.goto('/');await expect(page.locator('#series-count')).toHaveText('3');await expect(page.locator('#connection')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');
});
test('compact shelf remembers view, shows box-safe gaps and combines location/tag filters without hiding check results',async({page})=>{
 await page.getByRole('button',{name:'รายการย่อ',exact:true}).click();await expect(page.locator('.shelf-list')).toBeVisible();
 await expect(page.locator('[data-detail=sample-0]')).toContainText('ยังไม่ได้ซื้อ: 3');await expect(page.locator('[data-detail=sample-2]')).toContainText('ครบตามเป้าหมาย');await expect(page.locator('[data-detail=sample-3]')).toContainText('ยังไม่กำหนดเลขเป้าหมาย');
 await page.locator('.shelf-filters summary').click();await page.locator('#shelf-smart').selectOption('incomplete');await expect(page.locator('.book-card')).toHaveCount(1);
 await page.locator('#shelf-tag').selectOption('สะสม');await page.locator('#shelf-location').selectOption('ตู้ A');await expect(page.locator('.book-card')).toHaveCount(1);
 await page.locator('[data-detail=sample-0]').click();await expect(page.locator('#modal')).toContainText('ชุด ก');await page.getByRole('button',{name:'ปิดหน้าต่าง'}).click();
 await page.getByRole('button',{name:'ล้างตัวกรองทั้งหมด'}).click();await page.reload();await expect(page.locator('.shelf-list')).toBeVisible();
 await page.locator('nav [data-page=check]').click();await page.getByRole('textbox',{name:'ค้นหาหนังสือ'}).fill('ชุด');await expect(page.locator('.purchase-result')).toHaveCount(3);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('tags and explicit targets can be edited, searched and restored after reload without changing ownership',async({page})=>{
 await page.locator('[data-detail=sample-3]').click();await page.getByRole('button',{name:'แก้ไขข้อมูลเรื่อง / ฉบับ',exact:true}).click();
 await page.locator('#edit-series-form [name=tags]').fill('อ่านที่บ้าน, ฉบับสะสม');await page.locator('#edit-series-form [name=target]').fill('1-3, ภาคพิเศษ');await page.getByRole('button',{name:'บันทึกข้อมูลเรื่อง',exact:true}).click();await page.getByRole('button',{name:'ปิดหน้าต่าง'}).click();
 await expect.poll(async()=> (await library(page)).series.find(s=>s.id==='sample-3').tags).toEqual(['อ่านที่บ้าน','ฉบับสะสม']);
 await page.reload();await page.getByRole('textbox',{name:'ค้นหาหนังสือ'}).fill('อ่านที่บ้าน');await expect(page.locator('.book-card')).toHaveCount(1);await expect(page.locator('.book-card')).toContainText('ชุด ค');
 const s=(await library(page)).series.find(s=>s.id==='sample-3');expect(s.entries).toHaveLength(1);expect(s.target).toEqual(['1','2','3','ภาคพิเศษ']);
});
test('bulk edit previews only selected volumes, cancels safely and preserves box membership and copies',async({page})=>{
 const before=await library(page);await bulkStart(page,['sample-0','sample-2']);
 await page.locator('#bulk-form [value=g1]').uncheck();await page.locator('#bulk-form [name=status]').selectOption('owned');await page.locator('#bulk-form [name=changeLocation]').check();await page.locator('#bulk-form [name=location]').fill('ตู้ B ชั้น 2');await page.locator('#bulk-form [name=tagMode]').selectOption('add');await page.locator('#bulk-form [name=tags]').fill('งานหนังสือ');
 await page.getByRole('button',{name:'ตรวจการเปลี่ยนแปลง',exact:true}).click();await expect(page.locator('#modal-title')).toHaveText('ตรวจการเปลี่ยนแปลง');expect(await library(page)).toEqual(before);
 await page.getByRole('button',{name:'ยืนยันแก้ 2 รายการ',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await expect.poll(async()=> (await library(page)).series[0].entries.find(e=>e.id==='g2').location).toBe('ตู้ B ชั้น 2');
 const after=await library(page);expect(after.series[0].entries.find(e=>e.id==='g1')).toEqual(before.series[0].entries.find(e=>e.id==='g1'));expect(after.series[1].entries[0].members).toEqual(['1','2','3']);expect(after.series[1].entries[0].quantity).toBe(1);expect(after.series[0].tags).toContain('งานหนังสือ');expect(after.series[2]).toEqual(before.series[2]);
 await bulkStart(page);await page.getByRole('button',{name:'ยกเลิก',exact:true}).click();expect(await library(page)).toEqual(after);
});
test('bulk edits survive offline reload and sync once while tags remain account private',async({page,context,browser,baseURL})=>{
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await context.setOffline(true);
 await bulkStart(page);await page.locator('#bulk-form [value=g1]').uncheck();await page.locator('#bulk-form [name=status]').selectOption('owned');await page.getByRole('button',{name:'ตรวจการเปลี่ยนแปลง',exact:true}).click();await page.getByRole('button',{name:'ยืนยันแก้ 1 รายการ',exact:true}).click();await expect(page.locator('#connection')).toContainText('รอซิงก์');await page.reload();await expect(page.locator('#series-count')).toHaveText('3');
 await context.setOffline(false);await page.locator('#connection').click();await expect(page.locator('#connection')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');expect((await library(page)).series[0].entries).toHaveLength(2);expect((await library(page)).series[0].entries.find(e=>e.id==='g2').status).toBe('owned');
 const other=await browser.newContext({baseURL});try{await other.request.post('/api/auth/register',{headers,data:{email:`other-${randomUUID()}@example.test`,password:'different-owner-password',name:'อีกบัญชี'}});expect((await(await other.request.get('/api/library')).json()).state.series).toHaveLength(0);}finally{await other.close();}
});
test('CSV review maps columns, flags duplicate ISBN and invalid rows, allows correction, and commits only confirmed rows',async({page})=>{
 const csv='title,author,edition,language,format,category,label,isbn,status,tags,location\r\nเรื่อง CSV,คนเขียน,ฉบับธรรมดา,ไทย,physical,การ์ตูน,1,,owned,สะสม,ตู้ CSV\r\nเรื่อง CSV,คนเขียน,ฉบับธรรมดา,ไทย,physical,การ์ตูน,2,9780306406157,owned,,\r\nเรื่อง CSV,คนเขียน,ฉบับธรรมดา,ไทย,physical,การ์ตูน,3,9780306406158,ordered,,\r\n';
 const before=await library(page);await csvStart(page,csv);await page.getByRole('button',{name:'ตรวจข้อมูล CSV',exact:true}).click();await expect(page.locator('#modal')).toContainText('พร้อมเพิ่ม 1 · ซ้ำ 1 · ต้องแก้ 1');expect(await library(page)).toEqual(before);
 const row=page.locator('.csv-row').nth(2);await row.locator('summary').click();await row.locator('[data-csv-field=isbn]').fill('');await expect(page.locator('#csv-confirm')).toBeDisabled();await page.getByRole('button',{name:'ตรวจข้อมูลอีกครั้ง',exact:true}).click();await expect(page.locator('#modal')).toContainText('พร้อมเพิ่ม 2 · ซ้ำ 1 · ต้องแก้ 0');await page.locator('#csv-confirm').click();await expect(page.locator('#series-count')).toHaveText('4');
 await expect.poll(async()=>(await library(page)).series.length).toBe(4);const added=(await library(page)).series.find(s=>s.title==='เรื่อง CSV');expect(added.entries.map(e=>e.label)).toEqual(['1','3']);expect(added.entries[1].status).toBe('ordered');expect(added.tags).toEqual(['สะสม']);
 await page.reload();await expect(page.locator('#series-count')).toHaveText('4');
});
test('CSV manual column mapping and row exclusion work; closing review or malformed files never writes books',async({page})=>{
 const before=await library(page);await csvStart(page,'Book,Vol\nทดสอบหนึ่ง,1\nทดสอบสอง,2\n');await page.locator('[data-map=title]').selectOption('0');await page.locator('[data-map=label]').selectOption('1');await page.locator('[data-default=edition]').fill('ฉบับทดลอง');await page.locator('[data-default=language]').fill('ไทย');await page.getByRole('button',{name:'ตรวจข้อมูล CSV',exact:true}).click();await page.locator('[data-csv-select="1"]').uncheck();await page.locator('#csv-recheck').click();await expect(page.locator('#modal')).toContainText('พร้อมเพิ่ม 1');await page.getByRole('button',{name:'ปิดหน้าต่าง'}).click();expect(await library(page)).toEqual(before);
 await page.getByRole('button',{name:'นำเข้าจาก CSV',exact:true}).click();await page.locator('#csv-file').setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('title\n"unfinished')});await expect(page.locator('#csv-error')).toContainText('ยังปิดไม่ครบ');expect(await library(page)).toEqual(before);
});
test('CSV can be reviewed offline then syncs tags and entries without duplication',async({page,context})=>{
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await context.setOffline(true);
 await csvStart(page,'title,edition,language,format,status,category,label,tags\nออฟไลน์ CSV,ธรรมดา,ไทย,ebook,wishlist,การ์ตูน,1,ส่วนตัว\n');await page.getByRole('button',{name:'ตรวจข้อมูล CSV',exact:true}).click();await page.locator('#csv-confirm').click();await expect(page.locator('#series-count')).toHaveText('4');await expect(page.locator('#connection')).toContainText('รอซิงก์');await page.reload();await expect(page.locator('#series-count')).toHaveText('4');await context.setOffline(false);await page.locator('#connection').click();await expect(page.locator('#connection')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');
 const books=(await library(page)).series.filter(s=>s.title==='ออฟไลน์ CSV');expect(books).toHaveLength(1);expect(books[0].tags).toEqual(['ส่วนตัว']);expect(books[0].entries).toHaveLength(1);expect(books[0].entries[0].isbn).toBe('');
});

test('new edition tags survive drafting and switching between single and batch add',async({page})=>{
 await page.locator('.page-heading [data-add]').click();await page.locator('#review-form [name=title]').fill('เรื่องที่มีแท็ก');await page.locator('#review-form [name=label]').fill('1');await page.locator('#review-form [name=tags]').fill('พิเศษ, เก็บเอง');await page.getByRole('button',{name:'หลายเล่มในชุด',exact:true}).click();await expect(page.locator('#batch-form [name=tags]')).toHaveValue('พิเศษ,เก็บเอง');await page.getByRole('button',{name:'ทีละเล่ม',exact:true}).click();await expect(page.locator('#review-form [name=tags]')).toHaveValue('พิเศษ,เก็บเอง');
 await page.getByRole('button',{name:'เก็บไว้ในถาดรอตรวจ',exact:true}).click();await page.locator('nav [data-page=drafts]').click();await page.getByRole('button',{name:'ตรวจข้อมูล',exact:true}).click();await expect(page.locator('#review-form [name=tags]')).toHaveValue('พิเศษ, เก็บเอง');await page.getByRole('button',{name:'ตรวจแล้ว · เพิ่มเข้าชั้น',exact:true}).click();await expect.poll(async()=>(await library(page)).series.find(s=>s.title==='เรื่องที่มีแท็ก')?.tags).toEqual(['พิเศษ','เก็บเอง']);
});

test('bulk review keeps the original revisions and reports a concurrent edit instead of overwriting it',async({page})=>{
 await bulkStart(page);await page.locator('#bulk-form [value=g1]').uncheck();await page.locator('#bulk-form [name=status]').selectOption('owned');await page.getByRole('button',{name:'ตรวจการเปลี่ยนแปลง',exact:true}).click();
 const snapshot=await(await page.request.get('/api/library')).json();const after=structuredClone(snapshot.state);after.series[0].entries.find(e=>e.id==='g2').quantity=2;
 expect((await page.request.post('/api/sync',{headers,data:{id:randomUUID(),changes:recordDiff(snapshot.state,after).map(c=>({...c,baseRevision:snapshot.versions[c.key]??0}))}})).ok()).toBe(true);
 await page.getByRole('button',{name:'ยืนยันแก้ 1 รายการ',exact:true}).click();await expect(page.locator('#connection')).toContainText('ชนกัน');const remote=(await library(page)).series[0].entries.find(e=>e.id==='g2');expect(remote.quantity).toBe(2);expect(remote.status).toBe('ordered');await page.locator('#connection').click();await expect(page.locator('#conflict-form')).toBeVisible();
});
test('CSV rechecks changing shelves before confirmation and blocks selected invalid rows',async({page})=>{
 await csvStart(page,'title,author,edition,language,format,category,label,isbn,status\nซ้ำระหว่างรีวิว,คนเขียน,ธรรมดา,ไทย,physical,การ์ตูน,1,9786161847012,owned\nแถวผิด,คนเขียน,ธรรมดา,ไทย,physical,การ์ตูน,2,123,owned\n');await page.getByRole('button',{name:'ตรวจข้อมูล CSV',exact:true}).click();await expect(page.locator('#csv-confirm')).toBeDisabled();await page.locator('[data-csv-select="1"]').uncheck();await page.locator('#csv-recheck').click();await expect(page.locator('#csv-confirm')).toBeEnabled();
 await page.evaluate(async()=>{const {account}=await import('/app.js');await account.mutate(s=>{s.series[0].entries.push({id:'concurrent-csv-isbn',kind:'volume',label:'99',isbn:'9786161847012',status:'owned',quantity:1});});});
 await page.locator('#csv-confirm').click();await expect(page.locator('#csv-error')).toContainText('ชั้นเปลี่ยน');await expect(page.locator('#csv-confirm')).toBeDisabled();await expect(page.locator('#modal')).toContainText('พร้อมเพิ่ม 0 · ซ้ำ 1');expect((await library(page)).series.some(s=>s.title==='ซ้ำระหว่างรีวิว')).toBe(false);
});
