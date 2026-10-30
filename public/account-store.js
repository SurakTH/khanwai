import { newId } from './ids.js';
import { validateState } from './lib.js';
import { emptyLibrary, flattenLibrary, expandLibrary, recordDiff, overlayRecords } from './sync-core.js';

const DB_NAME = 'khanwai-accounts-v1';
const LAST_USER = 'khanwai-last-user-v1';
const requestResult = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
export async function openCache() {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore('accounts');
  return requestResult(request);
}
export async function cacheRead(db, key) { return requestResult(db.transaction('accounts').objectStore('accounts').get(key)); }
export async function cacheWrite(db, key, value, expected) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('accounts', 'readwrite');
    const table = transaction.objectStore('accounts');
    const request = table.get(key);
    let reason;
    request.onsuccess = () => {
      if (expected !== undefined && (request.result?.generation ?? 0) !== expected) { reason = Error('ข้อมูลเปลี่ยนจากแท็บอื่น โปรดโหลดหน้าใหม่ก่อนแก้ต่อ'); reason.code = 'local_changed'; transaction.abort(); return; }
      if (value === null) table.delete(key); else table.put(value, key);
    };
    transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(reason ?? transaction.error ?? Error('บันทึกข้อมูลในเครื่องไม่สำเร็จ'));
  });
}
export class ApiError extends Error {
  constructor(status, body) { super(body.message ?? 'ติดต่อเซิร์ฟเวอร์ไม่สำเร็จ'); this.status = status; Object.assign(this, body); }
}
export async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json', 'X-Book-Request': '1' } : {}), ...options.headers } });
  let data;
  try { data = await response.json(); } catch { throw new ApiError(response.status, { message: 'เซิร์ฟเวอร์ส่งข้อมูลที่อ่านไม่ได้' }); }
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

export class AccountStore {
  constructor(onChange) {
    this.onChange = onChange; this.user = null; this.cache = null; this.online = false; this.needsLogin = false;
    this.status = 'กำลังเปิดข้อมูล'; this.busy = false; this.lock = Promise.resolve(); this.error = '';
  }
  exclusive(fn) { const next = this.lock.then(fn); this.lock = next.catch(() => {}); return next; }
  changed(content = false) { this.onChange?.(content); }
  get state() { return this.cache?.state ?? emptyLibrary(); }
  get pending() { return this.cache?.outbox.length ?? 0; }
  async boot() {
    this.db = await openCache();
    let last;
    try { last = JSON.parse(localStorage.getItem(LAST_USER) ?? 'null'); } catch { /* recover through login */ }
    try {
      const { user } = await api('/api/auth/me'); await this.loadUser(user); this.online = true;
      await this.sync();
    } catch (error) {
      if ((!(error instanceof ApiError) || error.status >= 500) && last?.id) {
        const cache = await cacheRead(this.db, last.id);
        if (cache) { validateState(cache.state); this.user = last; this.cache = cache; this.online = false; this.status = 'ออฟไลน์ · ข้อมูลที่เคยโหลด'; this.error = error.message; await this.photoAccount(); this.changed(true); return; }
      }
      this.needsLogin = true; this.status = 'กรุณาเข้าสู่ระบบ'; this.changed(true);
      if (!(error instanceof ApiError)) this.error = 'ติดต่อเซิร์ฟเวอร์ไม่ได้ และยังไม่มีชั้นที่เคยโหลดไว้';
    }
  }
  async forgetCurrent() {
    const owner = this.user?.id;
    if (owner) { await cacheWrite(this.db, owner, null); await this.photoAccount(null, owner); }
    localStorage.removeItem(LAST_USER); this.user = null; this.cache = null; this.needsLogin = true; this.changed(true);
  }
  async loadUser(user) {
    const cached = await cacheRead(this.db, user.id);
    if (cached) validateState(cached.state);
    this.user = user; this.cache = cached ?? { state: emptyLibrary(), versions: {}, cursor: 0, outbox: [], lastSynced: null, conflict: null };
    this.needsLogin = false; this.needsReload = false; this.error = ''; localStorage.setItem(LAST_USER, JSON.stringify(user));
    await this.photoAccount(); this.changed(true);
  }
  async login(mode, values) {
    const { user } = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(values) });
    await this.loadUser(user); this.online = true; await this.sync();
    return user;
  }
  async saveCache(next) {
    const expected = this.cache?.generation ?? 0;
    const updated = { ...next, generation: expected + 1 };
    try { await cacheWrite(this.db, this.user.id, updated, expected); this.cache = updated; }
    catch (error) { if (error.code === 'local_changed') { this.needsReload = true; this.status = error.message; this.changed(); } throw error; }
  }
  captureBases() {
    const result = { ...this.cache.versions };
    for (const operation of this.cache.outbox) for (const change of operation.changes) result[change.key] = { operationId: operation.id };
    return result;
  }
  async mutate(fn, bases) {
    return this.exclusive(async () => {
      if (!this.user || this.needsLogin) throw Error('กรุณาเข้าสู่ระบบก่อนบันทึก');
      if (this.needsReload) throw Error('ข้อมูลเปลี่ยนจากแท็บอื่น โปรดโหลดหน้าใหม่ก่อนแก้ต่อ');
      if (this.cache.conflict) throw Error('กรุณาตรวจข้อมูลที่ชนกันก่อนแก้รายการต่อ');
      const state = structuredClone(this.state); fn(state); validateState(state);
      const changes = recordDiff(this.state, state);
      if (!changes.length) return true;
      const references = bases ?? this.captureBases();
      const operation = { id: newId(), changes: changes.map(change => ({ ...change, baseRevision: references[change.key] ?? 0 })) };
      await this.saveCache({ ...this.cache, state, outbox: [...this.cache.outbox, operation] });
      this.status = `รอซิงก์ ${this.pending} รายการ`; this.changed();
      queueMicrotask(() => this.sync()); return true;
    });
  }
  async integrate(snapshot) {
    const keys = new Set(this.cache.outbox.flatMap(op => op.changes.map(change => change.key)));
    const state = overlayRecords(snapshot.state, this.state, keys);
    await this.saveCache({ ...this.cache, state, versions: snapshot.versions, cursor: snapshot.cursor, lastSynced: new Date().toISOString() });
  }
  async sync() {
    if (this.syncing) return this.syncing;
    this.syncing = this.performSync();
    try { return await this.syncing; }
    finally {
      this.syncing = null;
      if (this.pending && this.online && !this.error && !this.needsLogin && !this.needsReload && !this.cache?.conflict) queueMicrotask(() => this.sync());
    }
  }
  async performSync() {
    if (!this.user || this.needsLogin || this.needsReload || this.busy || this.cache.conflict) return;
    if (!navigator.onLine) { this.online = false; this.status = this.pending ? `ออฟไลน์ · รอซิงก์ ${this.pending} รายการ` : 'ออฟไลน์ · ข้อมูลที่เคยโหลด'; this.changed(); return; }
    this.busy = true; this.status = 'กำลังซิงก์…'; this.changed();
    try {
      while (this.cache.outbox.length) {
        const operation = this.cache.outbox[0];
        try { await api('/api/sync', { method: 'POST', body: JSON.stringify(operation) }); }
        catch (error) {
          if (error.status === 409 && error.error === 'conflict') {
            await this.exclusive(async () => { await this.saveCache({ ...this.cache, conflict: error.details }); });
            this.status = 'มีข้อมูลชนกัน · กรุณาตรวจ'; this.changed(true); return;
          }
          throw error;
        }
        await this.exclusive(async () => {
          const snapshot = await api('/api/library');
          const next = { ...this.cache, outbox: this.cache.outbox.filter(op => op.id !== operation.id) };
          await this.saveCache(next); await this.integrate(snapshot);
        });
      }
      await this.exclusive(async () => {
        let delta;
        try { delta = await api(`/api/sync?after=${this.cache.cursor}`); }
        catch (error) {
          if (error.error !== 'invalid_cursor') throw error;
          await this.integrate(await api('/api/library')); this.changed(true); return;
        }
        if (delta.changes.length) {
          const remote = flattenLibrary(this.state), versions = { ...this.cache.versions };
          for (const change of delta.changes) { if (change.value === null) remote.delete(change.key); else remote.set(change.key, change.value); versions[change.key] = change.revision; }
          await this.integrate({ state: expandLibrary(remote), versions, cursor: delta.cursor }); this.changed(true);
        } else if (!this.cache.lastSynced) {
          const snapshot = await api('/api/library'); await this.integrate(snapshot); this.changed(true);
        }
      });
      this.online = true; this.status = this.pending ? `รอซิงก์ ${this.pending} รายการ` : 'บันทึกบนเซิร์ฟเวอร์แล้ว'; this.error = '';
    } catch (error) {
      if (error.status === 401) { this.needsLogin = true; this.status = 'เซสชันหมดอายุ · เข้าสู่ระบบใหม่'; this.changed(true); }
      else { this.online = false; this.status = this.pending ? `ซิงก์ไม่สำเร็จ · รอส่ง ${this.pending} รายการ` : 'ติดต่อเซิร์ฟเวอร์ไม่ได้'; this.error = error.message; }
    } finally { this.busy = false; this.changed(); }
  }
  async resolveConflict(keepLocalKeys) {
    await this.exclusive(async () => {
      const snapshot = await api('/api/library');
      const touched = new Set(this.cache.outbox.flatMap(op => op.changes.map(change => change.key)));
      for (const conflict of this.cache.conflict.conflicts) { if (keepLocalKeys.has(conflict.key)) touched.add(conflict.key); else touched.delete(conflict.key); }
      const merged = overlayRecords(snapshot.state, this.state, touched);
      const changes = recordDiff(snapshot.state, merged);
      const outbox = changes.length ? [{ id: newId(), changes: changes.map(change => ({ ...change, baseRevision: snapshot.versions[change.key] ?? 0 })) }] : [];
      await this.saveCache({ ...this.cache, state: merged, versions: snapshot.versions, cursor: snapshot.cursor, conflict: null, outbox }); this.changed(true);
    });
    await this.sync();
  }
  async resetFromServer() {
    if (this.syncing) await this.syncing;
    await this.exclusive(async () => {
      if (!this.user || this.needsLogin) throw Error('กรุณาเข้าสู่ระบบก่อนโหลดข้อมูล');
      const snapshot = await api('/api/library');
      await this.saveCache({ ...this.cache, state: snapshot.state, versions: snapshot.versions, cursor: snapshot.cursor, outbox: [], conflict: null, lastSynced: new Date().toISOString() });
      this.online = true; this.error = ''; this.status = 'บันทึกบนเซิร์ฟเวอร์แล้ว'; this.changed(true);
    });
  }
  async logout({ discard = false } = {}) {
    if (this.busy) throw Error('รอการซิงก์ให้เสร็จก่อนออกจากระบบ');
    if (this.pending && !discard) throw Error('ยังมีรายการรอซิงก์ กรุณาซิงก์หรือยืนยันละทิ้งก่อน');
    await api('/api/auth/logout', { method: 'POST', body: '{}' });
    const owner = this.user.id;
    try { await cacheWrite(this.db, owner, null, this.cache.generation ?? 0); }
    catch (error) { this.needsLogin = true; this.status = 'ออกจากระบบแล้ว · ยังเก็บงานที่เปลี่ยนจากอีกแท็บไว้ กรุณาเข้าสู่ระบบใหม่'; this.changed(true); throw error; }
    await this.photoAccount(null, owner);
    localStorage.removeItem(LAST_USER); this.user = null; this.cache = null; this.needsLogin = true; this.changed(true);
  }
  async photoAccount(owner = this.user?.id ?? null, clear = null) {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const worker = navigator.serviceWorker.controller ?? registration?.active;
    if (!worker) return;
    await new Promise(resolve => { const channel = new MessageChannel(); channel.port1.onmessage = resolve; worker.postMessage({ type: 'ACCOUNT', owner, clear }, [channel.port2]); setTimeout(resolve, 1500); });
  }
}
