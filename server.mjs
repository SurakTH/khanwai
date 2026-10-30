import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createIsbnLookup } from './src/isbn.mjs';
export { lookupIsbn } from './src/isbn.mjs';
import { LibraryStorage, AppError } from './src/storage.mjs';
import { credentials, hashPassword, verifyPassword, sessionToken, startSession, clearCookie } from './src/auth.mjs';

const root = path.resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };

export function createApp(options = {}) {
  const lookup = createIsbnLookup({ fetcher: options.lookupFetcher ?? fetch, apiKey: process.env.GOOGLE_BOOKS_API_KEY ?? '' });
  const storage = options.storage ?? new LibraryStorage(options.dataDirectory ?? process.env.DATA_DIR ?? './data');
  const secure = options.secureCookies ?? (process.env.COOKIE_SECURE === 'true' || process.env.APP_ORIGIN?.startsWith('https://'));
  const registration = options.allowRegistration ?? process.env.ALLOW_REGISTRATION !== 'false';
  const app = createServer(async (req, res) => {
    const headers = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" };
    const send = (status, value, extra = {}) => { res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8', ...extra }); res.end(JSON.stringify(value)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      const mutating = !['GET', 'HEAD'].includes(req.method);
      if (mutating) {
        const origin = req.headers.origin;
        const expected = process.env.APP_ORIGIN || `${secure ? 'https' : 'http'}://${req.headers.host}`;
        if (req.headers['x-book-request'] !== '1' || origin && origin !== expected || req.headers['sec-fetch-site'] === 'cross-site') throw new AppError(403, 'invalid_origin', 'คำขอไม่ถูกต้อง กรุณาเปิดจากเว็บแอพโดยตรง');
        if (!req.headers['content-type']?.startsWith('application/json')) throw new AppError(415, 'invalid_content_type', 'คำขอต้องเป็น JSON');
      }
      if (url.pathname === '/healthz' && !mutating) return send(200, { status: 'ok', database: 'sqlite' });
      if (url.pathname === '/api/config' && req.method === 'GET') return send(200, { registration });
      if (['/api/auth/register','/api/auth/login'].includes(url.pathname) && req.method === 'POST') {
        const body = await jsonBody(req, 16384), signup = url.pathname.endsWith('/register');
        if (signup && !registration) throw new AppError(403, 'registration_closed', 'ปิดการสมัครบัญชีใหม่แล้ว');
        storage.rateLimit(`auth-ip:${req.socket.remoteAddress}`, 120);
        const values = credentials(body, { registration: signup });
        storage.rateLimit(`auth:${req.socket.remoteAddress}:${values.email}`, 12);
        let user;
        if (signup) user = storage.createUser(values.email, values.name, await hashPassword(values.password));
        else {
          user = storage.findUser(values.email);
          const valid = await verifyPassword(values.password, user?.password_hash);
          if (!valid) throw new AppError(401, 'wrong_credentials', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        }
        return send(signup ? 201 : 200, { user: storage.publicUser(user) }, { 'Set-Cookie': startSession(storage, user.id, secure) });
      }
      if (url.pathname.startsWith('/api/')) {
        const token = sessionToken(req), user = storage.session(token);
        if (!user) throw new AppError(401, 'unauthorized', 'กรุณาเข้าสู่ระบบ');
        const owner = user.id;
        if (url.pathname === '/api/auth/me' && req.method === 'GET') return send(200, { user: storage.publicUser(user) });
        if (url.pathname === '/api/auth/logout' && req.method === 'POST') { storage.removeSession(token); return send(200, { ok: true }, { 'Set-Cookie': clearCookie(secure) }); }
        if (url.pathname === '/api/auth/password' && req.method === 'POST') {
          const body = await jsonBody(req, 16384);
          storage.rateLimit(`password:${owner}`, 10);
          if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 256 || !await verifyPassword(body.currentPassword, user.password_hash)) throw new AppError(401, 'wrong_password', 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
          if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 256) throw new AppError(400, 'invalid_password', 'รหัสผ่านใหม่ต้องมี 10–256 ตัวอักษร');
          const passwordHash = await hashPassword(body.password);
          storage.transaction(() => { if (storage.user(owner)?.password_hash !== user.password_hash) throw new AppError(401, 'credentials_changed', 'ข้อมูลบัญชีเปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่'); storage.db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash, owner); storage.db.prepare('DELETE FROM sessions WHERE owner=?').run(owner); });
          return send(200, { ok: true }, { 'Set-Cookie': startSession(storage, owner, secure) });
        }
        if (url.pathname === '/api/account' && req.method === 'DELETE') {
          const body = await jsonBody(req, 16384);
          storage.rateLimit(`delete:${owner}`, 10);
          if (typeof body.password !== 'string' || body.password.length > 256 || !await verifyPassword(body.password, user.password_hash)) throw new AppError(401, 'wrong_password', 'รหัสผ่านไม่ถูกต้อง');
          storage.deleteAccount(owner, user.password_hash); return send(200, { ok: true }, { 'Set-Cookie': clearCookie(secure) });
        }
        if (url.pathname === '/api/settings' && req.method === 'GET') return send(200, storage.settings(owner));
        if (url.pathname === '/api/settings' && req.method === 'PUT') return send(200, storage.saveSettings(owner, await jsonBody(req, 16384)));
        if (url.pathname === '/api/library' && req.method === 'GET') return send(200, storage.snapshot(owner));
        if (url.pathname === '/api/sync' && req.method === 'GET') return send(200, storage.delta(owner, Number(url.searchParams.get('after') ?? '0')));
        if (url.pathname === '/api/sync' && req.method === 'POST') return send(200, storage.apply(owner, await jsonBody(req, 50 * 1024 * 1024)));
        if (url.pathname === '/api/export' && req.method === 'GET') return send(200, storage.exportAccount(owner), { 'Content-Disposition': 'attachment; filename="khanwai-backup.json"' });
        if (url.pathname.startsWith('/api/photos/') && req.method === 'GET') {
          const photo = storage.photo(owner, url.pathname.slice('/api/photos/'.length));
          if (!photo) throw new AppError(404, 'not_found', 'ไม่พบรูปปก');
          const content = await readFile(path.join(storage.directory, photo.relative_path));
          res.writeHead(200, { ...headers, 'Content-Type': photo.mime, 'X-Book-Owner': owner }); return res.end(content);
        }
        if (url.pathname === '/api/isbn' && req.method === 'GET') {
          storage.rateLimit(`isbn:${owner}`, 120, 60000);
          const result = await lookup(url.searchParams.get('isbn'), storage.settings(owner).isbnProviders);
          return send(result.status === 'invalid' ? 400 : 200, result);
        }
        throw new AppError(404, 'not_found', 'ไม่พบเส้นทาง');
      }
      if (mutating) return send(405, { error: 'method_not_allowed' });
      const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!/^[a-zA-Z0-9_./-]+$/.test(relative) || relative.split('/').some(p => p.startsWith('.'))) return send(404, { error: 'not_found' });
      const filename = path.resolve(root, relative);
      if (!filename.startsWith(root + path.sep)) return send(404, { error: 'not_found' });
      try {
        const content = await readFile(filename);
        res.writeHead(200, { ...headers, 'Content-Type': types[path.extname(filename)] ?? 'application/octet-stream' }); res.end(req.method === 'HEAD' ? undefined : content);
      } catch { send(404, { error: 'not_found' }); }
    } catch (error) {
      if (!res.headersSent) send(error.status ?? 500, { error: error.code ?? 'internal_error', message: error.status ? error.message : 'เซิร์ฟเวอร์ทำงานไม่สำเร็จ กรุณาลองใหม่', ...(error.details ? { details: error.details } : {}) });
    }
  });
  app.storage = storage;
  app.on('close', () => { if (!options.storage) storage.close(); });
  return app;
}

async function jsonBody(req, limit) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new AppError(413, 'body_too_large', 'ข้อมูลใหญ่เกินขนาดที่รองรับ กรุณาแบ่งนำเข้าเป็นชุด');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AppError(400, 'invalid_json', 'ข้อมูล JSON ไม่ถูกต้อง'); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173), host = process.env.HOST ?? '127.0.0.1';
  const app = createApp();
  app.listen(port, host, () => console.log(`คั่นไว้ · http://${host}:${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => app.close(() => process.exit(0)));
}
