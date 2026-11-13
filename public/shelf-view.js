import { categoryList } from './categories.js';
import { FORMATS, STATUSES, coverage } from './lib.js';
import { READING_STATUSES } from './reading.js';
import { SHELF_ORDERS } from './shelf-sort.js';

const icons = {
  grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
  filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--white)"/><circle cx="16" cy="12" r="2" fill="var(--white)"/><circle cx="8" cy="18" r="2" fill="var(--white)"/></svg>',
};

// Page-only presentation. Library state, filtering and mutations stay in their existing modules.
export function shelfCounts(state) {
  const owned = format => state.series
    .filter(s => s.format === format)
    .reduce((n, s) => n + s.entries.filter(e => e.status === 'owned').reduce((sum, e) => sum + e.quantity * (e.kind === 'box' ? e.members.length : 1), 0), 0);
  return {
    physical: owned('physical'),
    ebook: owned('ebook'),
    ordered: state.series.reduce((n, s) => n + coverage(s, 'ordered').length, 0),
    wishlist: state.series.reduce((n, s) => n + coverage(s, 'wishlist').length, 0),
  };
}

const SMART = {
  incomplete: 'ชุดที่ยังเก็บไม่ครบ',
  'no-cover': 'ยังไม่มีรูปปก',
  'no-location': 'ยังไม่ระบุที่เก็บ',
};

export function shelfFilterItems({ category, bookFormat, smartFilter, locationFilter, tagFilter, readingFilter }) {
  return [
    category !== 'all' && ['category', category],
    bookFormat !== 'all' && ['format', FORMATS[bookFormat]],
    smartFilter !== 'all' && ['smart', SMART[smartFilter]],
    locationFilter && ['location', locationFilter],
    tagFilter && ['tag', `#${tagFilter}`],
    readingFilter && ['reading', READING_STATUSES[readingFilter]],
  ].filter(Boolean);
}

export function shelfPageMarkup(p, esc) {
  const { state, query, filter, category, bookFormat, smartFilter, locationFilter, tagFilter, readingFilter, shelfOrder, shelfView, selectionMode, filtersOpen } = p;
  const counts = shelfCounts(state);
  const active = shelfFilterItems(p);
  const options = (values, selected, all) => `<option value="all">${all}</option>${Object.entries(values).map(([k, v]) => `<option value="${esc(k)}" ${k === selected ? 'selected' : ''}>${esc(v)}</option>`).join('')}`;
  const values = (items, selected, all) => `<option value="">${all}</option>${[...new Set([...items, ...(selected ? [selected] : [])])].sort((a, b) => a.localeCompare(b, 'th')).map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('')}`;

  return `<div class="page-heading shelf-heading">
    <div class="shelf-heading-copy">
      <h1>ชั้นหนังสือ</h1>
      <p class="shelf-census"><strong>${state.series.length}</strong> เรื่อง / ฉบับ<span aria-hidden="true"> · </span>มีแล้ว ${counts.physical} เล่ม<span aria-hidden="true"> · </span>ebook ${counts.ebook}</p>
    </div>
    <div class="heading-actions">
      <button type="button" class="button primary" data-add><span class="plus" aria-hidden="true">+</span> เพิ่มหนังสือ</button>
    </div>
  </div>
  <section class="shelf-controls" aria-label="ค้นหาและกรองชั้นหนังสือ">
    <div class="shelf-search">
      <div class="search-wrap">
        <span aria-hidden="true"></span>
        <input id="search" aria-label="ค้นหาหนังสือ" placeholder="ค้นชื่อเรื่อง ผู้เขียน หรือ ISBN" value="${esc(query)}" autocomplete="off">
        <button type="button" id="clear-search" aria-label="ล้างคำค้น" ${query ? '' : 'hidden'}>×</button>
      </div>
    </div>
    <details class="shelf-filters" id="shelf-filters" ${filtersOpen ? 'open' : ''}>
      <summary><span class="shelf-filter-icon" aria-hidden="true">${icons.filter}</span> กรอง<span id="shelf-filter-count" ${active.length ? '' : 'hidden'}>${active.length}</span></summary>
      <div class="shelf-filter-panel">
        <div class="shelf-filter-heading">
          <div>
            <h2>เลือกหนังสือที่อยากดู</h2>
            <p>เลือกใช้ร่วมกันได้ แล้วกดดูผลลัพธ์</p>
          </div>
          <button type="button" class="button ghost" id="close-shelf-filters" aria-label="ปิดตัวกรอง">×</button>
        </div>
        <div class="form-grid">
          <label class="field">ประเภทหนังสือ<select id="category">${options(Object.fromEntries(categoryList(state).map(c => [c, c])), category, 'ทุกประเภท')}</select></label>
          <label class="field">รูปแบบหนังสือ<select id="format-filter" aria-label="กรองรูปแบบหนังสือ">${options(FORMATS, bookFormat, 'ทุกรูปแบบ')}</select></label>
          <label class="field">สถานะการอ่าน<select id="shelf-reading" aria-label="กรองสถานะการอ่าน"><option value="">ทุกสถานะการอ่าน</option>${Object.entries(READING_STATUSES).map(([k, v]) => `<option value="${k}" ${readingFilter === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="field">แสดงเฉพาะ<select id="shelf-smart">${options(SMART, smartFilter, 'ทั้งหมด')}</select></label>
          <label class="field">ที่เก็บ / แพลตฟอร์ม<select id="shelf-location">${values(state.series.flatMap(s => s.entries.map(e => e.location?.trim()).filter(Boolean)), locationFilter, 'ทุกที่เก็บ')}</select></label>
          <label class="field">แท็กส่วนตัว<select id="shelf-tag">${values(state.series.flatMap(s => s.tags ?? []), tagFilter, 'ทุกแท็ก')}</select></label>
        </div>
        <p class="shelf-filter-note">ชุดที่ยังเก็บไม่ครบอิงเลขเป้าหมายที่กำหนดไว้ แยกเล่มรอส่งจากเล่มที่ยังไม่ได้ซื้อ</p>
        <div class="shelf-filter-footer">
          <button type="button" class="button" id="clear-shelf-filters">ล้างตัวกรองทั้งหมด</button>
          <button type="button" class="button primary" id="apply-shelf-filters">ดูผลลัพธ์</button>
        </div>
      </div>
    </details>
    <div id="shelf-active-filters" class="shelf-active-filters" ${active.length ? '' : 'hidden'}></div>
    <div class="shelf-status-row">
      <div class="tabs shelf-status" role="group" aria-label="กรองสถานะ">
        ${[['all', 'ทั้งหมด'], ...Object.entries(STATUSES)].map(([id, title]) => `<button type="button" class="tab ${filter === id ? 'active' : ''}" data-filter="${id}" aria-pressed="${filter === id}">${title}${id === 'ordered' && counts.ordered ? `<span>${counts.ordered}</span>` : id === 'wishlist' && counts.wishlist ? `<span>${counts.wishlist}</span>` : ''}</button>`).join('')}
      </div>
    </div>
  </section>
  <div class="shelf-results-bar">
    <p id="shelf-result-count" role="status" tabindex="-1"></p>
    <div class="shelf-display-tools">
      <div class="shelf-views" role="group" aria-label="มุมมองชั้น">
        <button type="button" class="button" data-shelf-view="covers" aria-pressed="${shelfView === 'covers'}" aria-label="ปก">${icons.grid}</button>
        <button type="button" class="button" data-shelf-view="list" aria-pressed="${shelfView === 'list'}" aria-label="รายการย่อ">${icons.list}</button>
      </div>
      <label class="shelf-order"><span class="shelf-visually-hidden">เรียงตาม</span><select id="shelf-order" aria-label="เรียงตาม">${Object.entries(SHELF_ORDERS).map(([k, v]) => `<option value="${k}" ${shelfOrder === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <details class="shelf-manage"><summary aria-label="จัดการชั้นหนังสือ">•••</summary><div><button type="button" id="random-unread">สุ่มเรื่องที่ยังไม่อ่าน</button><button type="button" id="open-trash">ถังขยะ / กู้คืน</button><button type="button" id="shelf-select">${selectionMode ? 'เลิกเลือก' : 'เลือกหลายรายการ'}</button></div></details>
    </div>
  </div>
  <div id="selection-bar" class="selection-bar" ${selectionMode ? '' : 'hidden'}>
    <span id="selection-count" role="status"></span>
    <button type="button" class="button" id="select-visible">เลือกทั้งหมดที่แสดง</button>
    <button type="button" class="button" id="clear-selection">ล้างที่เลือก</button>
    <button type="button" class="button primary" id="bulk-edit">ตรวจและแก้รายการที่เลือก</button>
    <button type="button" class="button" id="exit-shelf-selection">เลิกเลือก</button>
  </div>
  <div id="results"></div>`;
}
