import { activeLibrary, trashItems } from './trash.js';
import { matchingEntries, normalizeIsbn, FORMATS, STATUSES } from './lib.js';
import { readingSummaryText } from './reading.js';

const titleOf = item => item.series?.title || item.record.title || 'ยังไม่ทราบชื่อเรื่อง';
const detailsOf = item => item.kind === 'series' ? `ทั้งฉบับ · ${item.record.entries.filter(e=>!e.trashedAt).length} รายการ` : item.kind === 'entry' ? `${item.record.kind === 'box' ? 'บ็อกซ์' : 'เล่ม'} ${item.record.label}` : 'รายการรอตรวจ';
export function trashSettingsMarkup(state, esc) {
  return `<section class="panel"><h2>ถังขยะและกู้คืน</h2><p>รายการที่ย้ายออกจากชั้นหรือถาดรอตรวจยังเก็บไว้ในบัญชี กู้คืนได้พร้อมข้อมูล รูปปก และสถานะเดิม ไม่มีการลบอัตโนมัติ</p><p class="subtitle">${esc(trashItems(state).length)} รายการในถังขยะ</p><button class="button" id="open-trash">เปิดถังขยะ</button></section>`;
}
export function restoreWarnings(state,kind,id) {
  const item = trashItems(state).find(item=>item.kind===kind&&item.id===id);
  if (!item) throw Error('รายการเปลี่ยนไปแล้ว กรุณาเปิดถังขยะใหม่');
  const active = activeLibrary(state);
  if (kind === 'draft') return item.record.isbn && active.drafts.some(d=>normalizeIsbn(d.isbn)===normalizeIsbn(item.record.isbn)) ? ['มี ISBN นี้ในถาดรอตรวจแล้ว'] : [];
  const entries = kind === 'series' ? item.record.entries.filter(e=>!e.trashedAt) : [item.record];
  const sameEdition = s => s.format===item.series.format && s.edition===item.series.edition && s.language===item.series.language && s.title.normalize('NFKC').trim().toLocaleLowerCase('th')===item.series.title.normalize('NFKC').trim().toLocaleLowerCase('th');
  return entries.filter(entry=>active.series.some(series=>series.format===item.series.format && series.entries.some(e=>entry.isbn && normalizeIsbn(entry.isbn)===normalizeIsbn(e.isbn))) || active.series.some(series=>sameEdition(series) && (matchingEntries(series,entry).length || entry.kind==='box' && series.entries.some(e=>(e.kind==='box'?e.members:[e.label]).some(label=>entry.members.includes(label)))))).map(entry=>`เล่ม ${entry.label} อาจซ้ำกับข้อมูลบนชั้น`);
}
export function openTrash({getState,openModal,heading,escape:esc,checkOwner,onRestore}) {
  function review(kind,id) {
    checkOwner();
    const item = trashItems(getState()).find(item=>item.kind===kind&&item.id===id);
    if (!item) return list();
    const warnings = restoreWarnings(getState(),kind,id), entries = kind==='series' ? item.record.entries.filter(e=>!e.trashedAt) : kind==='entry' ? [item.record] : [];
    openModal(`${heading('ตรวจรายการก่อนกู้คืน',titleOf(item))}<p>${esc(detailsOf(item))}</p>${item.series?`<p class="subtitle">${esc(item.series.edition)} · ${esc(FORMATS[item.series.format])}</p>`:''}<p class="subtitle">กู้คืนข้อมูลเดิม พร้อมรูปปกและสถานะการอ่านเดิม</p>${entries.length?`<ul class="trash-preview">${entries.map(e=>`<li>เล่ม ${esc(e.label)} · ${esc(STATUSES[e.status])} · ${esc(readingSummaryText({entries:[e]}))}${e.kind==='box'?` · รวมเล่ม ${e.members.map(esc).join(', ')}`:''}${e.readingByMember&&Object.keys(e.readingByMember).length?' · เก็บสถานะการอ่านแยกรายเล่มไว้':''}</li>`).join('')}</ul>`:''}<form id="restore-form">${warnings.length?`<div class="notice warning">${warnings.slice(0,10).map(esc).join('<br>')}</div><label class="checkbox-line"><input name="confirmDuplicate" type="checkbox" required>ฉันตรวจรายการที่อาจซ้ำแล้ว และต้องการกู้คืน</label>`:''}<p role="alert" id="trash-error" class="subtitle"></p><div class="form-actions"><button type="button" class="button" id="trash-back">กลับถังขยะ</button><button type="submit" class="button primary">ยืนยันกู้คืน</button></div></form>`);
    document.querySelector('#trash-back').onclick=list;
    document.querySelector('#restore-form').onsubmit=async event=>{
      event.preventDefault();const form=event.target, button=form.querySelector('[type=submit]');button.disabled=true;
      try {checkOwner();await onRestore(kind,id,Boolean(form.elements.confirmDuplicate?.checked));}
      catch(error){if(form.isConnected)document.querySelector('#trash-error').textContent=error.message;}
      finally{button.disabled=false;}
    };
  }
  function list() {
    checkOwner();
    openModal(`${heading('ถังขยะ', 'เก็บไว้ในบัญชีจนกู้คืน ไม่มีการลบอัตโนมัติ')}<label class="field">ค้นหาในถังขยะ<input id="trash-search" type="search" placeholder="ชื่อเรื่อง เลขเล่ม หรือ ISBN"></label><p id="trash-count" role="status" class="subtitle"></p><div id="trash-list"></div>`);
    function results() {
      const query=document.querySelector('#trash-search').value.trim().toLocaleLowerCase('th');
      const items=trashItems(getState()).filter(item=>[titleOf(item),item.record.label,item.record.isbn,...(item.record.entries??[]).flatMap(e=>[e.label,e.isbn])].join(' ').toLocaleLowerCase('th').includes(query));
      document.querySelector('#trash-count').textContent=`${items.length} รายการ`;
      document.querySelector('#trash-list').innerHTML=items.map(item=>{
        const image=item.record.coverData||item.series?.coverData||item.series?.entries.find(e=>e.coverData)?.coverData;
        return `<article class="trash-row">${image?`<img src="${esc(image)}" alt="ปก ${esc(titleOf(item))}" loading="lazy">`:'<span class="trash-cover" aria-hidden="true">▥</span>'}<div><h3>${esc(titleOf(item))}</h3><p>${esc(detailsOf(item))}</p><small>ย้ายเมื่อ ${esc(new Intl.DateTimeFormat('th-TH',{dateStyle:'medium'}).format(new Date(item.date)))}</small></div><button class="button" data-restore-kind="${item.kind}" data-restore-id="${esc(item.id)}">ตรวจและกู้คืน</button></article>`;
      }).join('')||'<p class="notice">ยังไม่มีรายการในถังขยะที่ตรงกับคำค้น</p>';
      for(const button of document.querySelectorAll('[data-restore-id]'))button.onclick=()=>review(button.dataset.restoreKind,button.dataset.restoreId);
    }
    document.querySelector('#trash-search').oninput=results; results();
  }
  list();
}
