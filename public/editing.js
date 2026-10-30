import { entryReadingOptions } from './reading.js';
import { parseTags, targetLabels } from './shelf-tools.js';
import { CATEGORIES, FORMATS, STATUSES, normalizeIsbn, matchingEntries } from './lib.js';
import { photoEditorMarkup, mountPhotoEditor } from './photos.js';

const options = (values, selected) => Object.entries(values).map(([key, value]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${value}</option>`).join('');

export function editSeries({ series, openModal, heading, escape: esc, onSave }) {
  openModal(`${heading('แก้ไขข้อมูลเรื่อง / ฉบับ', series.title)}<div class="notice">ข้อมูลส่วนนี้ใช้ร่วมกันทั้ง ${series.entries.length} รายการในฉบับนี้ หากต้องการแก้เลขเล่มหรือ ISBN ให้ใช้ปุ่มแก้ไขข้างเล่มนั้น</div><form id="edit-series-form"><div class="form-grid"><label class="field full">ชื่อเรื่อง *<input name="title" value="${esc(series.title)}" required maxlength="300"></label><label class="field">ผู้เขียน<input name="author" value="${esc(series.author)}" maxlength="300"></label><label class="field">ชื่อย่อ / ชื่อที่ใช้ค้น<input name="alias" value="${esc(series.alias)}" maxlength="300"></label><label class="field">ประเภท<select name="category">${options(Object.fromEntries(CATEGORIES.map(c => [c,c])), series.category)}</select></label><label class="field">รูปแบบหนังสือ<select name="format">${options(FORMATS, series.format)}</select></label><label class="field">ฉบับ *<input name="edition" value="${esc(series.edition)}" required maxlength="300"></label><label class="field">ภาษา *<input name="language" value="${esc(series.language)}" required maxlength="300"></label><label class="field full">แท็กส่วนตัว (คั่นด้วยจุลภาค)<input name="tags" maxlength="1529" value="${esc((series.tags ?? []).join(', '))}"></label><label class="field full">เลขเล่มเป้าหมาย<input name="target" maxlength="4000" value="${esc((series.target ?? []).join(', '))}" placeholder="เช่น 1-10, ภาคพิเศษ"><small>เว้นว่างหากยังไม่ทราบ ไม่ได้ระบุวันวางขาย</small></label></div><div id="edit-series-confirm" hidden class="notice warning"><label class="checkbox-line"><input id="confirm-format" type="checkbox">ยืนยันเปลี่ยนรูปแบบให้ทุกรายการในฉบับนี้</label><small>ถ้ามีทั้งหนังสือเล่มและ ebook ให้สร้างแยกฉบับแทน</small></div><p id="edit-series-error" class="subtitle" role="alert"></p><div class="form-actions"><button class="button" type="button" id="cancel-edit-series">ยกเลิก</button><button class="button primary" type="submit">บันทึกข้อมูลเรื่อง</button></div></form>`);
  const form = document.querySelector('#edit-series-form');
  form.elements.format.addEventListener('change', () => { document.querySelector('#edit-series-confirm').hidden = form.elements.format.value === series.format || !series.entries.length; document.querySelector('#confirm-format').checked = false; });
  document.querySelector('#cancel-edit-series').addEventListener('click', () => onSave(null));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const patch = {};
    for (const key of ['title','author','alias','category','format','edition','language']) patch[key] = form.elements[key].value.trim();
    if (!patch.title || !patch.edition || !patch.language) { document.querySelector('#edit-series-error').textContent = 'กรอกชื่อเรื่อง ฉบับ และภาษาให้ครบก่อนนะ'; return; }
    if (patch.format !== series.format && series.entries.length && !document.querySelector('#confirm-format').checked) { document.querySelector('#edit-series-error').textContent = 'ยืนยันก่อนเปลี่ยนรูปแบบของทั้งฉบับ'; return; }
    try { patch.tags = parseTags(form.elements.tags.value); patch.target = targetLabels(form.elements.target.value); onSave(patch); } catch (error) { document.querySelector('#edit-series-error').textContent = error.message; }
  });
}

export function editEntry({ state, series, entry, openModal, heading, escape: esc, onSave }) {
  const box = entry.kind === 'box';
  openModal(`${heading(box ? 'แก้ไขข้อมูลบ็อกซ์' : `แก้ไขข้อมูลเล่ม ${entry.label}`, `${series.title} · ${FORMATS[series.format]}`)}<p class="subtitle">แก้เฉพาะรายการนี้ ชื่อเรื่องและข้อมูลฉบับยังใช้ร่วมกันเหมือนเดิม</p><form id="edit-entry-form">${photoEditorMarkup(esc)}<div class="form-grid"><label class="field">${box ? 'ชื่อบ็อกซ์' : 'เลขเล่ม / เล่มพิเศษ'} *<input name="label" value="${esc(entry.label)}" required maxlength="80"></label><label class="field">ISBN ของ${box ? 'บ็อกซ์' : 'เล่มนี้'}<input name="isbn" value="${esc(entry.isbn)}" maxlength="30" placeholder="ไม่มีให้เว้นว่าง"></label><label class="field">สถานะ<select name="status">${options(STATUSES, entry.status)}</select></label><label class="field">${box ? 'การอ่านทั้งบ็อกซ์' : 'สถานะการอ่าน'}<select name="readingStatus">${entryReadingOptions(entry)}</select><small>${box ? 'เปลี่ยนตรงนี้จะใช้สถานะเดียวกันทุกเล่มในบ็อกซ์ แก้ทีละเล่มได้ในหน้ารายละเอียด' : 'แยกจากสถานะมีแล้ว / รอส่ง / อยากซื้อ'}</small></label><label class="field">จำนวนสำเนา / สิทธิ์<input name="quantity" value="${entry.quantity}" type="number" min="1" max="999" required></label><label class="field full">${series.format === 'ebook' ? 'แพลตฟอร์ม ebook' : 'ตำแหน่งเก็บ'}<input name="location" value="${esc(entry.location ?? '')}" maxlength="150"></label>${box ? `<label class="field full">เล่มในบ็อกซ์<input name="members" value="${esc(entry.members.join(', '))}" maxlength="3000"><small>คั่นด้วยจุลภาค เช่น 1, 2, 3, ภาคพิเศษ · เว้นว่างหากยังไม่ทราบ</small></label>` : ''}</div><p id="edit-entry-error" class="subtitle" role="alert"></p><div id="edit-entry-warning" aria-live="polite"></div><div class="form-actions"><button class="button" type="button" id="cancel-edit-entry">ยกเลิก</button><button class="button primary" type="submit">บันทึกข้อมูลเล่ม</button></div></form>`);
  const form = document.querySelector('#edit-entry-form');
  let readingChanged = false; form.elements.readingStatus.addEventListener('change',()=>{readingChanged=true;});
  const getPhoto = mountPhotoEditor(document.querySelector('#modal-content'), entry.coverData ?? '');
  document.querySelector('#cancel-edit-entry').addEventListener('click', () => onSave(null));
  form.addEventListener('input', event => { if (event.target.id !== 'confirm-entry-change') document.querySelector('#edit-entry-warning').replaceChildren(); });
  form.addEventListener('change', event => { if (event.target.id !== 'confirm-entry-change') document.querySelector('#edit-entry-warning').replaceChildren(); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const rawIsbn = form.elements.isbn.value.trim();
      const isbn = rawIsbn ? normalizeIsbn(rawIsbn) : '';
      if (rawIsbn && !isbn) throw Error('ISBN ไม่ถูกต้อง ตรวจเลขหรือเว้นว่างก่อนบันทึก');
      const patch = { readingStatus: readingChanged ? form.elements.readingStatus.value : entry.readingStatus ?? '', label: form.elements.label.value.trim(), isbn, status: form.elements.status.value, quantity: Number(form.elements.quantity.value), location: form.elements.location.value.trim(), coverData: getPhoto() };
      if (!patch.label) throw Error('กรอกเลขเล่มหรือชื่อบ็อกซ์ก่อนนะ');
      if (box) {
        patch.members = [...new Set(form.elements.members.value.split(',').map(s => s.trim()).filter(Boolean))];
        patch.readingByMember = readingChanged ? {} : Object.fromEntries(Object.entries(entry.readingByMember ?? {}).filter(([label])=>patch.members.includes(label)));
        if (patch.members.some(label => label.length > 80)) throw Error('ชื่อเล่มในบ็อกซ์ยาวเกินไป');
      }
      const changedMembers = box && JSON.stringify(patch.members) !== JSON.stringify(entry.members);
      const identityChanged = patch.label !== entry.label || (isbn || '') !== (normalizeIsbn(entry.isbn) || '') || changedMembers;
      const others = series.entries.filter(e => e.id !== entry.id);
      const duplicates = identityChanged && (matchingEntries({ ...series, entries: others }, { ...entry, ...patch }).length ||
        box && others.some(e => (e.kind === 'box' ? e.members : [e.label]).some(label => patch.members.includes(label))) ||
        isbn && state.series.some(s => s.entries.some(e => e.id !== entry.id && normalizeIsbn(e.isbn) === isbn)));
      if ((duplicates || changedMembers) && !document.querySelector('#confirm-entry-change')?.checked) {
        document.querySelector('#edit-entry-warning').innerHTML = `<div class="notice warning">${duplicates ? 'ข้อมูลที่แก้อาจซ้ำกับเล่มหรือบ็อกซ์ที่บันทึกไว้ ' : ''}${changedMembers ? 'การเปลี่ยนสมาชิกบ็อกซ์มีผลต่อการเช็กเล่มที่มีแล้ว ' : ''}<label class="checkbox-line"><input id="confirm-entry-change" type="checkbox">ฉันตรวจแล้วและยืนยันการเปลี่ยนแปลง</label></div>`;
        return;
      }
      onSave(patch);
    } catch (error) { document.querySelector('#edit-entry-error').textContent = error.message; }
  });
}
