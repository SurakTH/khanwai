import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, lookupIsbn } from '../server.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('lookup only returns metadata with matching ISBN, never fuzzy API results', async () => {
  const result = await lookupIsbn('0306406152', async () => Response.json({ items: [
    { id: 'right', volumeInfo: { title: 'Matched', authors: ['A'], industryIdentifiers: [{ identifier: '9780306406157' }] } },
    { id: 'wrong', volumeInfo: { title: 'Wrong edition', industryIdentifiers: [{ identifier: '9780140328721' }] } },
  ] }));
  assert.equal(result.status, 'found'); assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].externalId, 'right');
});
test('lookup handles not found, rate limits, network and malformed upstream responses', async () => {
  assert.equal((await lookupIsbn('bad', () => { throw Error('must not call'); })).status, 'invalid');
  assert.equal((await lookupIsbn('9780306406157', async () => Response.json({}))).status, 'not_found');
  assert.equal((await lookupIsbn('9780306406157', async () => new Response('', { status: 429 }))).status, 'rate_limited');
  assert.equal((await lookupIsbn('9780306406157', async () => { throw Error('offline'); })).status, 'unavailable');
  assert.equal((await lookupIsbn('9780306406157', async () => Response.json({ items: {} }))).status, 'unavailable');
});
test('server serves app shell, denies non-public paths and rejects mutations', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'book-static-test-'));
  const app = createApp({ dataDirectory: directory }); app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(async () => { await new Promise(resolve => { app.closeAllConnections(); app.close(resolve); }); await rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.address().port}`;
  const response = await fetch(base);
  assert.equal(response.status, 200); assert.match(await response.text(), /คั่นไว้/);
  assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
  assert.deepEqual(await (await fetch(base + '/healthz')).json(), { status: 'ok', database: 'sqlite' });
  for (const target of ['/styles.css', '/app.js', '/lib.js', '/sw.js', '/manifest.webmanifest', '/icon.svg']) assert.equal((await fetch(base + target)).status, 200);
  for (const target of ['/README.md', '/package.json', '/.env', '/docs/01-product.md']) assert.equal((await fetch(base + target)).status, 404);
  assert.equal((await fetch(base + '/api/isbn?isbn=bad')).status, 401);
  assert.equal((await fetch(base, { method: 'POST', headers: { 'X-Book-Request': '1', 'Content-Type': 'application/json' }, body: '{}' })).status, 405);
});
