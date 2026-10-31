import { STATUSES, FORMATS, coverage } from './lib.js';
import { readingItems, readingOptions, entryReadingOptions, readingSummaryText } from './reading.js';

// Presentation only: entries keep their existing IDs, ownership and reading mutations.
function entryCard(series, entry, esc) {
  const sid=esc(series.id), id=esc(entry.id), label=esc(entry.label), box=entry.kind==='box';
  return `<article class="detail-entry" data-detail-entry="${id}" aria-label="${box?label:`เล่ม ${label}`}">
    <div class="entry-row">
      <div class="entry-identity">${entry.coverData?`<img class="entry-cover" src="${esc(entry.coverData)}" alt="ปกเล่ม ${label}">`:`<div class="entry-number ${box?'entry-number-box':''}" aria-hidden="true">${box?'<span>BOX</span>':`<span>เล่ม</span><strong>${label}</strong>`}</div>`}
        <div class="entry-info"><h4>${box?label:`เล่ม ${label}`}</h4><p class="entry-facts">${entry.quantity} สำเนา${entry.location?`<span> · </span>${esc(entry.location)}`:''}</p>${box?`<p class="entry-members">รวมเล่ม ${entry.members.map(esc).join(', ')}</p>`:''}${entry.isbn?`<p class="entry-isbn">ISBN <span>${esc(entry.isbn)}</span></p>`:''}</div>
      </div>
      <div class="entry-states"><label class="entry-ownership">การครอบครอง<select data-entry-status="${id}" data-series="${sid}" aria-label="สถานะ ${label}">${Object.entries(STATUSES).map(([key,value])=>`<option value="${key}" ${entry.status===key?'selected':''}>${value}</option>`).join('')}</select></label><label class="entry-reading">${box?'การอ่านทั้งบ็อกซ์':'การอ่าน'}<select data-entry-reading="${id}" data-series="${sid}" aria-label="การอ่าน ${box?'ทั้งบ็อกซ์ ':'เล่ม '}${label}">${entryReadingOptions(entry)}</select></label></div>
      <details class="entry-actions" data-entry-actions="${id}"><summary aria-label="จัดการ ${box?label:`เล่ม ${label}`}"><span aria-hidden="true">•••</span></summary><div class="entry-action-list"><button type="button" data-edit-entry="${id}" data-series="${sid}" aria-label="แก้ไขข้อมูล ${label}">แก้ไขข้อมูล</button><button type="button" data-edit-photo="${id}" data-series="${sid}">รูปปก</button><button type="button" class="entry-delete" data-delete-entry="${id}" data-series="${sid}" aria-label="ลบรายการ ${label}">ลบรายการ</button></div></details>
    </div>
    ${box&&entry.members.length?`<details class="box-reading" data-box-reading="${id}"><summary>การอ่านแต่ละเล่มใน ${label}</summary><div class="box-reading-members">${readingItems(entry).map(item=>`<label class="box-reading-row">เล่ม ${esc(item.label)}<select data-entry-reading="${id}" data-reading-member="${esc(item.label)}" data-series="${sid}" aria-label="การอ่านเล่ม ${esc(item.label)} ในบ็อกซ์ ${label}">${readingOptions(item.status)}</select></label>`).join('')}</div></details>`:''}
  </article>`;
}

export function detailMarkup(series, {esc,cover,heading}) {
  const s=series, owned=coverage(s), ordered=coverage(s,'ordered');
  const labels=[...new Set([...(s.target??[]),...owned,...ordered,...coverage(s,'wishlist')])].sort((a,b)=>a.localeCompare(b,'th',{numeric:true}));
  const readingStates=new Set(s.entries.flatMap(readingItems).map(item=>item.status));
  return `<div class="book-detail">${heading('รายละเอียดบนชั้น',s.sample?'ข้อมูลตัวอย่าง · ชื่อและผู้เขียนสมมติ':'ข้อมูลที่บันทึกในบัญชีนี้')}
    <div class="detail-top">${cover(s)}<div><span class="category-label">${esc(s.category)}</span><h2>${esc(s.title)}</h2><p class="detail-meta">${esc(s.author||'ยังไม่ระบุผู้เขียน')}</p><p class="detail-edition">${esc(s.edition)} · ${esc(s.language)} · ${esc(FORMATS[s.format])}</p>${s.alias?`<p class="detail-meta">ค้นด้วยชื่อย่อ: ${esc(s.alias)}</p>`:''}${s.tags?.length?`<p class="shelf-tags">แท็ก: ${s.tags.map(esc).join(', ')}</p>`:''}</div></div>
    <div class="detail-toolbar"><button type="button" class="button" data-edit-series="${esc(s.id)}">แก้ไขข้อมูลเรื่อง / ฉบับ</button><button type="button" class="button" data-edit-series-photo="${esc(s.id)}">เปลี่ยนภาพปกของชุด</button><button type="button" class="button danger" data-trash-series="${esc(s.id)}">ย้ายทั้งฉบับไปถังขยะ</button></div>
    <section class="series-reading" aria-label="การอ่านของชุดนี้"><div class="series-reading-copy"><h3>การอ่านของชุดนี้</h3><p class="reading-summary">${esc(readingSummaryText(s))}</p></div><div class="series-reading-actions" role="group" aria-label="เปลี่ยนการอ่านทั้งชุด">${[['read','อ่านแล้ว'],['unread','ยังไม่อ่าน'],['planned','อยากอ่าน']].map(([value,label])=>`<button type="button" class="button" data-reading-series="${esc(s.id)}" data-series-reading="${value}" aria-pressed="${readingStates.size===1&&readingStates.has(value)}" ${s.entries.length?'':'disabled'}>${label}</button>`).join('')}</div><p class="series-reading-note">เปลี่ยนทุกเล่มที่บันทึกในฉบับนี้ รวมเล่มในบ็อกซ์</p></section>
    <section class="detail-volumes" aria-label="เล่มในฉบับนี้"><div class="detail-entries-heading"><div><h3 class="detail-section-title">เล่มในฉบับนี้</h3><p>${s.entries.length} รายการที่บันทึกไว้</p></div><button type="button" class="button primary" data-add-to="${esc(s.id)}" aria-label="+ เพิ่มเล่มในฉบับนี้"><span aria-hidden="true">+</span> เพิ่มเล่ม</button></div>
      ${labels.length?`<div class="detail-coverage"><div class="volumes">${labels.map(label=>`<span class="volume-chip ${owned.includes(label)?'':ordered.includes(label)?'ordered':'missing'}" title="${owned.includes(label)?'มีแล้ว':ordered.includes(label)?'รอส่ง':'ยังไม่มีในชั้น'}">${esc(label)}</span>`).join('')}</div><div class="volume-legend"><span><i class="legend-owned" aria-hidden="true"></i>มีแล้ว</span><span><i class="legend-ordered" aria-hidden="true"></i>รอส่ง</span><span><i class="legend-missing" aria-hidden="true"></i>ยังไม่มี</span></div><p class="coverage-note">${s.target?.length?'เลขเป้าหมายตามที่ระบุไว้ ไม่ได้อัปเดตวันวางขายอัตโนมัติ':'ยังไม่ได้กำหนดชุดเป้าหมาย แสดงเฉพาะเล่มที่บันทึกไว้'}</p></div>`:''}
      <div class="detail-entry-list">${s.entries.map(entry=>entryCard(s,entry,esc)).join('')||'<p class="detail-no-entries">ยังไม่มีเล่มในฉบับนี้ เริ่มเพิ่มเล่มแรกได้เลย</p>'}</div>
    </section></div>`;
}
