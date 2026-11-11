import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { emptyLibrary, recordDiff } from '../../public/sync-core.js';

const headers = { 'X-Book-Request': '1' };
const isbn = '9780306406157';
const entry = (id, label, fields = {}) => ({ id, label, kind: 'volume', isbn: '', status: 'owned', quantity: 1, ...fields });
const edition = (id, title, format, entries) => ({
  id, title, format, entries, author: 'ผู้เขียนทดสอบ', alias: '', category: 'การ์ตูน', edition: 'ธรรมดา', language: 'ไทย'
});
const snapshot = async page => (await page.request.get('/api/library')).json();
const close = page => page.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
const result = page => page.locator('#shelf-result-count');

async function seed(page, series) {
  const data = { email: `editions-${randomUUID()}@example.test`, password: 'edition-browser-password', name: 'ทดสอบฉบับ' };
  expect((await page.request.post('/api/auth/register', { headers, data })).status()).toBe(201);
  const before = emptyLibrary();
  const changes = recordDiff(before, { ...before, series }).map(change => ({ ...change, baseRevision: 0 }));
  expect((await page.request.post('/api/sync', { headers, data: { id: randomUUID(), changes } })).ok()).toBe(true);
  await page.goto('/');
  await page.locator('.book-card').first().waitFor();
  await expect(page.locator('#connection')).toContainText('บันทึกบนเซิร์ฟเวอร์แล้ว');
  await expect(result(page)).toContainText('เรื่อง / ฉบับ');
  return data;
}

test('linked card counts unique volumes after filters and shows other editions as ISBN context', async ({ page, browser }) => {
  const print = edition('print', 'เรื่องกระดาษ', 'physical', [
    entry('box', 'บ็อกซ์', { kind: 'box', members: ['1', '2', '3'], isbn, location: 'ตู้ A', readingStatus: 'read', readingByMember: { '2': 'unread' } }),
    entry('copy', '2', { quantity: 2, location: 'ตู้ A', readingStatus: 'read' })
  ]);
  const ebook = edition('digital', 'ชื่อดิจิทัล', 'ebook', [entry('digital2', '2', { status: 'ordered', location: 'แอพ' })]);
  const login = await seed(page, [print, ebook]);
  await expect(result(page)).toContainText('4 เล่ม (หนังสือเล่ม 3 · ebook 1)');
  await page.locator('.book-card[data-detail=print]').click();
  await page.locator('[data-link-edition]').click();
  await page.locator('#edition-link-form select').selectOption('digital');
  await expect(page.locator('#edition-link-preview li')).toHaveCount(2);
  await page.getByRole('button', { name: 'ยืนยันเชื่อมฉบับ' }).click();
  await expect(page.locator('.detail-entry')).toHaveCount(3);
  await close(page);
  await expect(page.locator('.book-card')).toHaveCount(1);
  await expect(page.locator('.book-card')).toContainText('4 เล่ม');
  await expect.poll(async () => (await snapshot(page)).state.series.filter(s => s.groupId).length).toBe(2);

  const second = await browser.newContext();
  try {
    const other = await second.newPage();
    const origin = new URL(page.url()).origin;
    expect((await other.request.post(origin + '/api/auth/login', { headers, data: login })).ok()).toBe(true);
    await other.goto(origin);
    await expect(other.locator('.book-card')).toHaveCount(1);
  } finally { await second.close(); }

  await page.locator('.shelf-filters summary').click();
  await page.locator('#format-filter').selectOption('ebook');
  await expect(result(page)).toContainText('1 เล่ม (หนังสือเล่ม 0 · ebook 1)');
  await page.locator('#format-filter').selectOption('all');
  await page.locator('#shelf-location').selectOption('ตู้ A');
  await page.locator('#shelf-reading').selectOption('unread');
  await expect(result(page)).toContainText('1 เล่ม (หนังสือเล่ม 1 · ebook 0)');
  await page.locator('[data-filter=ordered]').click();
  await expect(result(page)).toContainText('0 เรื่อง / ฉบับ · 0 เล่ม');
  await page.getByRole('button', { name: 'ล้างตัวกรองทั้งหมด' }).click();
  await page.locator('#search').fill(isbn);
  await expect(result(page)).toContainText('3 เล่ม (หนังสือเล่ม 3 · ebook 0)');
  await page.locator('nav [data-page=check]').click();
  await page.locator('#search').fill(isbn);
  await expect(page.locator('[data-check-result=print]')).toContainText('ISBN ตรงกับรายการที่บันทึก');
  await expect(page.locator('[data-check-result=digital]')).toContainText('ฉบับที่เชื่อมไว้');
  await expect(page.locator('[data-check-result=digital] .check-status-list')).toContainText('เล่ม 2');
  await page.locator('nav [data-page=shelf]').click();
  await page.locator('.book-card').click();
  await expect(page.locator('[data-detail-entry=copy] .entry-format')).toHaveText('หนังสือเล่ม');
  await expect(page.locator('[data-detail-entry=digital2] .entry-format')).toHaveText('ebook');
  await page.locator('[data-entry-status=digital2]').selectOption('owned');
  await expect(page.locator('[data-entry-status=digital2]')).toHaveValue('owned');
  await expect(page.locator('[data-entry-status=copy]')).toHaveValue('owned');
  await page.locator('[data-edition-settings=digital] > summary').click();
  await page.locator('[data-link-edition=digital]').click();
  await page.locator('#unlink-edition').click();
  await expect(page.locator('[data-release-target]')).toBeVisible();
  await close(page);
  await expect(page.locator('.book-card')).toHaveCount(2);
  await expect.poll(async () => (await snapshot(page)).state.series.filter(s => s.groupId).length).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('release reference numbers stay out of shelf totals until a volume is added', async ({ page }) => {
  await seed(page, [edition('print', 'ชุดสิบเล่ม', 'physical', Array.from({ length: 6 }, (_, i) => entry(`vol-${i}`, String(i + 1))))]);
  await page.locator('.book-card').click();
  await page.locator('[data-release-target]').click();
  await page.locator('#release-target-form [name=target]').fill('1–10');
  await page.getByRole('button', { name: 'บันทึกเลขเล่ม' }).click();
  await expect(page.locator('#modal')).toContainText('ระบุว่าออกถึงเล่ม 10 · มีแล้ว 6 เล่ม');
  await expect(page.locator('.volume-chip.missing')).toHaveText(['7', '8', '9', '10']);
  await close(page);
  await expect(result(page)).toContainText('6 เล่ม');
  await page.locator('[data-filter=wishlist]').click();
  await expect(result(page)).toContainText('0 เรื่อง / ฉบับ · 0 เล่ม');
  await page.locator('[data-filter=all]').click();
  await page.locator('.shelf-filters summary').click();
  await page.locator('#shelf-reading').selectOption('unread');
  await expect(result(page)).toContainText('6 เล่ม');
  await page.getByRole('button', { name: 'ดูผลลัพธ์', exact: true }).click();
  await page.locator('.book-card').click();
  await page.locator('[data-add-to]').click();
  await page.locator('#review-form [name=label]').fill('7');
  await page.getByRole('button', { name: 'ตรวจแล้ว · เพิ่มเข้าชั้น' }).click();
  await expect(result(page)).toContainText('7 เล่ม');
  await expect.poll(async () => (await snapshot(page)).state.series[0].entries.length).toBe(7);
});

test('add the other format from details in batch and reuse it for a single volume', async ({ page }) => {
  await seed(page, [edition('print', 'เรื่องเพิ่มอีกแบบ', 'physical', [entry('print1', '1', { isbn })])]);
  await page.locator('.book-card').click();
  await page.locator('[data-add-format]').click();
  await expect(page.locator('#review-form [name=title]')).toHaveValue('เรื่องเพิ่มอีกแบบ');
  await expect(page.locator('#review-form [name=format]')).toHaveValue('ebook');
  await expect(page.locator('#review-form [name=isbn]')).toHaveValue('');
  await page.locator('[data-add-mode=batch]').click();
  await page.locator('#batch-form [name=start]').fill('2');
  await page.locator('#batch-form [name=end]').fill('3');
  await page.getByRole('button', { name: 'ตรวจรายการก่อนเพิ่ม' }).click();
  await page.locator('#batch-confirm').click();
  await expect(page.locator('.detail-edition')).toContainText('ebook');
  await close(page);
  await expect(page.locator('.book-card')).toHaveCount(1);
  await expect(result(page)).toContainText('3 เล่ม');
  await page.locator('.book-card').click();
  await page.locator('[data-edition-settings=print] > summary').click();
  await page.locator('[data-add-format=print]').click();
  const option = page.locator('#series-link option').last();
  await expect(option).toContainText('ebook');
  await page.locator('#series-link').selectOption(await option.getAttribute('value'));
  await page.locator('#review-form [name=label]').fill('4');
  await page.getByRole('button', { name: 'ตรวจแล้ว · เพิ่มเข้าชั้น' }).click();
  await expect(page.locator('.detail-edition')).toContainText('ebook');
  await expect.poll(async () => (await snapshot(page)).state.series.find(s => s.format === 'ebook')?.entries.map(e => e.label)).toEqual(['2', '3', '4']);
  const { state } = await snapshot(page);
  expect(state.series).toHaveLength(2);
  expect(state.series[0].groupId).toBe(state.series[1].groupId);
});
