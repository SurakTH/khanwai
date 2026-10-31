const CACHE = 'khanwai-shell-v33';
const ASSETS = ['/', '/index.html', '/styles.css', '/mobile-inputs.css', '/categories.js', '/trash.js', '/trash-ui.js', '/trash.css', '/unread-picker.js', '/category-ui.js', '/category-ui.css', '/shelf.css', '/shelf-view.js', '/detail.css', '/detail-view.js', '/workshop.css', '/account.css', '/lookup-settings.js', '/provider-options.js', '/app.js', '/ids.js', '/shelf-sort.js', '/shelf-tools.js', '/bulk-edit.js', '/csv-import.js', '/csv-ui.js', '/lib.js', '/reading.js', '/photos.js', '/workshop.js', '/editing.js', '/barcode.js', '/account-store.js', '/account-ui.js', '/sync-core.js', '/vendor/barcode-decoder.js', '/icon.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest', '/fonts/NotoSansThai.ttf'];
const OWNER_MAP = 'khanwai-client-owners-v1';
const ownerKey = client => `/__book-client/${encodeURIComponent(client)}`;
async function ownerFor(client) { if (!client) return null; const response = await (await caches.open(OWNER_MAP)).match(ownerKey(client)); return response ? response.text() : null; }
self.addEventListener('message', event => {
  if (event.data?.type !== 'ACCOUNT' || !event.source?.id) return;
  event.waitUntil((async () => {
    const { owner, clear } = event.data;
    if (clear && /^[a-f0-9-]{36}$/.test(clear)) await caches.delete(`khanwai-private-${clear}`);
    const mapping = await caches.open(OWNER_MAP);
    if (owner && /^[a-f0-9-]{36}$/.test(owner)) await mapping.put(ownerKey(event.source.id), new Response(owner)); else await mapping.delete(ownerKey(event.source.id));
    event.ports[0]?.postMessage({ ok: true });
  })());
});
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('khanwai-shell-') && key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method === 'GET' && url.origin === self.location.origin && /^\/api\/photos\/[a-f0-9]{64}$/.test(url.pathname)) {
    event.respondWith((async () => {
      const owner = await ownerFor(event.clientId);
      try {
        const response = await fetch(event.request);
        if (owner && response.ok && response.headers.get('X-Book-Owner') === owner) await (await caches.open(`khanwai-private-${owner}`)).put(event.request, response.clone());
        return response;
      } catch {
        if (owner) { const cached = await (await caches.open(`khanwai-private-${owner}`)).match(event.request); if (cached) return cached; }
        return new Response('รูปนี้ยังไม่ได้โหลดในเครื่อง', { status: 503 });
      }
    })()); return;
  }
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !ASSETS.includes(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(url.pathname)));
});
