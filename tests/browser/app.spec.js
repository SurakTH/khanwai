import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { seedState } from '../../public/lib.js';
import { recordDiff, emptyLibrary } from '../../public/sync-core.js';

async function cachedState(page) {
  return page.evaluate(async () => {
    const user = JSON.parse(localStorage.getItem('khanwai-last-user-v1'));
    const { openCache, cacheRead } = await import('/account-store.js');
    const db = await openCache(); try { return (await cacheRead(db, user.id)).state; } finally { db.close(); }
  });
}
async function replaceLibrary(page, state) {
  const snapshot = await (await page.request.get('/api/library')).json();
  const result = await page.request.post('/api/sync', { headers:{'X-Book-Request':'1'}, data:{id:randomUUID(),changes:recordDiff(snapshot.state,state).map(change=>({...change,baseRevision:snapshot.versions[change.key]??0}))} });
  expect(result.ok()).toBe(true);
}
test.beforeEach(async ({ page }, info) => {
  info.account = { email:`test-${randomUUID()}@example.test`,password:'browser-only-password-2026',name:'นักอ่านทดสอบ' };
  const registered = await page.request.post('/api/auth/register',{headers:{'X-Book-Request':'1'},data:info.account});
  expect(registered.status()).toBe(201);
  await replaceLibrary(page, seedState());
  await page.goto('/');
  await expect(page.locator('#series-count')).toHaveText('6');
  await expect(page.locator('#connection')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');
});

test('search, filters and box details work without horizontal overflow', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'ชั้นหนังสือ' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('textbox', { name: 'ค้นหาหนังสือ' }).fill('พันลี้');
  await page.locator('[data-detail="sample-2"]').click();
  await expect(page.getByText('รวมเล่ม 1, 2, 3')).toBeVisible();
  await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
  await page.getByRole('textbox', { name: 'ค้นหาหนังสือ' }).fill('no-such-book');
  await expect(page.getByRole('heading', { name: 'ยังไม่พบในชั้นที่บันทึกไว้' })).toBeVisible();
  await page.getByRole('button', { name: 'ล้างคำค้น', exact: true }).click();
  await page.getByRole('group', { name: 'กรองสถานะ', exact: true }).getByRole('button', { name: /^รอส่ง/ }).click();
  await expect(page.locator('.book-card')).toHaveCount(2);
});

async function fillBook(page, title = 'หนังสือทดลองของฉัน') {
  await page.locator('.page-heading [data-add]').click();
  await page.locator('[name="title"]').fill(title);
  await page.locator('[name="author"]').fill('ผู้เขียนทดสอบ');
  await page.locator('[name="label"]').fill('1');
}

test('manual review saves only after confirmation and persists on reload; text is escaped', async ({ page }) => {
  await fillBook(page, '<img src=x onerror=alert(1)>');
  await expect(page.locator('.book-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'ตรวจแล้ว · เพิ่มเข้าชั้น' }).click();
  await expect(page.locator('.book-card')).toHaveCount(7);
  await expect(page.locator('.book-card img')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.book-card')).toHaveCount(7);
});

test('draft does not count as owned and can be reviewed later', async ({ page }) => {
  await fillBook(page);
  await page.getByRole('button', { name: 'เก็บไว้ในถาดรอตรวจ' }).click();
  await expect(page.locator('.book-card')).toHaveCount(6);
  await page.locator('nav [data-page="drafts"]').click();
  await expect(page.locator('.draft-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'ตรวจข้อมูล', exact: true }).click();
  await expect(page.locator('[name="title"]')).toHaveValue('หนังสือทดลองของฉัน');
  await page.getByRole('button', { name: 'ตรวจแล้ว · เพิ่มเข้าชั้น' }).click();
  await expect(page.locator('.draft-row')).toHaveCount(0);
  await page.locator('[data-page="shelf"]').click();
  await expect(page.locator('.book-card')).toHaveCount(7);
});

test('adding a volume covered by a box requires explicit duplicate confirmation', async ({ page }) => {
  await page.locator('[data-detail="sample-2"]').click();
  await page.getByRole('button', { name: '+ เพิ่มเล่มในฉบับนี้' }).click();
  await page.locator('[name="label"]').fill('2');
  await page.getByRole('button', { name: 'ตรวจแล้ว · เพิ่มเข้าชั้น' }).click();
  await expect(page.locator('#confirm-duplicate')).toBeVisible();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#confirm-duplicate').check();
  await page.getByRole('button', { name: 'ตรวจแล้ว · เพิ่มเข้าชั้น' }).click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await page.locator('[data-detail="sample-2"]').click();
  await expect(page.locator('.entry-row')).toHaveCount(2);
  await expect(page.locator('.volume-chip:not(.missing)')).toHaveCount(3);
});

test('ISBN candidates fill review without committing, with manual fallback on outage', async ({ page }) => {
  await page.route('**/api/isbn?*', route => route.fulfill({ json: { status: 'found', candidates: [{ title: 'ข้อมูลจาก API', author: 'ผู้แต่ง', publisher: 'สำนักพิมพ์', language: 'th', isbn: '9780306406157', source: 'Google Books' }] } }));
  await page.locator('.page-heading [data-add]').click();
  await page.locator('#lookup-isbn').fill('0306406152');
  await page.getByRole('button', { name: 'ดึงข้อมูล', exact: true }).click();
  await page.getByRole('button', { name: /ข้อมูลจาก API ·/ }).click();
  await expect(page.locator('[name="title"]')).toHaveValue('ข้อมูลจาก API');
  await expect(page.locator('[name="isbn"]')).toHaveValue('9780306406157');
  await expect(page.locator('[name="label"]')).toHaveValue('');
  await expect(page.locator('.book-card')).toHaveCount(6);
  await page.unroute('**/api/isbn?*');
  await page.route('**/api/isbn?*', route => route.abort());
  await page.getByRole('button', { name: 'ดึงข้อมูล', exact: true }).click();
  await expect(page.locator('#lookup-result')).toContainText('เพิ่มด้วยตัวเองได้');
  await expect(page.locator('[name="title"]')).toHaveValue('ข้อมูลจาก API');
});

test('service worker supports reload and local search offline', async ({ page, context }) => {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ชั้นหนังสือ' })).toBeVisible();
  await page.getByRole('textbox', { name: 'ค้นหาหนังสือ' }).fill('จันทร์เธอ');
  await expect(page.locator('.book-card')).toHaveCount(1);
  await expect(page.locator('#connection')).toContainText('ออฟไลน์');
});

test('export/import round-trip requires preview and preserves data', async ({ page }) => {
  await fillBook(page);
  await page.getByRole('button', { name: 'ตรวจแล้ว · เพิ่มเข้าชั้น' }).click();
  await page.locator('[data-page="settings"]').click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ส่งออกข้อมูล JSON' }).click();
  const download = await downloadEvent;
  const buffer = await readFile(await download.path());
  const exported = JSON.parse(buffer.toString());
  expect(exported.series).toHaveLength(7);
  await page.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer });
  await expect(page.getByRole('heading', { name: 'ตรวจข้อมูลก่อนนำเข้า' })).toBeVisible();
  await expect(page.getByText('ข้อมูลปัจจุบันจะถูกแทนที่', { exact: false })).toBeVisible();
  await page.locator('#replace-import').check();
  await page.getByRole('button', { name: 'ยืนยันนำเข้าข้อมูล' }).click();
  await page.reload();
  await expect(page.locator('.book-card')).toHaveCount(7);
});

test('corrupt legacy data is preserved without blocking the real account library', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('khanwai-prototype-v1', '{broken-data'));
  await page.reload();
  await expect(page.locator('.book-card')).toHaveCount(6);
  await fillBook(page);
  await page.getByRole('button', { name: 'ตรวจแล้ว · เพิ่มเข้าชั้น' }).click();
  await expect(page.locator('.book-card')).toHaveCount(7);
  expect(await page.evaluate(() => localStorage.getItem('khanwai-prototype-v1'))).toBe('{broken-data');
});

test('ebook can be selected, drafted, reviewed and filtered independently of print', async ({ page }) => {
  await fillBook(page, 'ใต้แสงจันทร์มีเธอ');
  await page.getByLabel('รูปแบบหนังสือ', { exact: true }).selectOption('ebook');
  await page.getByRole('button', { name: 'เก็บไว้ในถาดรอตรวจ' }).click();
  await page.locator('nav [data-page="drafts"]').click();
  await expect(page.locator('.draft-row')).toContainText('ebook');
  await page.getByRole('button', { name: 'ตรวจข้อมูล', exact: true }).click();
  await expect(page.getByLabel('รูปแบบหนังสือ', { exact: true })).toHaveValue('ebook');
  await page.getByRole('button', { name: 'ตรวจแล้ว · เพิ่มเข้าชั้น' }).click();
  await page.locator('[data-page="shelf"]').click();
  await page.getByRole('textbox', { name: 'ค้นหาหนังสือ' }).fill('ใต้แสงจันทร์มีเธอ');
  await expect(page.locator('.book-card')).toHaveCount(2);
  if(!await page.locator('#shelf-filters').evaluate(el=>el.open))await page.locator('.shelf-filters summary').click();
  await page.getByLabel('กรองรูปแบบหนังสือ').selectOption('ebook');
  await expect(page.locator('.book-card')).toHaveCount(1);
  await expect(page.locator('.book-card .category-label')).toContainText('ebook');
  await page.reload();
  if(!await page.locator('#shelf-filters').evaluate(el=>el.open))await page.locator('.shelf-filters summary').click();
  await page.getByLabel('กรองรูปแบบหนังสือ').selectOption('ebook');
  await expect(page.locator('.book-card')).toHaveCount(2);
});

test('v1 legacy data is imported only after preview and preserved in the original key', async ({ page }) => {
  const old = seedState(); old.schemaVersion=1; old.series.forEach(s=>delete s.format);
  await page.evaluate(value=>localStorage.setItem('khanwai-prototype-v1',JSON.stringify(value)),old);
  await page.reload();
  await page.locator('nav [data-page="settings"]').click();
  await page.getByRole('button',{name:'ตรวจและนำเข้าข้อมูลเดิม'}).click();
  await page.locator('#replace-import').check();
  await page.getByRole('button',{name:'ยืนยันนำเข้าข้อมูล'}).click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await page.locator('nav [data-page="shelf"]').click();
  if(!await page.locator('#shelf-filters').evaluate(el=>el.open))await page.locator('.shelf-filters summary').click();
  await page.getByLabel('กรองรูปแบบหนังสือ').selectOption('physical');
  await expect(page.locator('.book-card')).toHaveCount(6);
  const saved=await cachedState(page);
  expect(saved.schemaVersion).toBe(2); expect(saved.series.every(s=>s.format==='physical')).toBe(true);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('khanwai-prototype-v1')).schemaVersion)).toBe(1);
});

test('purchase check starts with a prompt and answers per-volume owned, ordered and box coverage', async ({ page }) => {
  await page.locator('nav [data-page="check"]').click();
  await expect(page.getByRole('heading', { name: 'กำลังเล็งเล่มไหนอยู่?' })).toBeVisible();
  await expect(page.locator('.book-card')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'ค้นหาหนังสือ' }).fill('จันทร์เธอ');
  const result = page.locator('[data-check-result="sample-0"]');
  await expect(result).toContainText('มีแล้วในชั้น');
  await expect(result).toContainText('เล่ม 1, 2, 4');
  await page.getByLabel('เลขเล่ม (ถ้ารู้)').fill('3');
  await expect(result).toContainText('ยังไม่พบเล่มนี้ในฉบับนี้');
  await expect(result).not.toContainText('มีแล้วในชั้น');
  await page.getByLabel('เลขเล่ม (ถ้ารู้)').fill('5');
  await expect(result).toContainText('สั่งแล้ว รอส่ง');
  await page.getByRole('textbox', { name: 'ค้นหาหนังสือ' }).fill('พันลี้');
  await page.getByLabel('เลขเล่ม (ถ้ารู้)').fill('2');
  await expect(page.locator('[data-check-result="sample-2"]')).toContainText('มีแล้วในชั้น');
  await expect(page.locator('[data-check-result="sample-2"]')).toContainText('บ็อกซ์ 1–3');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('purchase check distinguishes formats and drafts; ISBN verdict uses the matched entry only', async ({ page }) => {
  const data = seedState();
    const print = data.series[0];
    print.entries[0].status = 'wishlist'; print.entries[0].isbn = '9780306406157';
    const ebook = structuredClone(print); ebook.id = 'digital-check'; ebook.format = 'ebook';
    ebook.entries = [{ ...ebook.entries[0], id: 'digital-check-entry', status: 'owned', isbn: '' }];
    data.series.push(ebook);
    data.drafts.push({id:'check-draft',title:print.title,author:'',isbn:'',label:'1',edition:'',language:'ไทย',format:'physical',category:'การ์ตูน',source:'กรอกเอง'});
  await replaceLibrary(page, data);
  await page.reload();
  await page.locator('nav [data-page="check"]').click();
  await page.getByRole('textbox', { name: 'ค้นหาหนังสือ' }).fill('ใต้แสงจันทร์มีเธอ');
  await page.getByLabel('เลขเล่ม (ถ้ารู้)').fill('1');
  await expect(page.locator('.purchase-result')).toHaveCount(2);
  await expect(page.locator('[data-check-result="sample-0"]')).toContainText('อยู่ในลิสต์อยากซื้อ');
  await expect(page.locator('[data-check-result="digital-check"]')).toContainText('มีแล้วในชั้น');
  await expect(page.locator('#results .notice')).toContainText('ยังไม่นับว่ามีแล้ว');
  await page.getByRole('textbox', { name: 'ค้นหาหนังสือ' }).fill('0306406152');
  await expect(page.locator('.purchase-result')).toHaveCount(1);
  await expect(page.locator('.purchase-result')).toContainText('อยู่ในลิสต์อยากซื้อ');
  await expect(page.locator('.purchase-result')).not.toContainText('มีแล้วในชั้น');
  await expect(page.locator('.purchase-result')).toContainText('ISBN ตรงกับรายการที่บันทึก');
});

test('batch review skips owned/boxed volumes and saves excluded gaps only after confirmation', async ({ page }) => {
  await page.locator('.page-heading [data-add]').click();
  await page.getByRole('button',{name:'หลายเล่มในชุด',exact:true}).click();
  await page.locator('#batch-series').selectOption('sample-2');
  await page.locator('[name="end"]').fill('6');
  await page.locator('[name="excluded"]').fill('5');
  await page.locator('[name="location"]').fill('ตู้ B ชั้น 2');
  await page.getByRole('button', { name: 'ตรวจรายการก่อนเพิ่ม →' }).click();
  await expect(page.locator('#batch-total')).toContainText('จะเพิ่ม 2 เล่ม');
  await expect(page.locator('[data-batch-row="0"]')).toBeDisabled();
  await expect(page.locator('[data-batch-row="4"]')).not.toBeChecked();
  expect((await cachedState(page)).series.find(s=>s.id==='sample-2').entries).toHaveLength(1);
  await page.getByRole('button', { name: 'ยืนยันเพิ่มเข้าชั้น' }).click();
  await expect(page.locator('.entry-row')).toHaveCount(3);
  const saved = (await cachedState(page)).series.find(s=>s.id==='sample-2');
  expect(saved.entries.map(e => e.label)).toEqual(['บ็อกซ์ 1–3', '4', '6']);
  expect(saved.entries[1].isbn).toBe('');
  expect(saved.entries[1].location).toBe('ตู้ B ชั้น 2');
  expect(saved.target).toContain('5');
});

test('cover attachment survives draft and reload and can be removed', async ({ page }) => {
  await fillBook(page, 'หนังสือพร้อมรูป');
  await page.locator('#photo-file').setInputFiles('public/icon-192.png');
  await expect(page.locator('#photo-status')).toContainText('เตรียมรูปแล้ว');
  await expect(page.locator('#photo-preview img')).toHaveCount(1);
  await page.getByRole('button', { name: 'เก็บไว้ในถาดรอตรวจ' }).click();
  await page.locator('nav [data-page="drafts"]').click();
  await page.getByRole('button', { name: 'ตรวจข้อมูล', exact: true }).click();
  await expect(page.locator('#photo-preview img')).toHaveCount(1);
  await page.getByRole('button', { name: 'ตรวจแล้ว · เพิ่มเข้าชั้น' }).click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await expect(page.locator('#series-count')).toHaveText('7');
  await page.reload();
  await page.getByRole('textbox', { name: 'ค้นหาหนังสือ' }).fill('หนังสือพร้อมรูป');
  await expect(page.locator('.book-card img')).toHaveCount(1);
  await page.locator('.book-card').click();
  await page.locator('.entry-actions summary').click();
  await page.getByRole('button', { name: 'รูปปก', exact: true }).click();
  await page.getByRole('button', { name: 'ลบรูป', exact: true }).click();
  await page.getByRole('button', { name: 'บันทึกรูปปก', exact: true }).click();
  await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
  await expect(page.locator('.book-card img')).toHaveCount(0);
});

test('logout revokes the real session and clears this account from the browser', async ({ page }) => {
  await page.locator('nav [data-page="settings"]').click();
  await page.getByRole('button',{name:'ออกจากระบบ',exact:true}).click();
  await expect(page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('khanwai-last-user-v1'))).toBeNull();
  expect((await page.request.get('/api/library')).status()).toBe(401);
});

test('series edits can be cancelled and preserve entries; format changes require confirmation', async ({ page }) => {
  await page.locator('[data-detail="sample-0"]').click();
  await page.getByRole('button', { name: 'แก้ไขข้อมูลเรื่อง / ฉบับ' }).click();
  await page.locator('[name="title"]').fill('ชื่อที่ยังไม่บันทึก');
  await page.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  await expect(page.locator('dialog h2')).toContainText(['รายละเอียดบนชั้น', 'ใต้แสงจันทร์มีเธอ']);
  await page.getByRole('button', { name: 'แก้ไขข้อมูลเรื่อง / ฉบับ' }).click();
  await page.locator('[name="title"]').fill('ชื่อเรื่องที่แก้แล้ว');
  await page.locator('[name="alias"]').fill('ชื่อย่อใหม่');
  await page.locator('[name="format"]').selectOption('ebook');
  await page.getByRole('button', { name: 'บันทึกข้อมูลเรื่อง', exact: true }).click();
  await expect(page.locator('#edit-series-error')).toContainText('ยืนยันก่อน');
  await page.locator('#confirm-format').check();
  await page.getByRole('button', { name: 'บันทึกข้อมูลเรื่อง', exact: true }).click();
  await expect(page.locator('.entry-row')).toHaveCount(4);
  const saved = (await cachedState(page)).series.find(s=>s.id==='sample-0');
  expect(saved.entries.map(e => e.id)).toEqual(['sample-0-1','sample-0-2','sample-0-4','order-0-5']);
  expect(saved.format).toBe('ebook');
  await page.reload();
  await page.getByRole('textbox', { name: 'ค้นหาหนังสือ' }).fill('ชื่อย่อใหม่');
  await expect(page.locator('.book-card')).toHaveCount(1);
  await expect(page.locator('.book-card')).toContainText('ชื่อเรื่องที่แก้แล้ว');
});

test('editing an entry validates ISBN, confirms duplicates and updates its existing ID only', async ({ page }) => {
  await page.locator('[data-detail="sample-0"]').click();
  await page.locator('[data-entry-actions="sample-0-1"] summary').click();await page.locator('[data-edit-entry="sample-0-1"]').click();
  await page.locator('[name="isbn"]').fill('9780306406158');
  await page.getByRole('button', { name: 'บันทึกข้อมูลเล่ม', exact: true }).click();
  await expect(page.locator('#edit-entry-error')).toContainText('ISBN ไม่ถูกต้อง');
  await page.locator('[name="isbn"]').fill('0306406152');
  await page.locator('[name="label"]').fill('2');
  await page.locator('[name="location"]').fill('ตู้ใหม่ ชั้น 3');
  await page.locator('[name="quantity"]').fill('2');
  await page.getByRole('button', { name: 'บันทึกข้อมูลเล่ม', exact: true }).click();
  await expect(page.locator('#confirm-entry-change')).toBeVisible();
  await page.locator('#confirm-entry-change').check();
  await page.getByRole('button', { name: 'บันทึกข้อมูลเล่ม', exact: true }).click();
  await expect(page.locator('.entry-row')).toHaveCount(4);
  const saved = (await cachedState(page)).series.find(s=>s.id==='sample-0');
  const edited = saved.entries.find(e => e.id === 'sample-0-1');
  expect(edited.isbn).toBe('9780306406157'); expect(edited.label).toBe('2'); expect(edited.quantity).toBe(2); expect(edited.location).toBe('ตู้ใหม่ ชั้น 3');
  expect(saved.entries.find(e => e.id === 'sample-0-2').quantity).toBe(1);
  await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
  await page.locator('[data-detail="sample-2"]').click();
  await page.locator('[data-entry-actions="box-2"] summary').click();await page.locator('[data-edit-entry="box-2"]').click();
  await page.locator('[name="members"]').fill('1, 2');
  await page.getByRole('button', { name: 'บันทึกข้อมูลเล่ม', exact: true }).click();
  await expect(page.locator('#edit-entry-warning')).toContainText('มีผลต่อการเช็ก');
  await page.locator('#confirm-entry-change').check();
  await page.getByRole('button', { name: 'บันทึกข้อมูลเล่ม', exact: true }).click();
  await expect(page.locator('.volume-chip:not(.missing)')).toHaveCount(2);
});

test('photo barcode decoding works without BarcodeDetector and with a rotated image offline', async ({ page, context }) => {
  await page.evaluate(() => { window.BarcodeDetector = undefined; });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.evaluate(() => { window.BarcodeDetector = undefined; });
  await context.setOffline(true);
  await page.locator('nav [data-page="check"]').click();
  for (const filename of ['isbn.png','isbn-rotated.png']) {
    await page.getByRole('textbox', { name: 'ค้นหาหนังสือ' }).fill('รออ่านรูป');
    const chooserEvent = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'เลือกรูปบาร์โค้ด', exact: true }).click();
    await (await chooserEvent).setFiles(`tests/fixtures/${filename}`);
    await expect(page.getByRole('textbox', { name: 'ค้นหาหนังสือ' })).toHaveValue('9780306406157');
    await expect(page.locator('#toast')).toContainText('อ่าน ISBN ได้แล้ว');
    await expect(page.locator('#modal')).not.toBeVisible();
  }
});

test('camera photo fills ISBN for review; non-book photos preserve manual input', async ({ page }) => {
  await page.evaluate(() => { window.BarcodeDetector = undefined; });
  await page.route('**/api/isbn?*', route => route.fulfill({ json: { status:'not_found', candidates:[] } }));
  await page.locator('.page-heading [data-add]').click();
  await page.locator('[name="title"]').fill('ข้อมูลที่ยังไม่บันทึก');
  await expect(page.locator('#barcode-camera')).toHaveAttribute('capture','environment');
  await expect(page.locator('#barcode-file')).not.toHaveAttribute('capture');
  let chooserEvent = page.waitForEvent('filechooser');
  await page.getByRole('button', { name:'ถ่ายบาร์โค้ด', exact:true }).click();
  await (await chooserEvent).setFiles('tests/fixtures/isbn.png');
  await expect(page.locator('[name="isbn"]')).toHaveValue('9780306406157');
  await expect(page.locator('#lookup-result')).toContainText('ยังไม่พบข้อมูล');
  await expect(page.locator('.book-card')).toHaveCount(6);
  chooserEvent = page.waitForEvent('filechooser');
  await page.getByRole('button', { name:'เลือกรูปบาร์โค้ด', exact:true }).click();
  await (await chooserEvent).setFiles('tests/fixtures/retail.png');
  await expect(page.locator('#toast')).toContainText('ไม่ใช่ ISBN');
  await expect(page.locator('[name="isbn"]')).toHaveValue('9780306406157');
  await expect(page.locator('[name="title"]')).toHaveValue('ข้อมูลที่ยังไม่บันทึก');
});

test('fallback metadata shows its real source and leaves unknown edition and language for review', async ({ page }) => {
  await page.route('**/api/isbn?*',route=>route.fulfill({json:{status:'found',candidates:[{title:'หนังสือจากแหล่งสำรอง',author:'ผู้เขียน',publisher:'สำนักพิมพ์',language:'',isbn:'9780306406157',source:'Open Library'}]}}));
  await page.locator('.page-heading [data-add]').click();
  await page.locator('#lookup-isbn').fill('0306406152');
  await page.getByRole('button',{name:'ดึงข้อมูล',exact:true}).click();
  await page.getByRole('button',{name:/หนังสือจากแหล่งสำรอง.*Open Library/}).click();
  await expect(page.locator('#source-label')).toContainText('Open Library');
  await expect(page.locator('[name="language"]')).toHaveValue('');
  await expect(page.locator('[name="edition"]')).toHaveValue('');
  await expect(page.locator('[name="isbn"]')).toHaveValue('9780306406157');
  await expect(page.locator('.book-card')).toHaveCount(6);
});

test('partial provider failure distinguishes exhausted quota from an empty fallback and preserves review input',async({page})=>{
 await page.route('**/api/isbn?*',route=>route.fulfill({json:{status:'rate_limited',candidates:[],providers:[{name:'Google Books',status:'rate_limited'},{name:'Open Library',status:'not_found'}]}}));
 await page.locator('.page-heading [data-add]').click();
 await page.locator('[name="title"]').fill('ชื่อที่กรอกไว้');
 await page.locator('#lookup-isbn').fill('9786161847012');
 await page.getByRole('button',{name:'ดึงข้อมูล',exact:true}).click();
 await expect(page.locator('#lookup-result')).toContainText('Google Books: จำกัดคำขอ/โควตาหมด');
 await expect(page.locator('#lookup-result')).toContainText('Open Library: ยังไม่พบ ISBN นี้');
 await expect(page.locator('[name="title"]')).toHaveValue('ชื่อที่กรอกไว้');
 await expect(page.locator('[name="isbn"]')).toHaveValue('9786161847012');
});

test('provider settings save the order to this account and survive reopening; all sources can be disabled',async({page})=>{
 await page.locator('nav [data-page="settings"]').click();
 await expect(page.locator('#lookup-settings-form')).toBeVisible();
 await expect(page.locator('[data-provider="nlt"]')).not.toBeChecked();
 await page.locator('[data-provider="nlt"]').check();
 await page.getByRole('button',{name:'เลื่อน หอสมุดแห่งชาติ (NLT) ขึ้น',exact:true}).click();
 await page.getByRole('button',{name:'เลื่อน หอสมุดแห่งชาติ (NLT) ขึ้น',exact:true}).click();
 await page.getByRole('button',{name:'บันทึกแหล่งข้อมูล',exact:true}).click();
 await expect(page.locator('#lookup-settings-status')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');
 expect((await (await page.request.get('/api/settings')).json()).isbnProviders).toEqual(['nlt','google','openlibrary']);
 await page.reload();await page.locator('nav [data-page="settings"]').click();
 await expect(page.locator('[data-provider="nlt"]')).toBeChecked();
 expect(await page.locator('[data-provider-row]').first().getAttribute('data-provider-row')).toBe('nlt');
 for(const id of ['nlt','google','openlibrary'])await page.locator(`[data-provider="${id}"]`).uncheck();
 await page.getByRole('button',{name:'บันทึกแหล่งข้อมูล',exact:true}).click();
 await expect(page.locator('#lookup-settings-status')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');
 expect((await (await page.request.get('/api/settings')).json()).isbnProviders).toEqual([]);
 await page.locator('nav [data-page="shelf"]').click();await page.locator('.page-heading [data-add]').click();
 await page.locator('#lookup-isbn').fill('9786161847012');await page.getByRole('button',{name:'ดึงข้อมูล',exact:true}).click();
 await expect(page.locator('#lookup-result')).toContainText('ปิดการค้นข้อมูลภายนอก');
});

test('a stale settings form reports conflict and an offline save never claims server confirmation',async({page,context})=>{
 await page.locator('nav [data-page="settings"]').click();await expect(page.locator('#lookup-settings-form')).toBeVisible();
 await page.locator('[data-provider="nlt"]').check();
 const snapshot=await (await page.request.get('/api/settings')).json();
 expect((await page.request.put('/api/settings',{headers:{'X-Book-Request':'1'},data:{owner:snapshot.owner,revision:snapshot.revision,isbnProviders:['openlibrary']}})).ok()).toBe(true);
 await page.getByRole('button',{name:'บันทึกแหล่งข้อมูล',exact:true}).click();
 await expect(page.locator('#lookup-settings-status')).toContainText('อีกเครื่อง');
 await expect(page.locator('[data-provider="nlt"]')).toBeChecked();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'โหลดค่าล่าสุด',exact:true}).click();
 await expect(page.locator('[data-provider="nlt"]')).not.toBeChecked();
 await page.locator('[data-provider="nlt"]').check();await context.setOffline(true);
 await page.getByRole('button',{name:'บันทึกแหล่งข้อมูล',exact:true}).click();
 await expect(page.locator('#lookup-settings-status')).not.toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');
 await expect(page.getByRole('button',{name:'บันทึกแหล่งข้อมูล',exact:true})).toBeEnabled();
 await expect(page.locator('[data-provider="nlt"]')).toBeChecked();
 await context.setOffline(false);
});

test('one Add entry point uses a volume ISBN to seed a series and assigns it only to that volume',async({page})=>{
 await expect(page.locator('.page-heading [data-add]')).toHaveCount(1);await expect(page.locator('.page-heading [data-batch]')).toHaveCount(0);
 await page.route('**/api/isbn?*',route=>route.fulfill({json:{status:'found',candidates:[{title:'นิยายทดสอบหลายเล่ม เล่ม 10',author:'ผู้เขียนทดสอบ',isbn:'9786161847012',label:'10',language:'ไทย',edition:'ฉบับธรรมดา',source:'หอสมุดแห่งชาติ (NLT)'}]}}));
 await page.locator('.page-heading [data-add]').click();await page.locator('#lookup-isbn').fill('9786161847012');await page.getByRole('button',{name:'ดึงข้อมูล',exact:true}).click();
 await page.getByRole('button',{name:/นิยายทดสอบหลายเล่ม เล่ม 10/}).click();
 await page.getByRole('button',{name:'หลายเล่มในชุด',exact:true}).click();
 await expect(page.locator('#batch-form [name="title"]')).toHaveValue('นิยายทดสอบหลายเล่ม');
 await expect(page.locator('[name="seedIsbn"]')).toHaveValue('9786161847012');await expect(page.locator('[name="seedLabel"]')).toHaveValue('10');
 await page.locator('[name="end"]').fill('10');await page.locator('[name="excluded"]').fill('5');
 await page.getByRole('button',{name:'ตรวจรายการก่อนเพิ่ม →'}).click();
 await expect(page.locator('#batch-seed-summary')).toContainText('เฉพาะเล่ม 10');
 await expect(page.locator('.batch-isbn')).toHaveCount(1);
 expect((await cachedState(page)).series).toHaveLength(6);
 await page.getByRole('button',{name:'ยืนยันเพิ่มเข้าชั้น'}).click();await expect(page.locator('.entry-row')).toHaveCount(9);
 const series=(await cachedState(page)).series.find(s=>s.title==='นิยายทดสอบหลายเล่ม');
 expect(series.entries.filter(e=>e.isbn)).toHaveLength(1);expect(series.entries.find(e=>e.label==='10').isbn).toBe('9786161847012');
 expect(series.entries.some(e=>e.label==='5')).toBe(false);expect(series.metadataSeed.label).toBe('10');
});

test('batch seed outside the added range supplies metadata without adding or owning the seed volume',async({page})=>{
 await page.locator('.page-heading [data-add]').click();await page.getByRole('button',{name:'หลายเล่มในชุด',exact:true}).click();
 await page.locator('#batch-form [name="title"]').fill('เพิ่มเฉพาะเล่มที่เลือก');await page.locator('[name="end"]').fill('3');
 await page.locator('[name="seedIsbn"]').fill('9786161847012');
 await page.getByRole('button',{name:'ตรวจรายการก่อนเพิ่ม →'}).click();
 await expect(page.locator('#batch-error')).toContainText('เป็นของเล่มไหน');
 await page.locator('[name="seedLabel"]').fill('10');await page.getByRole('button',{name:'ตรวจรายการก่อนเพิ่ม →'}).click();
 await expect(page.locator('#batch-seed-summary')).toContainText('ไม่ได้เพิ่มเล่มนี้');
 await page.getByRole('button',{name:'ยืนยันเพิ่มเข้าชั้น'}).click();await expect(page.locator('.entry-row')).toHaveCount(3);
 const series=(await cachedState(page)).series.find(s=>s.title==='เพิ่มเฉพาะเล่มที่เลือก');
 expect(series.entries.map(e=>e.label)).toEqual(['1','2','3']);expect(series.entries.every(e=>e.isbn==='')).toBe(true);expect(series.metadataSeed.isbn).toBe('9786161847012');
});

test('save and continue stays in the same series, advances volume and clears per-volume ISBN and photo',async({page})=>{
 await fillBook(page,'เพิ่มต่อโดยไม่เริ่มใหม่');await page.locator('[name="isbn"]').fill('9786161847012');
 await page.locator('#photo-file').setInputFiles('public/icon-192.png');await expect(page.locator('#photo-status')).toContainText('เตรียมรูปแล้ว');
 await page.locator('#continue-adding').check();await page.getByRole('button',{name:'ตรวจแล้ว · เพิ่มเข้าชั้น'}).click();
 await expect(page.locator('[name="label"]')).toHaveValue('2');await expect(page.locator('[name="isbn"]')).toHaveValue('');
 await expect(page.locator('[name="title"]')).toHaveValue('เพิ่มต่อโดยไม่เริ่มใหม่');await expect(page.locator('[name="title"]')).toBeDisabled();await expect(page.locator('#photo-preview img')).toHaveCount(0);
 await page.locator('#continue-adding').uncheck();await page.getByRole('button',{name:'ตรวจแล้ว · เพิ่มเข้าชั้น'}).click();await expect(page.locator('#modal')).not.toBeVisible();
 const saved=(await cachedState(page)).series.filter(s=>s.title==='เพิ่มต่อโดยไม่เริ่มใหม่');expect(saved).toHaveLength(1);expect(saved[0].entries.map(e=>e.label)).toEqual(['1','2']);expect(saved[0].entries[1].isbn).toBe('');
});

test('switching add modes preserves shared details, location, status, quantity, seed mapping and photo',async({page})=>{
 await fillBook(page,'สลับโหมดได้');await page.locator('[name="isbn"]').fill('9786161847012');await page.locator('[name="label"]').fill('10');
 await page.locator('[name="quantity"]').fill('3');await page.locator('[name="status"]').selectOption('ordered');await page.locator('[name="location"]').fill('ตู้ทดสอบ');
 await page.locator('#photo-file').setInputFiles('public/icon-192.png');await expect(page.locator('#photo-status')).toContainText('เตรียมรูปแล้ว');
 await page.getByRole('button',{name:'หลายเล่มในชุด',exact:true}).click();await page.locator('[name="end"]').fill('10');await page.locator('[name="excluded"]').fill('5');
 await page.getByRole('button',{name:'ทีละเล่ม',exact:true}).click();
 await expect(page.locator('[name="title"]')).toHaveValue('สลับโหมดได้');await expect(page.locator('[name="quantity"]')).toHaveValue('3');await expect(page.locator('[name="label"]')).toHaveValue('10');await expect(page.locator('[name="isbn"]')).toHaveValue('9786161847012');await expect(page.locator('[name="status"]')).toHaveValue('ordered');await expect(page.locator('[name="location"]')).toHaveValue('ตู้ทดสอบ');await expect(page.locator('#photo-preview img')).toHaveCount(1);
 await page.getByRole('button',{name:'หลายเล่มในชุด',exact:true}).click();await expect(page.locator('[name="end"]')).toHaveValue('10');await expect(page.locator('[name="excluded"]')).toHaveValue('5');
});

test('a saved seed outside the shelf can be reused offline without implying that its volume is owned',async({page,context})=>{
 const data=seedState();data.series[0].metadataSeed={isbn:'9786161847012',label:'10',source:'NLT'};await replaceLibrary(page,data);
 await page.reload();await expect(page.locator('#connection')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();
 await context.setOffline(true);
 await page.locator('.page-heading [data-add]').click();await page.locator('#lookup-isbn').fill('9786161847012');
 await page.getByRole('button',{name:'หลายเล่มในชุด',exact:true}).click();await expect(page.locator('#lookup-isbn')).toHaveValue('9786161847012');
 await page.getByRole('button',{name:'ดึงข้อมูล',exact:true}).click();await expect(page.locator('#lookup-result')).toContainText('ไม่ได้ยืนยันว่ามีเล่มต้นทาง');
 await page.getByRole('button',{name:/ใช้ฉบับเดิม:/}).click();await expect(page.locator('[name="seedLabel"]')).toHaveValue('10');await expect(page.locator('#batch-form [name="title"]')).toBeDisabled();
 await page.locator('[name="end"]').fill('6');await page.getByRole('button',{name:'ตรวจรายการก่อนเพิ่ม →'}).click();await expect(page.locator('#batch-seed-summary')).toContainText('ไม่ได้เพิ่มเล่มนี้');
 await expect(page.locator('#lookup-form')).toBeHidden();
 const saved=await cachedState(page);expect(saved.series[0].entries.some(e=>e.label==='10')).toBe(false);
 await context.setOffline(false);
});

test('check result cover matches the searched edition and tapping the cover or card opens details',async({page,isMobile})=>{
 const data=seedState(),series=data.series[0],entry=series.entries[0];
 series.coverData=`data:image/png;base64,${(await readFile('public/icon-192.png')).toString('base64')}`;
 entry.coverData=`data:image/png;base64,${(await readFile('public/icon-512.png')).toString('base64')}`;entry.isbn='9786161847012';
 await replaceLibrary(page,data);const saved=(await (await page.request.get('/api/library')).json()).state.series[0];
 await page.reload();await page.locator('nav [data-page="check"]').click();await page.getByRole('textbox',{name:'ค้นหาหนังสือ'}).fill('9786161847012');
 const result=page.locator(`[data-check-result="${series.id}"]`);
 await expect(result.locator('.check-result-cover img')).toHaveAttribute('src',saved.entries[0].coverData);
 await expect(result.locator('figcaption')).toHaveText(`ปกเล่ม ${entry.label}`);
 await result.scrollIntoViewIfNeeded();const cover=await result.locator('.check-result-cover img').boundingBox();
 if(isMobile)await page.touchscreen.tap(cover.x+cover.width/2,cover.y+cover.height/2);else await page.mouse.click(cover.x+cover.width/2,cover.y+cover.height/2);
 await expect(page.locator('#modal')).toBeVisible();await expect(page.locator('#modal')).toContainText(series.title);
 await page.getByRole('button',{name:'ปิดหน้าต่าง'}).click();
 await expect(page.getByRole('textbox',{name:'ค้นหาหนังสือ'})).toHaveValue('9786161847012');
 await page.getByRole('textbox',{name:'ค้นหาหนังสือ'}).fill(series.title);await page.getByLabel('เลขเล่ม (ถ้ารู้)').fill('999');
 await expect(result.locator('.check-result-cover img')).toHaveAttribute('src',saved.coverData);await expect(result.locator('figcaption')).toHaveText('ภาพแทนชุด');
 const bodyArea=result.locator('.check-caution');await bodyArea.evaluate(el=>el.scrollIntoView({block:'center'}));const card=await bodyArea.boundingBox();
 if(isMobile)await page.touchscreen.tap(card.x+card.width/2,card.y+card.height/2);else await page.mouse.click(card.x+card.width/2,card.y+card.height/2);
 await expect(page.locator('#modal')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('check results without a photo have a placeholder and keyboard access to details',async({page})=>{
 await page.locator('nav [data-page="check"]').click();await page.getByRole('textbox',{name:'ค้นหาหนังสือ'}).fill('จันทร์เธอ');
 const result=page.locator('[data-check-result="sample-0"]');await expect(result.locator('figcaption')).toHaveText('ยังไม่มีรูปปก');await expect(result.locator('img')).toHaveCount(0);
 const button=result.getByRole('button',{name:/ดูรายละเอียด/});await button.focus();await page.keyboard.press('Enter');await expect(page.locator('#modal')).toBeVisible();
 await page.getByRole('button',{name:'ปิดหน้าต่าง'}).click();await result.getByRole('button',{name:/ดูรายละเอียด/}).focus();await page.keyboard.press('Space');await expect(page.locator('#modal')).toBeVisible();
});

test('shelf sorting orders dates and names and remembers the choice with filters',async({page})=>{
 const data=seedState();data.series=data.series.slice(0,3);
 Object.assign(data.series[0],{title:'Book 10',createdAt:'2024-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'});
 Object.assign(data.series[1],{title:'Book 2',createdAt:'2025-01-01T00:00:00Z'});
 Object.assign(data.series[2],{title:'กานต์',createdAt:'2023-01-01T00:00:00Z'});
 await replaceLibrary(page,data);await page.reload();
 const titles=page.locator('.book-card h3'),order=page.getByLabel('เรียงตาม',{exact:true});
 await expect(titles).toHaveText(['Book 2','Book 10','กานต์']);
 await order.selectOption('oldest');await expect(titles).toHaveText(['กานต์','Book 10','Book 2']);
 await order.selectOption('title');await expect(titles).toHaveText(['กานต์','Book 2','Book 10']);
 await order.selectOption('title-desc');await expect(titles).toHaveText(['Book 10','Book 2','กานต์']);
 await order.selectOption('updated');await expect(titles.first()).toHaveText('Book 10');
 await order.selectOption('title');await page.getByRole('textbox',{name:'ค้นหาหนังสือ'}).fill('Book');await expect(titles).toHaveText(['Book 2','Book 10']);
 await page.locator('nav [data-page="drafts"]').click();await page.locator('nav [data-page="shelf"]').click();await expect(order).toHaveValue('title');
 await page.reload();await expect(order).toHaveValue('title');await expect(titles).toHaveText(['กานต์','Book 2','Book 10']);
 await page.evaluate(async credentials=>{const {account}=await import('/app.js');await account.logout();await account.login('register',credentials);},{email:`sort-${randomUUID()}@example.test`,password:'sort-account-browser-password',name:'บัญชีแยก'});
 await expect(order).toHaveValue('newest');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
