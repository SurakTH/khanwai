import { categoryList, categoryUsage, categoryKey, changeCategory } from './categories.js';

export function categorySettingsMarkup(state, esc) {
  const names = categoryList(state);
  return `<section class="panel"><h2>หมวดหมู่หนังสือ</h2><p>เลือกหมวดให้ตรงกับชั้นของเธอ เพิ่ม เปลี่ยนชื่อ หรือลดหมวดได้</p><p class="subtitle category-summary">${names.map(esc).join(' · ')}</p><button class="button" id="manage-categories">จัดการหมวดหมู่</button></section>`;
}

export function openCategoryManager({ getState, openModal, heading, escape: esc, onSave, checkOwner }) {
  const usageText = name => { const usage = categoryUsage(getState(), name); return `${usage.series} เรื่อง / ฉบับ · ${usage.drafts} รายการรอตรวจ`; };
  const actions = `<div class="form-actions"><button type="button" class="button" data-category-back>กลับ</button><button type="submit" class="button primary">บันทึกหมวดหมู่</button></div>`;
  function bind(command) {
    document.querySelector('[data-category-back]')?.addEventListener('click', list);
    document.querySelector('#category-form').addEventListener('submit', async event => {
      event.preventDefault(); const form = event.target, button = form.querySelector('[type=submit]'); button.disabled = true;
      try {
        checkOwner();
        const change = { ...command, value: form.elements.categoryName?.value, target: form.elements.categoryTarget?.value };
        changeCategory(structuredClone(getState()), change);
        const saved = await onSave(change);
        if (!saved && form.isConnected) form.querySelector('[role=alert]').textContent = 'ยังบันทึกไม่ได้ กรุณาตรวจข้อความแจ้งเตือนแล้วลองอีกครั้ง';
      } catch (error) { if (form.isConnected) form.querySelector('[role=alert]').textContent = error.message; }
      finally { button.disabled = false; }
    });
  }
  function edit(name, deleting) {
    checkOwner();
    const names = categoryList(getState()), usage = categoryUsage(getState(), name), used = usage.series || usage.drafts;
    openModal(`${heading(deleting ? 'ลบหมวดหมู่' : 'เปลี่ยนชื่อหมวดหมู่', name)}<p class="subtitle">${usageText(name)}</p><form id="category-form">${deleting ? `<div class="notice">${used ? 'หนังสือและรายการรอตรวจจะย้ายไปหมวดที่เลือก ข้อมูลเล่มและสถานะยังอยู่ครบ' : 'หมวดนี้ยังไม่มีหนังสือหรือรายการรอตรวจ ลบได้โดยไม่กระทบข้อมูลเล่ม'}</div>${used ? `<label class="field">ย้ายไปหมวดหมู่<select name="categoryTarget" required><option value="">เลือกหมวดหมู่ปลายทาง</option>${names.filter(n => categoryKey(n) !== categoryKey(name)).map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select></label>` : ''}` : `<label class="field">ชื่อหมวดหมู่<input name="categoryName" value="${esc(name)}" required maxlength="300"></label><p class="subtitle">เปลี่ยนชื่อให้หนังสือและรายการรอตรวจในหมวดนี้ด้วย</p>`}<p role="alert" class="category-error"></p>${actions}</form>`);
    bind({ action: deleting ? 'delete' : 'rename', name });
  }
  function list() {
    checkOwner(); const names = categoryList(getState());
    openModal(`${heading('จัดการหมวดหมู่', 'หมวดหมู่ของบัญชีนี้ ใช้ร่วมกันบนมือถือและคอม')}<div class="category-list">${names.map((name, index) => `<div class="category-row"><div><strong>${esc(name)}</strong><small>${usageText(name)}</small></div><div class="category-actions"><button class="button" data-category-edit="${index}">เปลี่ยนชื่อ</button><button class="button danger" data-category-delete="${index}" ${names.length === 1 ? 'disabled title="ต้องเหลืออย่างน้อย 1 หมวด"' : ''}>ลบ</button></div></div>`).join('')}</div><form id="category-form"><label class="field">เพิ่มหมวดหมู่<input name="categoryName" placeholder="เช่น การ์ตูนวาย" required maxlength="300"></label><p role="alert" class="category-error"></p><div class="form-actions"><button class="button" type="button" data-close>ปิด</button><button class="button primary" type="submit">เพิ่มหมวดหมู่</button></div></form>`);
    for (const button of document.querySelectorAll('[data-category-edit]')) button.addEventListener('click', () => edit(names[Number(button.dataset.categoryEdit)], false));
    for (const button of document.querySelectorAll('[data-category-delete]')) button.addEventListener('click', () => edit(names[Number(button.dataset.categoryDelete)], true));
    bind({ action: 'add' });
  }
  list();
}
