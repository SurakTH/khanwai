import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { seedState } from '../../public/lib.js';
import { emptyLibrary, recordDiff } from '../../public/sync-core.js';
const headers = { 'X-Book-Request': '1' };
const library = async page => (await (await page.request.get('/api/library')).json()).state;
async function manager(page) {
  await page.locator('nav [data-page=settings]').click();
  await page.locator('#manage-categories').click();
  await expect(page.getByRole('heading', { name: 'จัดการหมวดหมู่', exact: true })).toBeVisible();
}
async function addCategory(page, name) {
  await page.locator('[name=categoryName]').fill(name);
  await page.getByRole('button', { name: 'เพิ่มหมวดหมู่', exact: true }).click();
  await expect(page.locator('.category-row strong', { hasText: name })).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  expect((await page.request.post('/api/auth/register', { headers, data: { email: `category-${randomUUID()}@example.test`, password: 'category-test-password', name: 'นักอ่านทดสอบ' } })).status()).toBe(201);
  const state = seedState();
  expect((await page.request.post('/api/sync', { headers, data: { id: randomUUID(), changes: recordDiff(emptyLibrary(), state).map(c => ({ ...c, baseRevision: 0 })) } })).ok()).toBe(true);
  await page.goto('/'); await expect(page.locator('#series-count')).toHaveText('6');
});

test('manage categories, prevent duplicates and move books safely when deleting a used category', async ({ page }) => {
  const before = await library(page), original = before.series[0].category;
  await manager(page); await expect(page.locator('.category-row')).toHaveCount(4);
  await addCategory(page, 'การ์ตูนวาย');
  await page.locator('[name=categoryName]').fill('การ์ตูนวาย'); await page.getByRole('button', { name: 'เพิ่มหมวดหมู่', exact: true }).click();
  await expect(page.locator('#category-form [role=alert]')).toContainText('แล้ว');
  const row = page.locator('.category-row').filter({ has: page.locator('strong', { hasText: original }) }).first();
  await row.getByRole('button', { name: 'เปลี่ยนชื่อ' }).click();
  await page.locator('[name=categoryName]').fill('หมวดที่เปลี่ยนชื่อ'); await page.getByRole('button', { name: 'บันทึกหมวดหมู่' }).click();
  await expect.poll(async () => (await library(page)).series[0].category).toBe('หมวดที่เปลี่ยนชื่อ');
  await page.locator('.category-row').filter({ hasText: 'หมวดที่เปลี่ยนชื่อ' }).getByRole('button', { name: 'ลบ', exact: true }).click();
  await expect(page.locator('[name=categoryTarget]')).toHaveValue('');
  await page.locator('[name=categoryTarget]').selectOption('การ์ตูนวาย'); await page.getByRole('button', { name: 'บันทึกหมวดหมู่' }).click();
  await expect.poll(async () => (await library(page)).series[0].category).toBe('การ์ตูนวาย');
  const after = await library(page);
  expect(after.series.map(s => s.entries)).toEqual(before.series.map(s => s.entries));
  expect(after.categories).not.toContain('หมวดที่เปลี่ยนชื่อ');
  await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
  await page.locator('nav [data-page=shelf]').click(); await page.locator('.shelf-filters summary').click();
  await page.locator('#category').selectOption('การ์ตูนวาย');
  expect(await page.locator('.book-card').count()).toBe(before.series.filter(s => s.category === original).length);
});

test('custom options reach single, batch and edit forms, persist offline and appear on another device', async ({ page, context, browser }, info) => {
  await manager(page); await addCategory(page, 'การ์ตูนวาย');
  await expect.poll(async () => (await library(page)).categories).toContain('การ์ตูนวาย');
  const second = await browser.newContext({ storageState: await context.storageState(), baseURL: info.project.use.baseURL });
  try {
    const other = await second.newPage(); await other.goto('/'); await manager(other); await expect(other.locator('.category-row strong', { hasText: 'การ์ตูนวาย' })).toBeVisible();
  } finally { await second.close(); }
  await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click(); await page.locator('nav [data-page=shelf]').click();
  await page.locator('.page-heading [data-add]').click(); await page.locator('[name=category]').selectOption('การ์ตูนวาย');
  await page.locator('[name=title]').fill('เรื่องหมวดใหม่'); await page.locator('[name=label]').fill('1');
  await page.getByRole('button', { name: 'ตรวจแล้ว · เพิ่มเข้าชั้น' }).click();
  await expect.poll(async () => (await library(page)).series.find(s => s.title === 'เรื่องหมวดใหม่')?.category).toBe('การ์ตูนวาย');
  await page.locator('.book-card').filter({ hasText: 'เรื่องหมวดใหม่' }).click();
  await page.getByRole('button', { name: 'แก้ไขข้อมูลเรื่อง / ฉบับ', exact: true }).click();
  await expect(page.locator('[name=category]')).toHaveValue('การ์ตูนวาย');
  await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
  await page.locator('.page-heading [data-add]').click(); await page.getByRole('button', { name: 'หลายเล่มในชุด', exact: true }).click();
  await page.locator('#batch-form [name=category]').selectOption('การ์ตูนวาย');
  await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); await manager(page);
  await context.setOffline(true); await addCategory(page, 'หมวดออฟไลน์');
  await page.reload(); await manager(page); await expect(page.locator('.category-row strong', { hasText: 'หมวดออฟไลน์' })).toBeVisible();
  await context.setOffline(false); await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
  await expect.poll(async () => (await library(page)).categories).toContain('หมวดออฟไลน์');
});

test('unused categories import and replace correctly; renamed drafts keep their category during review', async ({ page }) => {
  await manager(page); await addCategory(page, 'การ์ตูนวาย');
  await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click(); await page.locator('nav [data-page=shelf]').click();
  await page.locator('.page-heading [data-add]').click(); await page.locator('[name=title]').fill('เรื่องในถาด');
  await page.locator('[name=category]').selectOption('การ์ตูนวาย'); await page.getByRole('button', { name: 'เก็บไว้ในถาดรอตรวจ' }).click();
  await manager(page); await page.locator('.category-row').filter({ hasText: 'การ์ตูนวาย' }).getByRole('button', { name: 'เปลี่ยนชื่อ' }).click();
  await page.locator('[name=categoryName]').fill('การ์ตูนใหม่'); await page.getByRole('button', { name: 'บันทึกหมวดหมู่' }).click();
  await expect.poll(async () => (await library(page)).drafts[0]?.category).toBe('การ์ตูนใหม่');
  await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click(); await page.locator('nav [data-page=drafts]').click();
  await page.locator('[data-review]').first().click(); await expect(page.locator('[name=category]')).toHaveValue('การ์ตูนใหม่');
  await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click(); await page.locator('nav [data-page=settings]').click();
  const incoming = { ...emptyLibrary(), categories: ['หมวดจากไฟล์'] };
  await page.locator('#import-file').setInputFiles({ name: 'categories.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) });
  await page.locator('#confirm-import').click();
  await expect.poll(async () => (await library(page)).categories).toContain('หมวดจากไฟล์');
  expect((await library(page)).series).toHaveLength(6);
  await page.locator('#import-file').setInputFiles({ name: 'categories-replace.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) });
  await page.locator('#replace-import').check(); await page.locator('#confirm-import').click();
  await expect.poll(async () => (await library(page)).series.length).toBe(0);
  expect((await library(page)).categories).toEqual(['หมวดจากไฟล์']);
  await page.locator('#manage-categories').click(); await expect(page.locator('[data-category-delete]')).toBeDisabled();
});

test('conflicting catalog edits show both category lists and require an explicit choice', async ({ page, context }) => {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload(); await manager(page);
  await context.setOffline(true); await addCategory(page, 'หมวดในเครื่อง');
  const snapshot = await (await page.request.get('/api/library')).json();
  expect((await page.request.post('/api/sync', { headers, data: { id: randomUUID(), changes: [{ key: 'catalog:categories', baseRevision: 0, value: { id: 'categories', names: ['หมวดอีกเครื่อง'] } }] } })).ok()).toBe(true);
  await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
  await context.setOffline(false); await page.locator('#connection').click();
  await expect(page.locator('#conflict-form')).toContainText('หมวดในเครื่อง');
  await expect(page.locator('#conflict-form')).toContainText('หมวดอีกเครื่อง');
  expect((await library(page)).categories).toEqual(['หมวดอีกเครื่อง']);
  await page.locator('[name=keep-0]').check(); await page.getByRole('button', { name: 'ใช้ข้อมูลที่เลือกแล้วซิงก์' }).click();
  await expect.poll(async () => (await library(page)).categories).toContain('หมวดในเครื่อง');
  expect((await library(page)).series).toEqual(snapshot.state.series);
});
