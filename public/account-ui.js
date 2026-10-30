import { api } from './account-store.js';
import { flattenLibrary } from './sync-core.js';

export function authView({ signup = false, user = null, pending = 0, escape: esc }) {
  return `<section class="auth-layout"><div class="auth-story"><p class="eyebrow">A HOME FOR YOUR STORIES</p><h1>ชั้นเล็ก ๆ ของเรา<br>ไปด้วยกันทุกเครื่อง</h1><p>รวมหนังสือเล่มกับ ebook ไว้ด้วยกัน<br>เช็กให้ชัวร์ ก่อนพาเล่มใหม่กลับบ้าน</p><div class="auth-books" aria-hidden="true"><span>☾</span><span>❧</span><span>♡</span></div></div><div class="panel auth-card"><h2>${signup ? 'สร้างชั้นหนังสือของเธอ' : 'ยินดีต้อนรับกลับมานะ'}</h2><p>${signup ? 'เริ่มบัญชีใหม่ ชั้นหนังสือจะเป็นส่วนตัว' : 'เข้าสู่ระบบเพื่อเปิดชั้นหนังสือของเรา'}</p><form id="auth-form"><div class="form-grid">${signup ? '<label class="field full">ชื่อที่แสดง<input name="name" maxlength="80" required autocomplete="nickname"></label>' : ''}<label class="field full">อีเมล<input name="email" type="email" value="${esc(user?.email ?? '')}" maxlength="254" required autocomplete="username"></label><label class="field full">รหัสผ่าน<input name="password" type="password" minlength="${signup ? 10 : 1}" maxlength="256" required autocomplete="${signup ? 'new-password' : 'current-password'}"></label>${signup ? '<small class="field full">ใช้รหัสผ่านอย่างน้อย 10 ตัวอักษร</small>' : ''}</div><p id="auth-error" class="subtitle" role="alert"></p><div class="form-actions"><button class="button primary" type="submit">${signup ? 'สมัครบัญชี' : 'เข้าสู่ระบบ'}</button></div></form><p class="auth-switch">${signup ? 'มีบัญชีอยู่แล้ว?' : 'เพิ่งเริ่มใช้?'} <button class="text-button" data-auth-mode="${signup ? 'login' : 'register'}">${signup ? 'เข้าสู่ระบบ' : 'สมัครบัญชี'}</button></p>${pending ? `<div class="notice warning">ยังมีงานรอซิงก์ ${pending} รายการของ ${esc(user?.email)} ในเครื่องนี้ กรุณาเข้าใช้บัญชีเดิมเพื่อส่งต่อ</div>` : ''}<small>ข้อมูลจะเก็บบนเซิร์ฟเวอร์ที่เธอใช้งาน ไม่ได้แชร์ชั้นเป็นสาธารณะ</small></div></section>`;
}

export function accountSettings(store, esc) {
  return `<section class="panel"><div class="account-settings-heading"><span class="avatar">☺</span><div><h2>${esc(store.user.name)}</h2><p>${esc(store.user.email)}</p></div></div><p>ชั้นหนังสือส่วนตัวของบัญชีนี้ เปิดด้วยบัญชีเดียวกันบนมือถือหรือคอมได้</p><div class="actions"><button class="button" id="sync-now">ซิงก์ตอนนี้</button><button class="button" id="change-password">เปลี่ยนรหัสผ่าน</button><button class="button" id="logout">ออกจากระบบ</button></div><p>สถานะ: ${esc(store.status)}${store.cache.lastSynced ? `<br>ซิงก์ล่าสุด ${esc(new Date(store.cache.lastSynced).toLocaleString('th-TH'))}` : ''}${store.error ? `<br>${esc(store.error)}` : ''}</p>${store.pending ? '<p>งานรอซิงก์ยังไม่ใช่ข้อมูลสำรองบนเซิร์ฟเวอร์ ส่งออกข้อมูลเก็บไว้ได้ก่อนออกจากระบบ</p>' : ''}${store.cache.conflict ? '<button class="button" id="resolve-conflict">ตรวจข้อมูลที่ชนกัน</button>' : ''}${store.pending && store.error ? '<button class="button" id="reset-from-server">กู้ข้อมูลจากเซิร์ฟเวอร์</button>' : ''}${store.needsReload ? '<button class="button" id="reload-app">โหลดหน้าใหม่</button>' : ''}</section>`;
}

const describe = (record, esc) => record === null || record === undefined ? '<p>รายการถูกลบหรือยังไม่มี</p>' : `<dl>${Object.entries(record).filter(([key]) => ['title','author','label','isbn','status','quantity','location','format','edition','language','members'].includes(key)).map(([key, value]) => `<div><dt>${esc(({ title:'ชื่อเรื่อง', author:'ผู้เขียน', label:'เล่ม', isbn:'ISBN', status:'สถานะ', quantity:'จำนวน', location:'ที่เก็บ', format:'รูปแบบ', edition:'ฉบับ', language:'ภาษา', members:'เล่มในบ็อกซ์' })[key])}</dt><dd>${esc(Array.isArray(value) ? value.join(', ') : value)}</dd></div>`).join('')}</dl>`;

export function openConflict({ store, openModal, heading, escape: esc, notify }) {
  const conflict = store.cache.conflict; if (!conflict) return;
  const local = flattenLibrary(store.state);
  openModal(`${heading('ข้อมูลจากสองเครื่องไม่ตรงกัน', 'เลือกข้อมูลที่จะเก็บก่อนซิงก์ ไม่เขียนทับอัตโนมัติ')}<p class="subtitle">ข้อมูลฝั่งเครื่องนี้รวมการแก้ที่ยังรอส่ง หากเลือกข้อมูลบนเซิร์ฟเวอร์ การแก้ในเครื่องของรายการนั้นจะถูกละทิ้ง กรณีลบเรื่อง เล่มที่อ้างถึงเรื่องนั้นจะถูกละทิ้งด้วย</p><form id="conflict-form">${conflict.conflicts.map((item, i) => `<section class="conflict-item"><h3>${esc(local.get(item.key)?.title ?? local.get(item.key)?.label ?? item.key)}</h3><div class="conflict-columns"><div><strong>บนเซิร์ฟเวอร์</strong>${describe(item.current, esc)}</div><div><strong>ในเครื่องนี้</strong>${describe(local.get(item.key) ?? null, esc)}</div></div><label class="checkbox-line"><input type="checkbox" name="keep-${i}">เก็บข้อมูลในเครื่องนี้สำหรับรายการนี้</label></section>`).join('')}<p class="subtitle" id="conflict-error" role="alert"></p><div class="form-actions"><button class="button" type="button" id="export-conflict">ส่งออกข้อมูลในเครื่องก่อน</button><button class="button primary" type="submit">ใช้ข้อมูลที่เลือกแล้วซิงก์</button></div></form>`);
  document.querySelector('#conflict-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.target.querySelector('[type=submit]'); button.disabled = true;
    try {
      const keys = new Set(conflict.conflicts.filter((_, i) => event.target.elements[`keep-${i}`].checked).map(item => item.key));
      await store.resolveConflict(keys); document.querySelector('#modal').close(); notify('ตรวจข้อมูลแล้ว กำลังส่งการเปลี่ยนแปลงที่เลือก');
    } catch (error) { document.querySelector('#conflict-error').textContent = error.message; } finally { button.disabled = false; }
  });
}

export function openPasswordChange({ openModal, heading }) {
  openModal(`${heading('เปลี่ยนรหัสผ่าน', 'เครื่องอื่นจะต้องเข้าสู่ระบบใหม่หลังเปลี่ยน')}<form id="password-form"><div class="form-grid"><label class="field full">รหัสผ่านปัจจุบัน<input name="currentPassword" type="password" required maxlength="256" autocomplete="current-password"></label><label class="field full">รหัสผ่านใหม่<input name="password" type="password" required minlength="10" maxlength="256" autocomplete="new-password"></label></div><p id="password-error" class="subtitle" role="alert"></p><div class="form-actions"><button class="button" type="button" data-close>ยกเลิก</button><button class="button primary" type="submit">เปลี่ยนรหัสผ่าน</button></div></form>`);
  document.querySelector('#password-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.target.querySelector('[type=submit]'); button.disabled = true;
    try { await api('/api/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword: event.target.elements.currentPassword.value, password: event.target.elements.password.value }) }); document.querySelector('#modal').close(); }
    catch (error) { document.querySelector('#password-error').textContent = error.message; } finally { button.disabled = false; }
  });
}

export async function portableExport(state) {
  const result = structuredClone(state);
  for (const series of result.series) for (const item of [series, ...series.entries]) if (item.coverData?.startsWith('/api/photos/')) item.coverData = await imageData(item.coverData);
  for (const item of result.drafts) if (item.coverData?.startsWith('/api/photos/')) item.coverData = await imageData(item.coverData);
  return result;
}
async function imageData(url) {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw Error('ยังโหลดรูปปกไม่ครบ กรุณาต่ออินเทอร์เน็ตแล้วส่งออกอีกครั้ง');
  const blob = await response.blob();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
}
