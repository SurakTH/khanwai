import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function readableFields(page) {
  const fields = page.locator('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), select, textarea');
  let visible = 0;
  for (const field of await fields.all()) {
    if (!await field.isVisible()) continue;
    visible++;
    expect(await field.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  }
  expect(visible).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('mobile login, search and add fields stay readable without restricting viewport zoom', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile form baseline');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await readableFields(page);
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale\s*=/i);
  const registered = await page.request.post('/api/auth/register', {
    headers: { 'X-Book-Request': '1' },
    data: { email: `input-${randomUUID()}@example.test`, password: 'mobile-input-password', name: 'นักอ่านทดสอบ' },
  });
  expect(registered.status()).toBe(201);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'ค้นหาหนังสือ' })).toBeVisible();
  await readableFields(page);
  await page.locator('.page-heading [data-add]').click();
  await expect(page.locator('[name="title"]')).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await readableFields(page);
    await page.locator('[name="title"]').fill('ลองพิมพ์ชื่อหนังสือ');
  }
});
