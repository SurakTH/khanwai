import { DatabaseSync, backup as sqliteBackup } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DEFAULT_PROVIDERS, validateProviders } from '../public/provider-options.js';
import { expandLibrary, flattenLibrary, stableJSON } from '../public/sync-core.js';

export class AppError extends Error {
  constructor(status, code, message, details) { super(message); Object.assign(this, { status, code, details }); }
}
const tables = { series: 'series', entry: 'entries', draft: 'drafts' };
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function parseKey(key) {
  if (typeof key !== 'string' || key.length > 110) throw new AppError(400, 'invalid_operation', 'รายการซิงก์ไม่ถูกต้อง');
  const split = key.indexOf(':'), kind = key.slice(0, split), id = key.slice(split + 1);
  if (!tables[kind] || !id || id.length > 100) throw new AppError(400, 'invalid_operation', 'ชนิดรายการซิงก์ไม่ถูกต้อง');
  return { kind, id, table: tables[kind] };
}

export class LibraryStorage {
  constructor(directory) {
    this.directory = path.resolve(directory);
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(this.directory, 'library.sqlite'), { timeout: 5000 });
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;');
    const version = this.db.prepare('PRAGMA user_version').get().user_version;
    if (version > 2) throw Error('ฐานข้อมูลเป็นเวอร์ชันใหม่กว่าแอพ ห้ามเปิดด้วย image เก่า');
    if (version === 0) this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE users(id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL, cursor INTEGER NOT NULL DEFAULT 0) STRICT;
      CREATE TABLE sessions(token_hash TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL) STRICT;
      CREATE INDEX sessions_owner ON sessions(owner);
      CREATE TABLE series(owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), revision INTEGER NOT NULL, deleted INTEGER NOT NULL CHECK(deleted IN(0,1)), PRIMARY KEY(owner,id)) STRICT;
      CREATE TABLE entries(owner TEXT NOT NULL, id TEXT NOT NULL, series_id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), revision INTEGER NOT NULL, deleted INTEGER NOT NULL CHECK(deleted IN(0,1)), PRIMARY KEY(owner,id), FOREIGN KEY(owner,series_id) REFERENCES series(owner,id) DEFERRABLE INITIALLY DEFERRED) STRICT;
      CREATE INDEX entries_series ON entries(owner,series_id);
      CREATE TABLE drafts(owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), revision INTEGER NOT NULL, deleted INTEGER NOT NULL CHECK(deleted IN(0,1)), PRIMARY KEY(owner,id)) STRICT;
      CREATE TABLE operations(owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL, request_hash TEXT NOT NULL, result TEXT NOT NULL CHECK(json_valid(result)), created_at INTEGER NOT NULL, PRIMARY KEY(owner,id)) STRICT;
      CREATE TABLE changes(owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, cursor INTEGER NOT NULL, entity_key TEXT NOT NULL, data TEXT CHECK(data IS NULL OR json_valid(data)), PRIMARY KEY(owner,cursor)) STRICT;
      CREATE TABLE photos(owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL, mime TEXT NOT NULL, relative_path TEXT NOT NULL, PRIMARY KEY(owner,id)) STRICT;
      CREATE TABLE rate_limits(bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL) STRICT;
      CREATE TABLE maintenance(id INTEGER PRIMARY KEY CHECK(id=1), token TEXT NOT NULL, expires_at INTEGER NOT NULL) STRICT;
      PRAGMA user_version=1; COMMIT;`);
    if (version < 2) this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE preferences(owner TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL CHECK(json_valid(data)), revision INTEGER NOT NULL) STRICT;
      PRAGMA user_version=2; COMMIT;`);

  }
  close() { this.db.close(); }
  writable() {
    if (this.db.prepare('SELECT id FROM maintenance WHERE expires_at>?').get(Date.now())) throw new AppError(503, 'maintenance', 'กำลังสำรองข้อมูล กรุณาซิงก์ใหม่อีกสักครู่');
  }
  transaction(fn, { maintenance = false } = {}) {
    this.db.exec('BEGIN IMMEDIATE');
    try { if (!maintenance) this.writable(); const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  publicUser(user) { return user ? { id: user.id, email: user.email, name: user.name } : null; }
  user(id) { return this.db.prepare('SELECT * FROM users WHERE id=?').get(id); }
  findUser(email) { return this.db.prepare('SELECT * FROM users WHERE email=?').get(email); }
  createUser(email, name, passwordHash) {
    return this.transaction(() => {
      if (this.findUser(email)) throw new AppError(409, 'email_used', 'อีเมลนี้มีบัญชีแล้ว ลองเข้าสู่ระบบ');
      const id = randomUUID();
      this.db.prepare('INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)').run(id, email, name, passwordHash, Date.now());
      return this.user(id);
    });
  }
  settings(owner) {
    if (!this.user(owner)) throw new AppError(401, 'unauthorized', 'กรุณาเข้าสู่ระบบ');
    const row = this.db.prepare('SELECT data,revision FROM preferences WHERE owner=?').get(owner);
    return { owner, isbnProviders: row ? validateProviders(JSON.parse(row.data).isbnProviders) : [...DEFAULT_PROVIDERS], revision: row?.revision ?? 0 };
  }
  saveSettings(owner, body) {
    if (body?.owner !== owner) throw new AppError(403, 'wrong_owner', 'บัญชีเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่ก่อนบันทึก');
    if (!body || typeof body !== 'object' || Object.keys(body).some(key=>!['owner','isbnProviders','revision'].includes(key)) || !Number.isSafeInteger(body.revision) || body.revision < 0) throw new AppError(400, 'invalid_settings', 'ข้อมูลการตั้งค่าไม่ถูกต้อง');
    let providers;
    try { providers = validateProviders(body.isbnProviders); } catch (error) { throw new AppError(400, 'invalid_settings', error.message); }
    return this.transaction(() => {
      const current = this.settings(owner);
      if (current.revision !== body.revision) throw new AppError(409, 'settings_conflict', 'การตั้งค่าถูกเปลี่ยนจากอีกเครื่อง กรุณาโหลดค่าล่าสุดก่อนบันทึกใหม่', { current });
      const revision = current.revision + 1;
      this.db.prepare('INSERT INTO preferences(owner,data,revision) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET data=excluded.data,revision=excluded.revision').run(owner, JSON.stringify({ isbnProviders:providers }), revision);
      return { owner, isbnProviders:providers, revision };
    });
  }
  session(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
    return this.db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.owner WHERE sessions.token_hash=? AND sessions.expires_at>?').get(sha256(token), Date.now());
  }
  addSession(owner, token, expires) { this.db.prepare('INSERT INTO sessions(token_hash,owner,expires_at) VALUES(?,?,?)').run(sha256(token), owner, expires); this.db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now()); }
  removeSession(token) { if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha256(token)); }
  rateLimit(bucket, limit = 12, windowMs = 15 * 60000) {
    const key = sha256(bucket), now = Date.now();
    this.db.prepare('DELETE FROM rate_limits WHERE expires_at<?').run(now);
    this.db.prepare('INSERT INTO rate_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1').run(key, now + windowMs);
    if (this.db.prepare('SELECT attempts FROM rate_limits WHERE bucket=?').get(key).attempts > limit) throw new AppError(429, 'rate_limited', 'ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่');
  }
  snapshot(owner) {
    const user = this.user(owner);
    if (!user) throw new AppError(401, 'unauthorized', 'กรุณาเข้าสู่ระบบ');
    const records = new Map(), versions = {};
    for (const [kind, table] of Object.entries(tables)) for (const row of this.db.prepare(`SELECT id,data,revision,deleted FROM ${table} WHERE owner=? ORDER BY rowid`).all(owner)) {
      const key = `${kind}:${row.id}`; versions[key] = row.revision;
      if (!row.deleted) records.set(key, JSON.parse(row.data));
    }
    return { state: expandLibrary(records), versions, cursor: user.cursor };
  }
  delta(owner, after) {
    const cursor = this.user(owner).cursor;
    if (!Number.isSafeInteger(after) || after < 0 || after > cursor) throw new AppError(400, 'invalid_cursor', 'ตำแหน่งซิงก์ไม่ถูกต้อง กรุณาโหลดข้อมูลใหม่');
    return { cursor, changes: this.db.prepare('SELECT cursor,entity_key,data FROM changes WHERE owner=? AND cursor>? ORDER BY cursor').all(owner, after).map(row => ({ key: row.entity_key, revision: row.cursor, value: row.data === null ? null : JSON.parse(row.data) })) };
  }
  photo(owner, id) {
    if (!/^[a-f0-9]{64}$/.test(id)) return null;
    const photo = this.db.prepare('SELECT * FROM photos WHERE owner=? AND id=?').get(owner, id);
    if (photo && (!['image/jpeg','image/png','image/webp'].includes(photo.mime) || photo.relative_path !== `photos/${owner}/${id}.${photo.mime === 'image/jpeg' ? 'jpg' : photo.mime.slice(6)}`)) throw new AppError(500, 'invalid_photo', 'ข้อมูลรูปในฐานข้อมูลไม่ถูกต้อง');
    return photo;
  }
  materializePhoto(owner, item) {
    if (!item.coverData) return item;
    const url = item.coverData.match(/^\/api\/photos\/([a-f0-9]{64})$/);
    if (url) { if (!this.photo(owner, url[1])) throw new AppError(400, 'invalid_photo', 'รูปปกไม่อยู่ในบัญชีนี้'); return item; }
    const match = item.coverData.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) throw new AppError(400, 'invalid_photo', 'รูปปกไม่ถูกต้อง');
    const bytes = Buffer.from(match[2], 'base64'), mime = `image/${match[1]}`;
    const valid = match[1] === 'jpeg' ? bytes.subarray(0, 3).equals(Buffer.from([255,216,255])) : match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
    if (!valid || bytes.length > 340000) throw new AppError(400, 'invalid_photo', 'ไฟล์รูปปกไม่ถูกต้องหรือใหญ่เกินไป');
    const id = sha256(Buffer.concat([Buffer.from(owner), bytes])), extension = match[1] === 'jpeg' ? 'jpg' : match[1];
    const relative = `photos/${owner}/${id}.${extension}`, filename = path.join(this.directory, relative);
    mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    if (!existsSync(filename)) writeFileSync(filename, bytes, { flag: 'wx', mode: 0o600 });
    this.db.prepare('INSERT OR IGNORE INTO photos(owner,id,mime,relative_path) VALUES(?,?,?,?)').run(owner, id, mime, relative);
    return { ...item, coverData: `/api/photos/${id}` };
  }
  apply(owner, operation) {
    if (!operation || typeof operation.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(operation.id) || !Array.isArray(operation.changes) || !operation.changes.length || operation.changes.length > 12000) throw new AppError(400, 'invalid_operation', 'รายการซิงก์ไม่ถูกต้อง');
    const requestHash = sha256(stableJSON(operation));
    return this.transaction(() => {
      const previous = this.db.prepare('SELECT request_hash,result FROM operations WHERE owner=? AND id=?').get(owner, operation.id);
      if (previous) {
        if (previous.request_hash !== requestHash) throw new AppError(409, 'operation_reused', 'รหัสการบันทึกนี้ถูกใช้กับข้อมูลอื่นแล้ว');
        return { ...JSON.parse(previous.result), replayed: true };
      }
      const snapshot = this.snapshot(owner), records = flattenLibrary(snapshot.state), seen = new Set(), conflicts = [];
      for (const change of operation.changes) {
        const { id } = parseKey(change.key);
        if (seen.has(change.key) || change.value !== null && (!change.value || typeof change.value !== 'object' || change.value.id !== id)) throw new AppError(400, 'invalid_operation', 'ข้อมูลรายการซิงก์ไม่ตรงกัน');
        seen.add(change.key);
        let base = change.baseRevision;
        if (base && typeof base === 'object') {
          const reference = this.db.prepare('SELECT result FROM operations WHERE owner=? AND id=?').get(owner, base.operationId);
          if (!reference) throw new AppError(409, 'missing_dependency', 'รายการก่อนหน้ายังไม่บันทึก กรุณาตรวจการซิงก์');
          base = JSON.parse(reference.result).versions[change.key];
        }
        if (!Number.isSafeInteger(base) || base < 0) throw new AppError(400, 'invalid_revision', 'เวอร์ชันรายการไม่ถูกต้อง');
        if ((snapshot.versions[change.key] ?? 0) !== base) conflicts.push({ key: change.key, current: records.get(change.key) ?? null, mine: change.value });
        if (change.value === null) records.delete(change.key); else records.set(change.key, change.value);
      }
      for (const change of operation.changes) if (change.key.startsWith('entry:') && change.value && !records.has(`series:${change.value.seriesId}`)) {
        const key = `series:${change.value.seriesId}`;
        if (!conflicts.some(c => c.key === key)) conflicts.push({ key, current: null, mine: null, reason: 'parent_deleted' });
      }
      if (conflicts.length) throw new AppError(409, 'conflict', 'รายการนี้ถูกแก้จากอีกเครื่อง กรุณาเลือกข้อมูลที่จะเก็บ', { conflicts, snapshot });
      try { expandLibrary(records); } catch (error) { throw new AppError(400, 'invalid_library', error.message); }
      const result = { versions: {}, cursor: snapshot.cursor };
      // Keep the same immutable image URL after normalization, and don't log image data in changes.
      for (const change of operation.changes) {
        const { kind, id, table } = parseKey(change.key);
        const old = this.db.prepare(`SELECT * FROM ${table} WHERE owner=? AND id=?`).get(owner, id);
        if (change.value === null && !old) throw new AppError(400, 'invalid_delete', 'ไม่พบรายการที่จะลบ');
        const value = change.value === null ? JSON.parse(old.data) : this.materializePhoto(owner, change.value);
        const revision = ++result.cursor, deleted = change.value === null ? 1 : 0;
        if (kind === 'entry') this.db.prepare('INSERT INTO entries(owner,id,series_id,data,revision,deleted) VALUES(?,?,?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET series_id=excluded.series_id,data=excluded.data,revision=excluded.revision,deleted=excluded.deleted').run(owner, id, value.seriesId, JSON.stringify(value), revision, deleted);
        else this.db.prepare(`INSERT INTO ${table}(owner,id,data,revision,deleted) VALUES(?,?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET data=excluded.data,revision=excluded.revision,deleted=excluded.deleted`).run(owner, id, JSON.stringify(value), revision, deleted);
        this.db.prepare('INSERT INTO changes(owner,cursor,entity_key,data) VALUES(?,?,?,?)').run(owner, revision, change.key, deleted ? null : JSON.stringify(value));
        result.versions[change.key] = revision;
      }
      this.db.prepare('UPDATE users SET cursor=? WHERE id=?').run(result.cursor, owner);
      this.db.prepare('INSERT INTO operations(owner,id,request_hash,result,created_at) VALUES(?,?,?,?,?)').run(owner, operation.id, requestHash, JSON.stringify(result), Date.now());
      return result;
    });
  }
  exportAccount(owner) {
    const { state } = this.snapshot(owner);
    const records = flattenLibrary(state);
    for (const [key, item] of records) if (item.coverData?.startsWith('/api/photos/')) {
      const photo = this.photo(owner, item.coverData.split('/').pop());
      if (!photo) throw new AppError(500, 'missing_photo', 'ไม่พบไฟล์รูปในข้อมูลสำรอง');
      records.set(key, { ...item, coverData: `data:${photo.mime};base64,${readFileSync(path.join(this.directory, photo.relative_path)).toString('base64')}` });
    }
    return expandLibrary(records);
  }
  deleteAccount(owner, expectedHash) {
    this.transaction(() => {
      if (expectedHash && this.user(owner)?.password_hash !== expectedHash) throw new AppError(401, 'credentials_changed', 'ข้อมูลบัญชีเปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่');
      this.db.prepare('DELETE FROM entries WHERE owner=?').run(owner);
      this.db.prepare('DELETE FROM users WHERE id=?').run(owner);
    });
    rmSync(path.join(this.directory, 'photos', owner), { recursive: true, force: true });
  }
  async backupTo(destination) {
    const token = randomUUID();
    this.transaction(() => { this.db.prepare('INSERT INTO maintenance(id,token,expires_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at').run(token, Date.now() + 15 * 60000); });
    const renewal = setInterval(() => {
      try { this.db.prepare('UPDATE maintenance SET expires_at=? WHERE token=?').run(Date.now() + 15 * 60000, token); } catch { /* Verify the lease again before completing. */ }
    }, 30000);
    try {
      await mkdir(destination, { recursive: false, mode: 0o700 });
      const databasePath = path.join(destination, 'library.sqlite');
      await sqliteBackup(this.db, databasePath);
      const files = [];
      for (const photo of this.db.prepare('SELECT * FROM photos ORDER BY owner,id').all()) {
        const source = path.join(this.directory, photo.relative_path), target = path.join(destination, photo.relative_path);
        await mkdir(path.dirname(target), { recursive: true, mode: 0o700 }); await copyFile(source, target);
        files.push({ path: photo.relative_path, sha256: sha256(readFileSync(target)) });
      }
      if (!this.db.prepare('SELECT token FROM maintenance WHERE token=? AND expires_at>?').get(token, Date.now())) throw Error('การสำรองข้อมูลใช้เวลานานจนหมดช่วงล็อก กรุณาสำรองใหม่');
      const manifest = { version: 1, createdAt: new Date().toISOString(), database: { path: 'library.sqlite', sha256: sha256(readFileSync(databasePath)) }, files };
      await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
      return manifest;
    } finally { clearInterval(renewal); this.db.prepare('DELETE FROM maintenance WHERE token=?').run(token); }
  }
}
