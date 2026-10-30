import { readingOptions, readingSummaryText, matchesReading } from './reading.js';
import { FORMATS, STATUSES } from './lib.js';
import { bulkPatch } from './shelf-tools.js';
export function openBulkEdit({ state, seriesIds, statusFilter, locationFilter, readingFilter, openModal, heading, escape: esc, onSave, isCurrent = () => true }) {
  const series = state.series.filter(s => seriesIds.has(s.id));
  let selected = new Set(series.flatMap(s => s.entries.filter(e => (statusFilter === 'all' || e.status === statusFilter) && (!locationFilter || (e.location ?? '').trim() === locationFilter) && matchesReading(e,readingFilter)).map(e => e.id)));
  const options = values => Object.entries(values).map(([k,v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  const draw = () => {
    if (!isCurrent()) return;
    openModal(`${heading('แก้หลายรายการ', 'เลือกเล่มที่ต้องการ แล้วตรวจผลก่อนยืนยัน')}<form id="bulk-form">
      <div class="bulk-selection"><button type="button" class="button" id="bulk-all">เลือกทุกรายการที่แสดง</button><button type="button" class="button" id="bulk-none">ล้างที่เลือก</button></div>
      ${series.map(s => `<fieldset class="bulk-group"><legend>${esc(s.title)} · ${esc(s.edition)} · ${esc(FORMATS[s.format])}</legend>${s.entries.map(e => `<label class="bulk-entry"><input type="checkbox" name="entry" value="${esc(e.id)}" ${selected.has(e.id)?'checked':''}><span>${e.kind === 'box' ? esc(e.label) : `เล่ม ${esc(e.label)}`}<small>${esc(STATUSES[e.status])} · ${esc(e.location || 'ยังไม่ระบุที่เก็บ')}${e.kind === 'box' ? ` · ทั้งบ็อกซ์: ${e.members.map(esc).join(', ')}` : ''}</small></span></label>`).join('')}</fieldset>`).join('')}
      <div class="form-grid"><label class="field">สถานะใหม่<select name="status"><option value="">ไม่เปลี่ยน</option>${options(STATUSES)}</select></label>
      <label class="field">การอ่านใหม่<select name="readingStatus"><option value="keep">ไม่เปลี่ยน</option>${readingOptions()}</select></label><label class="field">ที่เก็บ / แพลตฟอร์ม<input name="location" maxlength="150" disabled></label><label class="checkbox-line full"><input type="checkbox" name="changeLocation">เปลี่ยนที่เก็บ (เว้นว่างเพื่อล้าง)</label>
      <label class="field">แก้แท็กของฉบับ<select name="tagMode"><option value="">ไม่เปลี่ยน</option><option value="add">เพิ่มแท็ก</option><option value="remove">ลบแท็กที่ระบุ</option><option value="replace">แทนที่แท็กทั้งหมด</option></select></label><label class="field">แท็ก คั่นด้วยจุลภาค<input name="tags" maxlength="1529" placeholder="ฉบับสะสม, งานหนังสือ"></label></div>
      <p class="subtitle">แท็กใช้กับทั้งเรื่อง / ฉบับที่มีเล่มถูกเลือก สถานะและที่เก็บเปลี่ยนเฉพาะรายการที่เลือก การอ่านของบ็อกซ์เปลี่ยนทุกเล่มข้างในด้วยเมื่อเลือกแก้ ไม่สร้างเล่มเดี่ยวซ้ำ</p>
      <p id="bulk-error" role="alert"></p><div class="form-actions"><button type="button" class="button" data-close>ยกเลิก</button><button class="button primary" type="submit">ตรวจการเปลี่ยนแปลง</button></div></form>`);
    const form = document.querySelector('#bulk-form');
    form.elements.readingStatus.value = 'keep';
    form.elements.changeLocation.onchange = () => { form.elements.location.disabled = !form.elements.changeLocation.checked; };
    document.querySelector('#bulk-all').onclick = () => { form.querySelectorAll('[name=entry]').forEach(e => e.checked = true); };
    document.querySelector('#bulk-none').onclick = () => { form.querySelectorAll('[name=entry]').forEach(e => e.checked = false); };
    form.onsubmit = event => {
      event.preventDefault();
      try {
        selected = new Set([...form.querySelectorAll('[name=entry]:checked')].map(e => e.value));
        const patch = {};
        if (form.elements.readingStatus.value !== 'keep') patch.readingStatus = form.elements.readingStatus.value;
        if (form.elements.status.value) patch.status = form.elements.status.value;
        if (form.elements.changeLocation.checked) patch.location = form.elements.location.value.trim();
        if (form.elements.tagMode.value) { patch.tagMode = form.elements.tagMode.value; patch.tags = form.elements.tags.value; }
        if (!Object.keys(patch).length) throw Error('เลือกข้อมูลที่ต้องการเปลี่ยนก่อนนะ');
        const before = structuredClone(state), next = structuredClone(state); bulkPatch(next, [...selected], patch);
        const edits = next.series.flatMap(s => {
          const old = before.series.find(v => v.id === s.id);
          return s.entries.filter(e => selected.has(e.id)).map(e => {
            const prior = old.entries.find(v => v.id === e.id);
            return `<li>${esc(s.title)} · ${esc(FORMATS[s.format])} · ${e.kind === 'box' ? 'บ็อกซ์ ' : 'เล่ม '}${esc(e.label)}${patch.status !== undefined ? ` · ${esc(STATUSES[prior.status])} → ${esc(STATUSES[e.status])}` : ''}${patch.readingStatus !== undefined ? ` · การอ่าน: ${esc(readingSummaryText({entries:[prior]}))} → ${esc(readingSummaryText({entries:[e]}))}` : ''}${patch.location !== undefined ? ` · ${esc(prior.location || 'ไม่ระบุ')} → ${esc(e.location || 'ไม่ระบุ')}` : ''}</li>`;
          });
        });
        openModal(`${heading('ตรวจการเปลี่ยนแปลง', `${selected.size} รายการ · จำนวนสำเนา ISBN และสมาชิกบ็อกซ์คงเดิม`)}<ul class="bulk-preview">${edits.join('')}</ul>${patch.tagMode ? `<div class="notice">แท็กของทั้งฉบับ: ${next.series.filter(s => s.entries.some(e => selected.has(e.id))).map(s => `${esc(s.title)}: ${s.tags.map(esc).join(', ') || 'ไม่มีแท็ก'}`).join('<br>')}</div>` : ''}<p role="alert" id="bulk-error"></p><div class="form-actions"><button type="button" class="button" id="bulk-back">กลับไปเลือกใหม่</button><button type="button" class="button primary" id="bulk-confirm">ยืนยันแก้ ${selected.size} รายการ</button></div>`);
        document.querySelector('#bulk-back').onclick = draw;
        document.querySelector('#bulk-confirm').onclick = async event => {
          const button = event.currentTarget; button.disabled = true;
          try { await onSave([...selected], patch); } catch (error) { document.querySelector('#bulk-error').textContent = error.message; }
          finally { button.disabled = false; }
        };
      } catch (error) { document.querySelector('#bulk-error').textContent = error.message; }
    };
  };
  draw();
}
