import { activeLibrary, moveToTrash, restoreFromTrash, trashItems } from './trash.js';
import { unreadCandidates, pickUnread } from './unread-picker.js';
import { openTrash, trashSettingsMarkup, restoreWarnings } from './trash-ui.js';
import { openCategoryManager, categorySettingsMarkup } from './category-ui.js';
import { changeCategory } from './categories.js';
import { categoryList, categoryOptions, categoryKey } from './categories.js';
import { detailMarkup } from './detail-view.js';
import { shelfPageMarkup, shelfFilterItems } from './shelf-view.js';
import { readingOptions, readingItems, readingSummaryText, setReading, setSeriesReading } from './reading.js';
import { collectionSummary, filterShelf, bulkPatch, parseTags, targetLabels, shelfVolumeCounts, linkedEditions, changeEditionGroup } from './shelf-tools.js';
import { openBulkEdit } from './bulk-edit.js';
import { openCsvImport } from './csv-ui.js';
import { planCsv, csvFingerprint } from './csv-import.js';
import { SHELF_ORDERS, sortShelf, stampShelfChanges } from './shelf-sort.js';
import { newId } from './ids.js';
import { lookupSettingsMarkup, mountLookupSettings } from './lookup-settings.js';
import { STATUSES, FORMATS, coverage, matchingEntries, normalizeIsbn, searchLibrary, seedState, validateState, migrateState } from './lib.js';
import { photoEditorMarkup, mountPhotoEditor } from './photos.js';
import { openBatchForm, seriesTitleFromCandidate } from './workshop.js';
import { editSeries, editEntry } from './editing.js';
import { scanControls, decodeBarcodeFile } from './barcode.js';
import { AccountStore, api } from './account-store.js';
import { emptyLibrary, mergeImport } from './sync-core.js';
import { authView, accountSettings, openConflict, openPasswordChange, portableExport } from './account-ui.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const KEY = 'khanwai-prototype-v1';
const tagText = value => Array.isArray(value) ? value.join(', ') : String(value ?? '');
let state = emptyLibrary(), storageError = '', page = 'shelf', query = '', filter = 'all', category = 'all', bookFormat = 'all', draftId = null, lookupController;
let shelfOrder = 'newest', shelfOrderOwner, shelfView = 'covers', smartFilter = 'all', locationFilter = '', tagFilter = '', readingFilter = '', selectionMode = false;
const selectedSeries = new Set();
let pendingInstall, checkLabel = '', getReviewPhoto;
let scanTarget = null, scanGeneration = 0;
let modalBases, authMode = 'login', modalOwner, refreshAfterModal = false;
export const account = new AccountStore(content => {
  state = activeLibrary(account.state); connection();
  if (content && $('#modal').open) refreshAfterModal = true;
  if (account.needsLogin || !account.user || content && !$('#modal').open) renderPreservingFocus();
});
async function persist(next) {
  validateState(next);
  return mutate(current => { current.series = next.series; current.drafts = next.drafts; if(next.categories !== undefined) current.categories = next.categories; });
}
async function mutate(fn) {
  try { const result = await account.mutate(current => { const before = structuredClone(current); fn(current); stampShelfChanges(before, current); }, $('#modal').open ? modalBases : undefined); state = activeLibrary(account.state); return result; }
  catch (error) { notify(error.message || 'บันทึกในเครื่องไม่สำเร็จ กรุณาตรวจพื้นที่เก็บข้อมูล'); return false; }
}
function renderPreservingFocus() {
  const element = document.activeElement, id = element?.id;
  const selection = typeof element?.selectionStart === 'number' ? [element.selectionStart, element.selectionEnd] : null;
  render();
  if (id && document.getElementById(id)) { document.getElementById(id).focus(); if (selection) document.getElementById(id).setSelectionRange?.(...selection); }
}
function renderAuth() {
  $('#main').classList.remove('shelf-page');
  document.body.classList.add('auth-gated');
  const content = authView({ signup: authMode === 'register', user: account.user, pending: account.pending, escape: esc });
  if ($('#modal').open) {
    modalOwner = modalOwner ?? account.user?.id;
    $('#auth-modal-content').innerHTML = content;
    if (!$('#auth-modal').open) $('#auth-modal').showModal();
  } else $('#main').innerHTML = content;
  $('#auth-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.target, button = form.querySelector('[type=submit]'); button.disabled = true;
    try {
      const values = { email: form.elements.email.value, password: form.elements.password.value, name: form.elements.name?.value };
      await account.login(authMode, values);
      if (modalOwner && modalOwner !== account.user.id) $('#modal').close();
      modalOwner = undefined;
      if ($('#auth-modal').open) $('#auth-modal').close();
      render();
    } catch (error) { if (form.isConnected) $('#auth-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
}
function settingsView() {
  return accountSettings(account, esc) + categorySettingsMarkup(state, esc) + trashSettingsMarkup(account.state, esc) + lookupSettingsMarkup() + `<section class="panel"><h2>สำรองและนำเข้าข้อมูล</h2><p>ส่งออกหนังสือ สถานะ ถาดรอตรวจ ถังขยะ และรูปปกเป็นไฟล์ JSON เก็บไว้นอกเครื่องเซิร์ฟเวอร์ได้ การส่งออกรวมงานที่ยังรอซิงก์ด้วย</p><div class="actions"><button class="button primary" id="export">ส่งออกข้อมูล JSON</button><button class="button" id="import">นำเข้าข้อมูลสำรอง</button><button class="button" id="import-csv">นำเข้าจาก CSV</button></div></section>${localStorage.getItem(KEY) ? '<section class="panel"><h2>ข้อมูลจากต้นแบบในเครื่องนี้</h2><p>ข้อมูลเดิมยังอยู่และยังไม่ถูกนำเข้าบัญชีอัตโนมัติ ตรวจรายการก่อนนำเข้าได้</p><div class="actions"><button class="button" id="import-legacy">ตรวจและนำเข้าข้อมูลเดิม</button><button class="button" id="export-legacy">ดาวน์โหลดไฟล์เดิม</button></div></section>' : ''}<section class="panel"><h2>ติดตั้งและใช้ออฟไลน์</h2><p>หลังโหลดชั้นและรูปแล้ว เปิดดูและเพิ่มรายการได้ตอนออฟไลน์ งานรอส่งอยู่ในเครื่องจนกว่าเซิร์ฟเวอร์จะยืนยัน</p><button class="button" id="install">วิธีติดตั้ง PWA</button><p id="install-help" class="install-help"></p></section><section class="panel"><h2>ข้อมูลตัวอย่าง</h2><p>ชื่อและปกตัวอย่างเป็นเรื่องสมมติ เลือกโหลดมาลองได้ และลบตัวอย่างออกภายหลังได้</p><div class="actions">${state.series.length ? '<button class="button danger" id="clear-samples">ลบข้อมูลตัวอย่าง</button>' : '<button class="button" id="load-samples">โหลดหนังสือตัวอย่าง</button>'}</div></section><section class="panel"><h2>จัดการบัญชี</h2><p>ลบบัญชีจะลบชั้นและรูปบนเซิร์ฟเวอร์ของบัญชีนี้ กรุณาส่งออกข้อมูลก่อนหากต้องการเก็บไว้</p><button class="button danger" id="delete-account">ลบบัญชีและข้อมูล</button></section>`;
}
async function exportCurrent() {
  try { const state = await portableExport(account.state); download(JSON.stringify(state, null, 2), 'khanwai-backup.json'); }
  catch (error) { notify(error.message); }
}
function previewImport(imported) {
  const merged = mergeImport(account.state, imported);
  openModal(`${modalHeading('ตรวจข้อมูลก่อนนำเข้า')}<p>พบ ${imported.series.length} เรื่อง / ฉบับ และ ${imported.drafts.length} รายการรอตรวจ</p><div class="notice">เพิ่มเฉพาะรายการใหม่ได้ ${merged.added} รายการ · ข้ามรายการซ้ำ/ขัดแย้ง ${merged.skipped} รายการ โดยเก็บข้อมูลปัจจุบันไว้</div><label class="checkbox-line"><input id="replace-import" type="checkbox">แทนที่ข้อมูลทั้งชั้นและถังขยะ รวมรายการที่มีอยู่แล้ว</label><p class="subtitle">ถ้าเลือกแทนที่ ข้อมูลปัจจุบันรวมถังขยะจะถูกแทนที่ด้วยไฟล์นี้ โปรดส่งออกสำรองก่อน</p><div class="form-actions"><button class="button" data-close>ยกเลิก</button><button class="button primary" id="confirm-import">ยืนยันนำเข้าข้อมูล</button></div>`);
  $('#confirm-import').addEventListener('click', async () => {
    const replacing = $('#replace-import').checked;
    if (await persist(replacing ? {...imported, categories: categoryList(imported)} : merged.state)) { $('#modal').close(); render(); notify('นำเข้าข้อมูลแล้ว · รอเซิร์ฟเวอร์ยืนยันการซิงก์'); }
  });
}
function openDeleteAccount() {
  if (account.pending) { notify('ยังมีงานรอซิงก์ กรุณาซิงก์หรือส่งออกข้อมูลก่อนลบบัญชี'); return; }
  openModal(`${modalHeading('ลบบัญชีและข้อมูล', account.user.email)}<div class="notice warning">จะลบชั้นหนังสือ ถาดรอตรวจ และรูปของบัญชีนี้จากเซิร์ฟเวอร์ รวมถึงออกจากระบบทุกเครื่อง ไฟล์ที่เคยส่งออกและ backup ของผู้ดูแลจะยังอยู่ตามอายุที่กำหนด</div><form id="delete-account-form"><label class="field">รหัสผ่านปัจจุบัน<input name="password" type="password" required maxlength="256" autocomplete="current-password"></label><label class="checkbox-line"><input type="checkbox" required>ฉันส่งออกข้อมูลที่ต้องการเก็บแล้ว และยืนยันลบบัญชี</label><p id="delete-account-error" class="subtitle" role="alert"></p><div class="form-actions"><button class="button" type="button" data-close>ยกเลิก</button><button class="button danger" type="submit">ยืนยันลบบัญชี</button></div></form>`);
  $('#delete-account-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.target.querySelector('[type=submit]'); button.disabled = true;
    try { await api('/api/account', { method: 'DELETE', body: JSON.stringify({ password: event.target.elements.password.value }) }); $('#modal').close(); await account.forgetCurrent(); }
    catch (error) { if ($('#delete-account-error')) $('#delete-account-error').textContent = error.message; } finally { button.disabled = false; }
  });
}
function notify(text) { $('#toast').textContent = text; $('#toast').classList.add('visible'); clearTimeout(notify.timer); notify.timer = setTimeout(() => $('#toast').classList.remove('visible'), 5500); }
const badge = (status, text) => `<span class="badge ${status}">${esc(text ?? STATUSES[status])}</span>`;
const names = { shelf: 'ชั้นหนังสือ', check: 'เช็กก่อนซื้อ', drafts: 'ถาดรอตรวจ', settings: 'ข้อมูลและการตั้งค่า' };
const formatOptions = selected => Object.entries(FORMATS).map(([key, label]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${label}</option>`).join('');
function cover(s) {
  const image = s.coverData || s.entries.find(e => e.coverData)?.coverData;
  if (image) return `<div class="cover uploaded-cover"><img src="${esc(image)}" alt="ปก ${esc(s.title)}" loading="lazy"></div>`;
  const art = ['moon', 'garden', 'mountain', 'letter', 'cat', 'flower'].includes(s.art) ? s.art : 'plain';
  const symbols = { moon: '☾', garden: '❧', mountain: '△', letter: '✉', cat: '♧', flower: '✿', plain: '❧' };
  return `<div class="cover ${art}" aria-hidden="true"><span class="cover-title">${esc(s.title)}</span><span class="cover-ornament">${symbols[art]}</span><span class="cover-author">${esc(s.author || 'บันทึกเล่มโปรด')}</span></div>`;
}
function countVolumes(rows) {
  const counts = { physical: 0, ebook: 0 };
  let boxes = 0;
  for (const { series, volumes, unknownBoxes } of rows) {
    counts[series.format] += volumes;
    boxes += unknownBoxes;
  }
  return { ...counts, total: counts.physical + counts.ebook, boxes };
}

function volumeCountText({ total, physical, ebook, boxes }) {
  return `${total} เล่ม (หนังสือเล่ม ${physical} · ebook ${ebook})${boxes ? ` · บ็อกซ์ไม่ระบุเล่ม ${boxes} บ็อกซ์` : ''}`;
}

function card(s, group = []) {
  const grouped = Boolean(s.groupId) && !selectionMode;
  const formats = [...new Set(group.map(row => FORMATS[row.series.format]))].join(' + ');
  const formatLabel = grouped ? formats : FORMATS[s.format];
  const owned = coverage(s), ordered = coverage(s, 'ordered');
  const summary = collectionSummary(s);
  const short = labels => labels.slice(0,12).map(esc).join(', ') + (labels.length > 12 ? ` และอีก ${labels.length-12} เล่ม` : '');
  const locations = [...new Set(s.entries.map(e => e.location?.trim()).filter(Boolean))];
  return `<button class="book-card" ${grouped ? `data-open-group="${esc(s.id)}"` : `data-detail="${esc(s.id)}"`} ${selectionMode?`aria-pressed="${selectedSeries.has(s.id)}"`:''}><div class="cover-stage">${s.sample ? '<span class="sample-flag">เรื่องสมมติ</span>' : ''}${cover(s)}</div><div class="card-meta"><span class="category-label">${esc(formatLabel)} · ${esc(s.category)} · ${esc(s.language)}</span><h3>${esc(s.title)}</h3><p>${esc(s.author || 'ยังไม่ระบุผู้เขียน')}</p>${grouped ? `<p class="card-status">${esc(volumeCountText(countVolumes(group)))}</p>` : `<div class="card-status">${owned.length ? badge('owned', `มีแล้ว ${owned.length}`) : ''}${ordered.length ? badge('ordered', `รอส่ง ${ordered.length}`) : ''}${!owned.length && !ordered.length ? badge('wishlist') : ''}${s.entries.some(e => e.kind === 'box') ? badge('neutral', 'มีบ็อกซ์') : ''}</div><p class="reading-summary ${s.entries.some(e=>readingItems(e).some(item=>item.status!=='unread'))?'':'reading-quiet'}">การอ่าน: ${esc(readingSummaryText(s))}</p><div class="list-summary"><p>มี ${short(summary.owned) || 'ยังไม่มี'}${summary.ordered.length ? ` · รอส่ง ${short(summary.ordered)}` : ''}</p><p>${summary.target.length ? summary.missing.length ? `ยังไม่ได้ซื้อ: ${short(summary.missing)} (ตามเป้าหมายที่ตั้งไว้)` : summary.incomplete ? 'รอรับให้ครบตามเป้าหมาย' : 'ครบตามเป้าหมายที่ตั้งไว้' : 'ยังไม่กำหนดเลขเป้าหมาย'}</p><p>ที่เก็บ / แพลตฟอร์ม: ${locations.slice(0,3).map(esc).join(', ') || 'ยังไม่ระบุ'}</p></div>`}${s.tags?.length ? `<p class="shelf-tags">${s.tags.slice(0,4).map(t=>`<span>#${esc(t)}</span>`).join(' ')}${s.tags.length>4?' …':''}</p>` : ''}</div></button>`;
}
function updateSelectionBar() {
  if ($('#selection-count')) $('#selection-count').textContent = `เลือก ${selectedSeries.size} เรื่อง / ฉบับ`;
  if ($('#bulk-edit')) $('#bulk-edit').disabled = selectedSeries.size === 0;
  document.querySelectorAll('.shelf-tile').forEach(tile=>{const card=tile.querySelector('[data-detail]');if(!card)return;const selected=selectedSeries.has(card.dataset.detail);tile.classList.toggle('is-selected',selected);const input=tile.querySelector('[data-select-series]');if(input)input.checked=selected;if(selectionMode)card.setAttribute('aria-pressed',String(selected));});
}
function collectionContext() {
  const owner = account.user.id, bases = account.captureBases();
  const isCurrent = () => account.user?.id === owner && !account.needsLogin;
  return { getState: () => state, escape: esc, heading: modalHeading, isCurrent,
    openModal: html => { if(isCurrent()) { openModal(html); modalBases = bases; } },
    checkOwner: () => { if(!isCurrent()) throw Error('บัญชีเปลี่ยนแล้ว กรุณาเปิดรายการใหม่'); } };
}
function startTrash() {
  const context = collectionContext();
  openTrash({ ...context, getState: () => account.state, onRestore: async (kind,id,confirmed) => {
    context.checkOwner();
    if (restoreWarnings(account.state,kind,id).length && !confirmed) throw Error('พบรายการที่อาจซ้ำ กรุณาตรวจและยืนยันก่อนกู้คืน');
    if (await mutate(next => restoreFromTrash(next,kind,id))) { render(); startTrash(); notify('กู้คืนแล้ว · รอเซิร์ฟเวอร์ยืนยัน'); return true; }
    return false;
  } });
}
function startUnreadPick(previous) {
  filter = 'owned'; readingFilter = 'unread'; render();
  const pool = filterShelf(searchLibrary(state.series,query,'owned',bookFormat).filter(s => category === 'all' || categoryKey(s.category) === categoryKey(category)), {smart:smartFilter,location:locationFilter,tag:tagFilter,reading:'unread'});
  const candidates = unreadCandidates(pool,locationFilter);
  const picked = pickUnread(candidates,previous);
  if (!picked) { openModal(`${modalHeading('ยังไม่มีเรื่องให้สุ่ม')}<p>ไม่พบเล่มที่มีแล้วและยังไม่อ่านตรงคำค้นกับตัวกรองนี้</p><div class="form-actions"><button class="button" data-close>ปิด</button><button class="button" id="random-clear-filters">ล้างคำค้นและตัวกรอง</button></div>`); $('#random-clear-filters').onclick=()=>{$('#modal').close();query='';clearShelfFilters();render();}; return; }
  const {series,labels}=picked;
  openModal(`${modalHeading('สุ่มได้เรื่องนี้', 'เลือกจากหนังสือที่มีแล้วและยังไม่อ่าน ตามคำค้นและตัวกรองของเธอ')}<div class="detail-top unread-pick">${cover(series)}<div><h2>${esc(series.title)}</h2><p>${esc(series.author)}</p><p>${esc(series.edition)} · ${esc(FORMATS[series.format])}</p><p>เล่มที่ยังไม่อ่าน: ${labels.map(esc).join(', ')}</p></div></div><p class="subtitle">การสุ่มไม่เปลี่ยนสถานะการอ่าน</p><div class="form-actions"><button class="button" id="pick-again" ${candidates.length<2?'disabled':''}>สุ่มอีกเรื่อง</button><button class="button primary" data-detail="${esc(series.id)}">ดูรายละเอียด</button></div>`);
  $('#pick-again').onclick=()=>startUnreadPick(series.id);
}
function startCategoryManager() {
  const context = collectionContext();
  openCategoryManager({ ...context, getState: () => account.state, onSave: async command => {
    context.checkOwner();
    if (await mutate(next => changeCategory(next, command))) {
      render(); startCategoryManager(); notify('บันทึกหมวดหมู่ในเครื่องแล้ว · รอเซิร์ฟเวอร์ยืนยัน');
      return true;
    }
    return false;
  } });
}
function startBulkEdit() {
  const context = collectionContext();
  openBulkEdit({ ...context, state, seriesIds: new Set(selectedSeries), statusFilter: filter, locationFilter, readingFilter,
    onSave: async (ids, patch) => { context.checkOwner(); if(await mutate(next=>bulkPatch(next,ids,patch))) { $('#modal').close(); selectedSeries.clear(); selectionMode=false; render(); notify('แก้รายการแล้ว · รอเซิร์ฟเวอร์ยืนยัน'); } } });
}
function startCsvImport() {
  const context = collectionContext();
  openCsvImport({ ...context, onSave: async (rows, fingerprint) => {
    context.checkOwner();
    if (await mutate(next => { const plan = planCsv(next,rows); if(csvFingerprint(plan)!==fingerprint) throw Error('ชั้นเปลี่ยนระหว่างตรวจทาน กดตรวจข้อมูลอีกครั้งก่อนยืนยัน'); if(plan.results.some(r=>r.status==='error')) throw Error('แก้แถวที่ผิดหรือติ๊กเว้นก่อนยืนยัน'); if(!plan.additions.length) throw Error('ไม่มีรายการพร้อมเพิ่ม'); next.series=plan.next.series; })) {
      $('#modal').close(); page='shelf'; query=''; filter='all'; category='all'; bookFormat='all'; smartFilter='all';locationFilter='';tagFilter='';readingFilter=''; render(); notify('นำเข้า CSV แล้ว · รอเซิร์ฟเวอร์ยืนยัน');
    }
  } });
}
function updateShelfFilters() {
  const items=shelfFilterItems({category,bookFormat,smartFilter,locationFilter,tagFilter,readingFilter});
  const chips=$('#shelf-active-filters'),count=$('#shelf-filter-count');
  if(count){count.textContent=items.length;count.hidden=!items.length;}
  if(chips){chips.hidden=!items.length;chips.innerHTML=items.map(([key,label])=>`<button type="button" data-remove-shelf-filter="${key}" aria-label="ล้างตัวกรอง ${esc(label)}">${esc(label)} <span aria-hidden="true">×</span></button>`).join('');}
}
function clearShelfFilters() { filter='all';category='all';bookFormat='all';smartFilter='all';locationFilter='';tagFilter='';readingFilter='';selectedSeries.clear(); }
function renderResults() {
  if (page === 'check') return renderCheckResults();
  const isbn = normalizeIsbn(query);
  const countsOptions = { status: filter, location: locationFilter, reading: readingFilter, isbn, smart: smartFilter };
  const candidates = searchLibrary(state.series, query, 'all', bookFormat)
    .filter(s => category === 'all' || categoryKey(s.category) === categoryKey(category));
  const editions = sortShelf(filterShelf(candidates, { smart: smartFilter, tag: tagFilter }), shelfOrder);
  const rows = editions.map(series => ({ series, ...shelfVolumeCounts(series, countsOptions) }))
    .filter(row => row.volumes || row.unknownBoxes || filter === 'all' && !locationFilter && !readingFilter && !isbn && smartFilter !== 'no-location');
  const groups = new Map();
  for (const row of rows) {
    const { series } = row;
    const key = !selectionMode && series.groupId ? `group:${series.groupId}` : `edition:${series.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const result = [...groups.values()];
  for (const id of selectedSeries) if (!rows.some(row => row.series.id === id)) selectedSeries.delete(id);
  updateSelectionBar();
  const container = $('#results');
  if (!container) return;
  const counter = $('#shelf-result-count');
  if (counter) {
    const counts = countVolumes(rows);
    counter.innerHTML = `<span class="shelf-result-full">${query ? 'พบ ' : ''}${result.length} เรื่อง / ฉบับ · ${volumeCountText(counts)}</span><span class="shelf-result-compact" aria-hidden="true">${result.length} ฉบับ · ${counts.total} เล่ม<br>เล่ม ${counts.physical} · ebook ${counts.ebook}${counts.boxes ? `<br>บ็อกซ์ไม่ระบุเล่ม ${counts.boxes}` : ''}</span>`;
  }
  updateShelfFilters();
  if ($('#clear-search')) $('#clear-search').hidden = !query;
  container.innerHTML = result.length ? `<div class="shelf-grid ${shelfView === 'list' ? 'shelf-list' : ''}">${result.map(group => { const { series: s } = group[0]; return `<article class="shelf-tile ${selectedSeries.has(s.id)?'is-selected':''}">${selectionMode ? `<label class="shelf-pick"><input type="checkbox" data-select-series="${esc(s.id)}" ${selectedSeries.has(s.id)?'checked':''}><span class="shelf-visually-hidden">เลือก ${esc(s.title)} · ${esc(FORMATS[s.format])}</span></label>` : ''}${card(s, group)}</article>`; }).join('')}</div>` : state.series.length ? `<div class="empty shelf-empty"><span aria-hidden="true">⌕</span><h2>ยังไม่พบในชั้นที่บันทึกไว้</h2><p>ลองเปลี่ยนคำค้นหรือตัวกรอง หนังสือที่ถูกกรองออกยังอยู่บนชั้นเหมือนเดิม</p><button type="button" class="button" id="clear-shelf-all">ล้างคำค้นและตัวกรอง</button></div>` : `<div class="empty shelf-empty"><span aria-hidden="true">▥</span><h2>เริ่มชั้นหนังสือของเรา</h2><p>เพิ่มเรื่องแรกไว้ แล้วให้คั่นไว้ช่วยจำเล่มที่มี</p><button type="button" class="button primary" data-add>เพิ่มหนังสือเล่มแรก</button></div>`;

}

function checkView() {
  return `<section class="purchase-check" aria-label="ค้นเพื่อเช็กก่อนซื้อ">
    <div class="check-heading"><span class="check-icon" aria-hidden="true">✓</span><div><p class="eyebrow">BEFORE YOU BRING IT HOME</p><h2>เช็กเล่มที่กำลังจะซื้อ</h2><p>ดูทั้งที่มีแล้ว สั่งแล้ว และอยู่ในบ็อกซ์ ในครั้งเดียว</p></div></div>
    <div class="check-search-row"><label class="field check-query">ชื่อเรื่อง ผู้เขียน หรือ ISBN<div class="search-wrap"><span aria-hidden="true">⌕</span><input id="search" aria-label="ค้นหาหนังสือ" placeholder="พิมพ์ชื่อเรื่องหรือ ISBN ใต้บาร์โค้ด" value="${esc(query)}" autocomplete="off"><button id="clear-search" aria-label="ล้างคำค้น">×</button></div></label>
    <label class="field check-volume">เลขเล่ม (ถ้ารู้)<input id="check-volume" placeholder="เช่น 3" maxlength="80" value="${esc(checkLabel)}"></label></div>
    <div class="check-search-footer">${scanControls()}<small>ถ่ายเฉพาะบาร์โค้ด ISBN ให้เห็นครบ · อ่านรูปในเครื่องนี้</small></div>
    </section><div id="results" class="purchase-results" aria-live="polite"></div>`;
}

function checkResult(s, relatedLabels = null, related = false) {
  const isbn = related ? null : normalizeIsbn(query), label = related ? '' : checkLabel.trim();
  const wanted = relatedLabels ?? (!isbn && label ? new Set([label]) : null);
  const entries = s.entries.filter(entry => {
    if (isbn) return normalizeIsbn(entry.isbn) === isbn;
    if (!wanted) return true;
    return entry.kind === 'box' ? entry.members.some(member => wanted.has(member)) : wanted.has(entry.label);
  });
  const labelsFor = status => coverage({ ...s, entries }, status).filter(value => !wanted || wanted.has(value));
  const owned = labelsFor('owned'), ordered = labelsFor('ordered'), wish = labelsFor('wishlist');
  const has = status => entries.some(e => e.status === status);
  const verdict = has('owned') ? 'มีแล้วในชั้น' : has('ordered') ? 'สั่งแล้ว รอส่ง' : has('wishlist') ? 'อยู่ในลิสต์อยากซื้อ' : 'ยังไม่พบเล่มนี้ในฉบับนี้';
  const tone = has('owned') ? 'owned' : has('ordered') ? 'ordered' : 'neutral';
  const boxes = entries.filter(e => e.kind === 'box' && (e.status !== 'wishlist' || !e.members.length));
  const picturedEntry = isbn || wanted ? entries.find(e => e.coverData) : null;
  const hasRepresentative=s.coverData||s.entries.some(e=>e.coverData);
  const picture=cover(picturedEntry?{...s,coverData:picturedEntry.coverData}:s);
  const pictureCaption=picturedEntry?(picturedEntry.kind==='box'?'ปกบ็อกซ์':`ปกเล่ม ${picturedEntry.label}`):hasRepresentative?'ภาพแทนชุด':'ยังไม่มีรูปปก';
  return `<article class="purchase-result" data-check-result="${esc(s.id)}"><div class="check-result-top"><figure class="check-result-cover">${picture}<figcaption>${esc(pictureCaption)}</figcaption></figure><div class="check-result-meta"><div class="check-result-labels"><span class="badge ${tone}">${verdict}</span><span class="format-marker">${esc(FORMATS[s.format])}</span></div><h3><button type="button" class="check-title-button" data-detail="${esc(s.id)}" aria-label="ดูรายละเอียด ${esc(s.title)} · ${esc(FORMATS[s.format])}">${esc(s.title)}</button></h3><p>${esc(s.author || 'ยังไม่ระบุผู้เขียน')} · ${esc(s.edition)} · ${esc(s.language)}</p></div></div>
    <dl class="check-status-list">${owned.length ? `<div><dt>มีแล้ว</dt><dd>เล่ม ${owned.map(esc).join(', ')}</dd></div>` : ''}${ordered.length ? `<div class="waiting"><dt>รอส่ง</dt><dd>เล่ม ${ordered.map(esc).join(', ')}</dd></div>` : ''}${wish.length ? `<div><dt>อยากซื้อ</dt><dd>เล่ม ${wish.map(esc).join(', ')}</dd></div>` : ''}</dl>
    ${boxes.length ? `<p class="box-context">${boxes.map(e => `${esc(STATUSES[e.status])}: ${esc(e.label)} (${e.members.length ? `รวมเล่ม ${e.members.map(esc).join(', ')}` : 'ไม่ระบุเล่มในบ็อกซ์'})`).join(' · ')}</p>` : ''}
    ${!has('owned') && !has('ordered') ? '<p class="check-caution">ยังไม่ยืนยันว่าไม่มีจริง หากลงข้อมูลในชั้นไม่ครบ</p>' : ''}
    <div class="check-result-actions"><span>${related ? 'ฉบับที่เชื่อมไว้ · เทียบเลขเล่มและเนื้อหาก่อนซื้อ' : isbn ? 'ISBN ตรงกับรายการที่บันทึก' : label ? `กำลังเช็กเล่ม ${esc(label)}` : 'เทียบเลขเล่มก่อนซื้ออีกครั้ง'}${!related && !isbn && label && s.groupId ? ' · เทียบเลขเล่มและเนื้อหาของแต่ละฉบับ' : ''}${s.sample ? ' · ข้อมูลสมมติ' : ''}</span><span class="check-open-hint" aria-hidden="true">แตะการ์ดเพื่อดูรายละเอียด ↗</span></div></article>`;
}

function renderCheckResults() {
  const container = $('#results'); if (!container) return;
  if (!query.trim()) {
    container.innerHTML = `<div class="check-intro"><span class="check-intro-mark" aria-hidden="true">?</span><h2>กำลังเล็งเล่มไหนอยู่?</h2><p>พิมพ์ชื่อเรื่องหรืออ่านบาร์โค้ดด้านบน<br>เราจะช่วยดูว่ามีแล้ว หรือสั่งไปแล้วหรือยัง</p><div class="check-tips"><span>✓ รวมเล่มที่อยู่ในบ็อกซ์</span><span>✓ แยกหนังสือเล่มกับ ebook</span></div></div>`;
    return;
  }
  // Never hide owned/ordered or the other format while checking a purchase.
  const isbn = normalizeIsbn(query);
  const results = searchLibrary(state.series, query).filter(s => !isbn || s.entries.some(e => normalizeIsbn(e.isbn) === isbn));
  const resultIds = new Set(results.map(s => s.id));
  const related = new Map();
  for (const edition of results) {
    if (!edition.groupId) continue;
    const labels = isbn
      ? edition.entries.filter(e => normalizeIsbn(e.isbn) === isbn).flatMap(e => e.kind === 'box' ? e.members : [e.label])
      : [checkLabel.trim()].filter(Boolean);
    for (const sibling of linkedEditions(state.series, edition)) {
      if (resultIds.has(sibling.id)) continue;
      if (!related.has(sibling.id)) related.set(sibling.id, { sibling, labels: new Set() });
      for (const label of labels) related.get(sibling.id).labels.add(label);
    }
  }
  const text = query.trim().toLocaleLowerCase('th');
  const drafts = state.drafts.filter(d => isbn ? normalizeIsbn(d.isbn) === isbn : `${d.title} ${d.author} ${d.isbn}`.toLocaleLowerCase('th').includes(text));
  container.innerHTML = `${drafts.length ? `<div class="notice warning">มี ${drafts.length} รายการในถาดรอตรวจ ยังไม่นับว่ามีแล้ว <button class="button" data-page="drafts">ไปตรวจข้อมูล</button></div>` : ''}<div class="check-results-heading"><h2>ผลเช็กก่อนซื้อ</h2><span>${results.length + related.size} เรื่อง / ฉบับ${checkLabel.trim() && !isbn ? ` · เล่ม ${esc(checkLabel.trim())}` : ''}</span></div>${results.length ? results.map(s => checkResult(s)).join('') + [...related.values()].map(({ sibling, labels }) => checkResult(sibling, isbn || labels.size ? labels : null, true)).join('') : `<div class="empty"><h2>ยังไม่พบในชั้นที่บันทึกไว้</h2><p>ลองตรวจชื่อหรือ ISBN อีกครั้ง ถ้ายังลงข้อมูลไม่ครบ<br>ผลนี้ยังยืนยันไม่ได้ว่าไม่มีหนังสือเล่มนี้</p><button class="button primary" data-add>เพิ่มข้อมูลหนังสือ</button></div>`}`;
}
function render() {
  refreshAfterModal = false;
  if (!account.user || account.needsLogin) { renderAuth(); return; }
  if (shelfOrderOwner !== account.user.id) {
    shelfOrderOwner = account.user.id; shelfOrder = 'newest'; shelfView = 'covers'; smartFilter = 'all'; locationFilter = ''; tagFilter = ''; readingFilter = ''; selectionMode = false; selectedSeries.clear();
    try { if (localStorage.getItem(`khanwai-shelf-view-v1:${shelfOrderOwner}`) === 'list') shelfView = 'list'; } catch {}
    try { const saved = localStorage.getItem(`khanwai-shelf-order-v1:${shelfOrderOwner}`); if (Object.hasOwn(SHELF_ORDERS, saved)) shelfOrder = saved; } catch {}
  }
  $('#main').classList.toggle('shelf-page',page==='shelf');
  document.body.classList.remove('auth-gated');
  if ($('#auth-modal').open) $('#auth-modal').close();
  $('#profile-name').textContent = account.user.name; $('#profile-email').textContent = account.user.email;
  $('#breadcrumb').textContent = names[page];
  $('#series-count').textContent = state.series.length;
  document.querySelectorAll('nav [data-page]').forEach(b => { b.classList.toggle('active', b.dataset.page === page); b.setAttribute('aria-current', b.dataset.page === page ? 'page' : 'false'); });
  const heading = page==='shelf' ? '' : `<div class="page-heading"><div><p class="eyebrow">A LITTLE SPACE FOR YOUR STORIES</p><h1>${names[page]}</h1><p class="subtitle">${page === 'shelf' ? 'ทุกเล่มมีที่ของมัน ทุกเรื่องมีที่ในใจเรา' : page === 'check' ? 'เช็กให้ชัวร์ ก่อนพาเล่มใหม่กลับบ้าน' : page === 'drafts' ? 'ค่อย ๆ ตรวจ แล้วพาเล่มโปรดเข้าชั้น' : 'ดูแลข้อมูลเล่มโปรดของเรา'}</p></div>${page !== 'settings' ? `<div class="heading-actions"><button class="button primary" data-add><span class="plus">+</span> เพิ่มหนังสือ</button></div>` : ''}</div>`;
  let body = '';
  if (page === 'shelf') {
    body = shelfPageMarkup({state,query,filter,category,bookFormat,smartFilter,locationFilter,tagFilter,readingFilter,shelfOrder,shelfView,selectionMode,filtersOpen:$('#shelf-filters')?.open??false},esc);
  } else if (page === 'check') {
    body = checkView();
  } else if (page === 'drafts') {
    body = `<section class="hero"><div><p class="eyebrow">ONE MORE BOOK, ONE LESS WORRY</p><h2>หนังสือทุกเล่ม มีที่ของมัน</h2><p>ตรวจชื่อเรื่อง เลขเล่ม และข้อมูลให้เรียบร้อย<br>ก่อนยืนยันพาเล่มโปรดเข้าชั้น</p></div><div class="hero-art" aria-hidden="true"><div class="hero-book one">☾</div><div class="hero-book two">❧</div><div class="hero-book three">♡</div><span class="hero-spark">✧</span></div></section><div class="notice">รายการรอตรวจยังไม่ถูกนับว่ามีแล้ว · ถาดนี้เป็นของบัญชีที่เข้าสู่ระบบ</div>${state.drafts.length ? `<section class="panel">${state.drafts.map(d => `<div class="draft-row"><div><strong>${esc(d.title || 'ยังไม่ทราบชื่อเรื่อง')}</strong><small>${esc(d.isbn || 'ไม่มี ISBN')} · ${esc(FORMATS[d.format])} · ${esc(d.source)}</small></div><button class="button" data-review="${esc(d.id)}">ตรวจข้อมูล</button><button class="button danger" data-remove-draft="${esc(d.id)}">ลบ</button></div>`).join('')}</section>` : '<div class="empty"><h2>ถาดรอตรวจยังว่างอยู่</h2><p>เพิ่ม ISBN แล้วเก็บไว้ตรวจภายหลังได้<br>ยังไม่เข้าชั้นจนกว่าเธอจะยืนยัน</p><button class="button primary" data-add>เริ่มเพิ่มหนังสือ</button></div>'}`;
  } else { body = settingsView(); }
  $('#main').innerHTML = heading + (account.cache?.conflict ? '<div class="notice warning">มีข้อมูลจากสองเครื่องชนกัน <button class="button" id="resolve-conflict">ตรวจและเลือกข้อมูล</button></div>' : '') + (account.needsReload ? '<div class="notice warning">ข้อมูลเปลี่ยนจากอีกแท็บ <button class="button" id="reload-app">โหลดหน้าใหม่</button></div>' : '') + (storageError ? `<div class="notice warning">${esc(storageError)}</div>` : '') + body;
  renderResults();
  if (page === 'settings') mountLookupSettings(account.user.id, esc);
}
function openModal(content, kind = '') {
  $('#modal').classList.toggle('detail-dialog',kind==='detail');
  modalBases = account.cache ? account.captureBases() : undefined;
  lookupController?.abort();
  $('#modal-content').innerHTML = `<div class="modal-inner">${content}</div>`;
  if (!$('#modal').open) $('#modal').showModal();
}
function modalHeading(title, subtitle = '') { return `<div class="modal-heading"><div><h2 id="modal-title">${esc(title)}</h2>${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ''}</div><button class="close" data-close aria-label="ปิดหน้าต่าง">×</button></div>`; }
function openEdit(seriesId, entryId = null) {
  const series = state.series.find(s => s.id === seriesId);
  const entry = entryId ? series?.entries.find(e => e.id === entryId) : null;
  if (!series || entryId && !entry) return;
  const onSave = async patch => {
    if (patch === null) { openDetail(seriesId); return; }
    if (!await mutate(next => {
      const s = next.series.find(s => s.id === seriesId);
      const item = entryId ? s?.entries.find(e => e.id === entryId) : s;
      if(!s || s.trashedAt || !item || item.trashedAt)throw Error('รายการนี้อยู่ในถังขยะหรือเปลี่ยนไปแล้ว กรุณาเปิดใหม่');
      Object.assign(item, patch, { updatedAt: new Date().toISOString() });
    })) return;
    if (!entryId && page === 'shelf') { query = ''; filter = 'all'; bookFormat = 'all'; category = 'all'; }
    render(); openDetail(seriesId); notify('แก้ไขข้อมูลแล้ว · รอเซิร์ฟเวอร์ยืนยัน');
  };
  const context = { state, series, entry, openModal, heading: modalHeading, escape: esc, onSave };
  if (entryId) editEntry(context); else editSeries(context);
}
function addModeMarkup(mode) {
  return `<div class="tabs add-modes" role="group" aria-label="วิธีเพิ่มหนังสือ"><button type="button" class="tab ${mode==='single'?'active':''}" data-add-mode="single" aria-pressed="${mode==='single'}">ทีละเล่ม</button><button type="button" class="tab ${mode==='batch'?'active':''}" data-add-mode="batch" aria-pressed="${mode==='batch'}">หลายเล่มในชุด</button></div>`;
}
function lookupMarkup(isbn='') {
  return `<form id="lookup-form"><label class="field" for="lookup-isbn">ISBN · ใช้เล่มหนึ่งช่วยกรอกข้อมูล</label><div class="isbn-row"><input id="lookup-isbn" value="${esc(isbn)}" placeholder="ISBN 10 หรือ 13 หลัก" inputmode="text" maxlength="30"><button class="button" type="submit" id="lookup-button">ดึงข้อมูล</button></div>${scanControls()}</form><div class="lookup-result" id="lookup-result" role="status"></div>`;
}
function nextLabel(labels) {
  const numeric=labels.filter(label=>/^\d+$/.test(label)).map(Number);
  return numeric.length?String(Math.max(...numeric)+1):'';
}
function openBatch(initial={}) {
  draftId=initial.draftId??null;
  const controller=openBatchForm({state,editions:addEditionChoices(initial.groupSourceId),initial,openModal,heading:modalHeading,escape:esc,notify,intro:addModeMarkup('batch'),lookupMarkup:lookupMarkup(initial.lookupIsbn??initial.seedIsbn),onSave:async data=>{
    let savedId;
    const attachesSeed=data.seed&&data.labels.includes(data.seed.label);
    const duplicates=attachesSeed&&state.series.some(s=>s.entries.some(e=>normalizeIsbn(e.isbn)===data.seed.isbn));
    if(duplicates&&!data.confirmDuplicate)throw Error('ISBN ต้นทางมีในชั้นแล้ว โปรดกลับไปตรวจและยืนยันอีกสำเนา');
    const saved=await mutate(next=>{
      let series=next.series.find(s=>s.id===data.seriesId);
      if(series?.trashedAt || next.drafts.some(d=>d.id===data.draftId&&d.trashedAt))throw Error('รายการนี้อยู่ในถังขยะ กรุณาเปิดใหม่');
      if(data.seriesId && !series) throw Error('ฉบับที่เลือกเปลี่ยนไปแล้ว กรุณาเปิดใหม่');
      if(series && data.groupSourceId) requireOtherFormat(next, data.groupSourceId, series, true);
      if(!series){series={id:newId(),title:data.title,author:data.author,alias:'',category:data.category,format:data.format,edition:data.edition,language:data.language,tags:parseTags(data.tags),entries:[]};next.series.push(series);attachNewEdition(next, data.groupSourceId, series);}
      series.target=[...new Set([...(series.target??[]),...data.target])];
      if(data.seed)series.metadataSeed=data.seed;
      if(data.coverData)series.coverData=data.coverData;
      for(const label of data.labels){
        if(matchingEntries(series,{kind:'volume',label,isbn:''}).length)continue;
        const sourceVolume=data.seed?.label===label;
        series.entries.push({id:newId(),kind:'volume',label,readingStatus:data.readingStatus,quantity:1,isbn:sourceVolume?data.seed.isbn:'',status:data.status,location:data.location,source:sourceVolume?data.seed.source:'เพิ่มเป็นชุด',reviewedAt:new Date().toISOString()});
      }
      if(data.draftId&&attachesSeed)next.drafts=next.drafts.filter(d=>d.id!==data.draftId);
      savedId=series.id;
    });
    if(saved){
      $('#modal').close();page='shelf';query=data.title;filter='all';bookFormat='all';category='all';render();
      if(data.continueAdding)openAdd(null,savedId,{prefill:{label:nextLabel(data.labels),status:data.status,location:data.location},continueAdding:true});else openDetail(savedId);
    }
    return saved;
  }});
  $('#lookup-form').addEventListener('submit',lookup);
  document.querySelectorAll('[data-add-mode]').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.addMode!=='single')return;
    try{const data=controller.getData();openAdd(null,data.seriesId,{prefill:{...data,isbn:data.seedIsbn,label:data.seedLabel},draftId:data.draftId,groupSourceId:data.groupSourceId,batchContext:data,continueAdding:data.continueAdding});}catch(error){notify(error.message);}
  }));
}
function editEntryPhoto(seriesId, entryId = null) {
  const series = state.series.find(s => s.id === seriesId);
  const item = entryId ? series?.entries.find(e => e.id === entryId) : series;
  if (!item) return;
  openModal(`${modalHeading(entryId ? `รูปปกเล่ม ${item.label}` : 'ภาพปกของชุด', series.title)}${photoEditorMarkup(esc)}<div class="form-actions"><button class="button" id="cancel-photo">ยกเลิก</button><button class="button primary" id="confirm-photo">บันทึกรูปปก</button></div>`);
  const getPhoto = mountPhotoEditor($('#modal-content'), item.coverData ?? '');
  $('#cancel-photo').addEventListener('click', () => openDetail(seriesId));
  $('#confirm-photo').addEventListener('click', async () => {
    try {
      const image = getPhoto();
      if (await mutate(next => { const s = next.series.find(s => s.id === seriesId); const target = entryId ? s?.entries.find(e => e.id === entryId) : s; if(!s||s.trashedAt||!target||target.trashedAt)throw Error('รายการนี้อยู่ในถังขยะหรือเปลี่ยนไปแล้ว'); target.coverData = image; })) { openDetail(seriesId); render(); notify('บันทึกรูปปกแล้ว · รอเซิร์ฟเวอร์ยืนยัน'); }
    } catch (error) { notify(error.message); }
  });
}
function openAdd(draft = null, seriesId = '', options = {}) {
  draftId = draft?.id ?? options.draftId ?? null;
  seriesId = seriesId || draft?.seriesId || '';
  const d = draft ?? options.prefill ?? { title: '', author: '', isbn: '', label: '', edition: 'ฉบับธรรมดา', language: 'ไทย', format: 'physical', category: categoryList(state)[0], source: 'กรอกเอง' };
  const groupSourceId = draft?.groupSourceId ?? options.groupSourceId ?? '';
  const editions = addEditionChoices(groupSourceId);
  const selected = editions.find(s => s.id === seriesId);
  const groupSource = state.series.find(s => s.id === groupSourceId);
  openModal(`${modalHeading(draft ? 'ตรวจข้อมูลก่อนเข้าชั้น' : 'เพิ่มหนังสือ', 'บันทึกเมื่อเธอตรวจแล้วเท่านั้น')}${addModeMarkup('single')}
    ${groupSource ? `<p class="subtitle">เพิ่มฉบับให้เรื่อง ${esc(groupSource.title)}</p>` : ''}
    ${lookupMarkup(d.lookupIsbn??d.isbn)}
    <form id="review-form"><div class="form-grid">
    <label class="field full">เพิ่มเข้าเรื่อง / ฉบับ<select id="series-link" name="seriesId"><option value="">สร้างเรื่อง / ฉบับใหม่</option>${editions.map(s => `<option value="${esc(s.id)}" ${s.id === seriesId ? 'selected' : ''}>${esc(s.title)} · ${esc(s.edition)} · ${esc(s.language)} · ${esc(FORMATS[s.format])}</option>`).join('')}</select><small>ชื่อคล้ายกันจะไม่ถูกรวมเอง เลือกเรื่องเดิมเมื่อเป็นฉบับเดียวกัน</small></label>
    <label class="field full">ชื่อเรื่อง *<input name="title" required maxlength="300" value="${esc(selected?.title ?? d.title)}"></label>
    <label class="field">ผู้เขียน<input name="author" maxlength="300" value="${esc(selected?.author ?? d.author)}"></label>
    <label class="field">ประเภท<select name="category">${categoryOptions(state, selected?.category ?? d.category ?? categoryList(state)[0], esc)}</select></label>
    <label class="field full">รูปแบบหนังสือ<select name="format" aria-label="รูปแบบหนังสือ" aria-describedby="format-help">${formatOptions(selected?.format ?? d.format)}</select><small id="format-help">เรื่องเดียวกันเก็บได้ทั้งหนังสือเล่มและ ebook โดยสร้างแยกฉบับ ไม่ต้องมี ISBN ก็เพิ่มได้</small></label>
    <label class="field">ฉบับ *<input name="edition" required maxlength="300" value="${esc(selected?.edition ?? d.edition)}"></label>
    <label class="field">ภาษา *<input name="language" required maxlength="100" value="${esc(selected?.language ?? d.language)}"></label>
    <label class="field full">แท็กส่วนตัวของฉบับ<input name="tags" maxlength="1529" value="${esc(tagText(selected?.tags ?? d.tags))}" placeholder="เช่น ฉบับสะสม, งานหนังสือ"></label><label class="field full"><span id="location-label">ตำแหน่งเก็บ / แพลตฟอร์ม ebook</span><input name="location" aria-labelledby="location-label" maxlength="150" value="${esc(d.location ?? '')}" placeholder="เช่น ตู้ B ชั้น 2 หรือแอพที่ซื้อ ebook"></label>
    <label class="field">เลขเล่ม / เล่มพิเศษ *<input name="label" required maxlength="80" value="${esc(d.label)}" placeholder="เช่น 1 หรือ ภาคพิเศษ"></label>
    <label class="field">ISBN ของเล่มนี้<input name="isbn" maxlength="30" value="${esc(d.isbn)}" placeholder="ไม่มีให้เว้นว่าง"></label>
    <label class="field">สถานะ<select name="status">${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${k===(d.status??'owned')?'selected':''}>${v}</option>`).join('')}</select></label>
    <label class="field">สถานะการอ่าน<select name="readingStatus">${readingOptions(d.readingStatus ?? (draft ? '' : 'unread'))}</select><small>แยกจากการมีแล้ว รอส่ง และอยากซื้อ</small></label><label class="field">จำนวนสำเนา / สิทธิ์<input name="quantity" type="number" value="${esc(d.quantity??1)}" min="1" max="999" required></label>
    </div>${photoEditorMarkup(esc)}<label class="checkbox-line"><input id="continue-adding" type="checkbox" ${options.continueAdding?'checked':''}>เพิ่มเล่มถัดไปต่อหลังบันทึก</label><p class="subtitle" id="source-label">แหล่งข้อมูล: ${esc(d.source||'กรอกเอง')} · ตรวจเลขเล่ม ภาษา และฉบับก่อนบันทึก</p><div id="duplicate-warning" aria-live="polite"></div>
    <div class="form-actions"><button class="button" id="save-draft" type="button">เก็บไว้ในถาดรอตรวจ</button><button class="button primary" type="submit">ตรวจแล้ว · เพิ่มเข้าชั้น</button></div></form>`);
  $('#review-form').dataset.source = d.source||'กรอกเอง';
  $('#review-form').dataset.groupSourceId = groupSourceId;
  getReviewPhoto = mountPhotoEditor($('#modal-content'), d.coverData ?? '');
  syncLinkedFields();
  $('#lookup-form').addEventListener('submit', lookup);
  $('#review-form').addEventListener('submit', commitReview);
  $('#series-link').addEventListener('change', () => { syncLinkedFields(); $('#duplicate-warning').innerHTML = ''; });
  $('#save-draft').addEventListener('click', saveDraft);
  $('#review-form').elements.format.addEventListener('change', updateReviewLocation);
  document.querySelectorAll('[data-add-mode]').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.addMode!=='batch')return;
    if($('#review-form').dataset.saving){notify('กำลังบันทึก กรุณารอสักครู่');return;}
    try{
      const data=draftFromForm(),form=$('#review-form');
      openBatch({...options.batchContext,...data,draftId,seedIsbn:data.isbn,seedLabel:data.label,lookupIsbn:$('#lookup-isbn').value,status:form.elements.status.value,quantity:form.elements.quantity.value,continueAdding:$('#continue-adding').checked});
    }catch(error){notify(error.message);}
  }));
}
function updateReviewLocation() {
  const form = $('#review-form');
  const ebook = form.elements.format.value === 'ebook';
  $('#location-label').textContent = ebook ? 'แพลตฟอร์ม ebook' : 'ตำแหน่งเก็บ';
  form.elements.location.placeholder = ebook ? 'เช่น แอพที่ซื้อ ebook' : 'เช่น ตู้ B ชั้น 2';
}
function syncLinkedFields() {
  const form = $('#review-form');
  const series = state.series.find(s => s.id === form.elements.seriesId.value);
  for (const key of ['title', 'author', 'category', 'edition', 'language', 'format', 'tags']) {
    if (series) form.elements[key].value = key === 'tags' ? (series.tags ?? []).join(', ') : series[key];
    form.elements[key].disabled = Boolean(series);
  }
  updateReviewLocation();
}
async function lookup(event) {
  event.preventDefault();
  const isbn = normalizeIsbn($('#lookup-isbn').value);
  const output = $('#lookup-result');
  if (!isbn) { output.textContent = 'ISBN ไม่ถูกต้อง ลองตรวจตัวเลขอีกครั้ง หรือกรอกข้อมูลด้านล่างเองได้'; return; }
  const targetForm=$('#review-form')||$('#batch-form'),isBatch=targetForm.id==='batch-form';
  targetForm.elements[isBatch?'seedIsbn':'isbn'].value=isbn;
  const existing = state.series.filter(s => s.entries.some(e => normalizeIsbn(e.isbn) === isbn));
  const draft = state.drafts.find(d => normalizeIsbn(d.isbn) === isbn && d.id !== draftId);
  const templates=isBatch?state.series.filter(s=>existing.includes(s)||normalizeIsbn(s.metadataSeed?.isbn)===isbn):[];
  if(isBatch&&templates.length){
    output.innerHTML='<p>พบข้อมูลฉบับที่เคยบันทึกไว้ เลือกใช้เป็นข้อมูลตั้งต้นได้ ไม่ได้ยืนยันว่ามีเล่มต้นทางอยู่ในชั้น</p>';
    for(const series of templates){
      const entry=series.entries.find(e=>normalizeIsbn(e.isbn)===isbn)??series.metadataSeed;
      const choice=document.createElement('button');choice.type='button';choice.className='button';choice.textContent=`ใช้ฉบับเดิม: ${series.title} · ${series.edition} · ${FORMATS[series.format]}`;
      choice.addEventListener('click',()=>{
        targetForm.elements.seriesId.value=series.id;targetForm.elements.seriesId.dispatchEvent(new Event('change'));
        targetForm.elements.seedIsbn.value=entry.kind==='box'?'':isbn;targetForm.elements.seedLabel.value=entry.kind==='box'?'':entry.label;
        targetForm.dataset.source='ข้อมูลจากชั้นของฉัน';$('#source-label').textContent='แหล่งข้อมูล: ข้อมูลจากชั้นของฉัน · ตรวจเลขเล่มและ ISBN ก่อนบันทึก';
        if(entry.kind==='box')notify('ใช้ข้อมูลชุดจากบ็อกซ์แล้ว ISBN บ็อกซ์จะไม่ถูกใส่ให้เล่มเดี่ยว');
      });output.append(choice);
    }
    return;
  }
  if (!isBatch && (existing.length || draft)) {
    output.innerHTML = `<div class="notice warning">${existing.length ? `พบ ISBN นี้ในชั้น: ${existing.map(s => esc(s.title)).join(', ')} ตรวจสถานะและฉบับก่อนเพิ่มอีกสำเนา` : 'ISBN นี้อยู่ในถาดรอตรวจแล้ว เปิดตรวจรายการเดิมจากถาดได้'}</div>`;
    return;
  }
  if (!navigator.onLine) { output.textContent = 'ตอนนี้ออฟไลน์ เก็บ ISBN ในถาด แล้วกลับมาดึงข้อมูลเมื่อออนไลน์ได้'; return; }
  const button = $('#lookup-button'); button.disabled = true;
  output.textContent = 'กำลังค้นข้อมูลหนังสือ…';
  lookupController?.abort(); const controller = new AbortController(); lookupController = controller;
  try {
    const response = await fetch(`/api/isbn?isbn=${isbn}`, { signal: controller.signal });
    if (!response.ok) throw new Error('lookup failed');
    const data = await response.json();
    if (!output.isConnected) return;
    if (data.status === 'disabled') { output.textContent = 'ปิดการค้นข้อมูลภายนอกไว้ในตั้งค่า ยังสแกน ISBN และกรอกข้อมูลด้านล่างเองได้'; return; }
    if (data.status !== 'found') {
      if (Array.isArray(data.providers) && data.providers.length) {
        const statuses = { not_found:'ยังไม่พบ ISBN นี้', rate_limited:'จำกัดคำขอ/โควตาหมด', unavailable:'ติดต่อไม่ได้' };
        output.textContent = data.providers.map(provider => `${provider.name}: ${statuses[provider.status] || 'ค้นไม่สำเร็จ'}`).join(' · ') + ' — ISBN ยังอยู่ กรอกข้อมูลเองด้านล่างได้';
        return;
      }
      output.textContent = ({ not_found: 'ยังไม่พบข้อมูล ISBN นี้ กรอกชื่อและเลขเล่มเองได้', rate_limited: 'ยังดึงข้อมูลไม่ได้: แหล่งค้นหาบางแห่งจำกัดคำขอ ลองใหม่ภายหลังหรือกรอกเองได้ โดย ISBN ยังอยู่', unavailable: 'ติดต่อแหล่งข้อมูลไม่ได้ ลองใหม่ภายหลังหรือกรอกเอง' })[data.status] ?? 'ค้นไม่สำเร็จ กรอกเองได้';
      return;
    }
    output.innerHTML = '<p>เลือกข้อมูลที่ตรงกับหนังสือ แล้วตรวจฉบับและเลขเล่มด้านล่าง</p>';
    for (const candidate of data.candidates) {
      const choice = document.createElement('button'); choice.className = 'button'; choice.type = 'button';
      choice.textContent = `${candidate.title} · ${candidate.author || 'ไม่ระบุผู้เขียน'} · ${candidate.publisher || 'ไม่ระบุสำนักพิมพ์'} · ${candidate.source || 'ข้อมูลภายนอก'}`;
      choice.addEventListener('click', () => {
        const form=targetForm;
        if(!form.isConnected)return;
        if(!form.elements.seriesId.value){
          form.elements.title.value=seriesTitleFromCandidate(candidate); form.elements.author.value=candidate.author||'';
          form.elements.language.value=candidate.language==='th'?'ไทย':candidate.language||'';
          form.elements.edition.value=String(candidate.edition??'').trim()||form.elements.edition.value.trim()||'ฉบับธรรมดา';
        }
        form.elements[isBatch?'seedIsbn':'isbn'].value=candidate.isbn;form.elements[isBatch?'seedLabel':'label'].value=candidate.label||'';
        const applied = output.querySelector('p');
        if(applied){applied.className='lookup-applied';applied.setAttribute('role','status');applied.textContent=form.elements.seriesId.value?'ใส่ ISBN ที่เลือกแล้ว · ข้อมูลฉบับเดิมยังอยู่':'กรอกข้อมูลที่เลือกแล้ว · ตรวจชื่อเรื่องและฉบับด้านล่าง';}
        form.dataset.source = candidate.source || 'ข้อมูลภายนอก'; $('#source-label').textContent = `แหล่งข้อมูล: ${form.dataset.source} · โปรดตรวจภาษา ฉบับ และเลขเล่มก่อนบันทึก`;
        notify('กรอกข้อมูลที่ค้นได้แล้ว ตรวจเลขเล่มและฉบับก่อนบันทึก');
      }); output.append(choice);
    }
  } catch (error) { if (error.name !== 'AbortError' && output.isConnected) output.textContent = 'ค้นข้อมูลไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ เพิ่มด้วยตัวเองได้'; }
  finally { button.disabled = false; }
}
function draftFromForm() {
  const form = $('#review-form'); const fields = {};
  for (const key of ['title', 'author', 'isbn', 'label', 'edition', 'language', 'category', 'format', 'location']) fields[key] = form.elements[key].value.trim();
  if (fields.isbn) { const normalized = normalizeIsbn(fields.isbn); if (!normalized) throw new Error('ISBN ไม่ถูกต้อง ตรวจเลขหรือเว้นว่างก่อนบันทึก'); fields.isbn = normalized; }
  fields.readingStatus = form.elements.readingStatus.value;
  fields.tags = parseTags(form.elements.tags.value);
  const groupSourceId = form.dataset.groupSourceId;
  return { ...fields, ...(groupSourceId ? { groupSourceId } : {}), coverData: getReviewPhoto(), id: draftId ?? newId(), source: form.dataset.source || 'กรอกเอง', seriesId: form.elements.seriesId.value };
}
function beginReviewSave(form) {
  if (!form || form.dataset.saving) return null;
  form.dataset.saving = 'true';
  const buttons = [...form.querySelectorAll('button')].map(button => [button, button.disabled]);
  buttons.forEach(([button]) => { button.disabled = true; });
  return () => { delete form.dataset.saving; buttons.forEach(([button, disabled]) => { button.disabled = disabled; }); };
}
async function saveDraft() {
  const finish = beginReviewSave($('#review-form')); if (!finish) return;
  try {
    const d = draftFromForm();
    if (!d.title && !d.isbn) { notify('กรอกชื่อหรือ ISBN อย่างน้อยหนึ่งช่องก่อนเก็บในถาด'); return; }
    if (d.isbn && state.drafts.some(item => item.id !== d.id && normalizeIsbn(item.isbn) === d.isbn)) { notify('ISBN นี้มีในถาดแล้ว โปรดตรวจรายการเดิม'); return; }
    if (await mutate(next => { if(next.drafts.some(item=>item.id===d.id&&item.trashedAt))throw Error('รายการนี้อยู่ในถังขยะ กรุณาเปิดใหม่'); next.drafts = next.drafts.filter(item => item.id !== d.id); next.drafts.push(d); })) {
      $('#modal').close(); render(); notify('เก็บในถาดรอตรวจแล้ว · รอซิงก์กับบัญชี');
    }
  } catch (error) { notify(error.message); } finally { finish(); }
}
async function commitReview(event) {
  event.preventDefault();
  const finish = beginReviewSave(event.target); if (!finish) return;
  try {
    const d = draftFromForm(); const form = event.target;
    const quantity = Number(form.elements.quantity.value), seriesId = form.elements.seriesId.value;
    const entry = { id: newId(), readingStatus: d.readingStatus, isbn: d.isbn, label: d.label, status: form.elements.status.value, quantity, kind: 'volume', source: d.source, reviewedAt: new Date().toISOString(), coverData: d.coverData, location: d.location };
    const sameIsbn = d.isbn ? state.series.flatMap(s => s.entries.filter(e => normalizeIsbn(e.isbn) === d.isbn).map(e => ({ series: s, entry: e }))) : [];
    const selected = state.series.find(s => s.id === seriesId);
    const duplicates = selected ? matchingEntries(selected, entry) : [];
    if (sameIsbn.length || duplicates.length) {
      if (!$('#confirm-duplicate')?.checked) {
        $('#duplicate-warning').innerHTML = `<div class="notice warning">พบรายการที่อาจซ้ำ ${sameIsbn.map(x => `${esc(x.series.title)} (${esc(FORMATS[x.series.format])} · ${esc(STATUSES[x.entry.status])})`).join(', ')} ${duplicates.length ? 'ในเรื่องที่เลือกมีเล่มนี้หรืออยู่ในบ็อกซ์แล้ว' : ''}<label class="checkbox-line"><input type="checkbox" id="confirm-duplicate">ฉันตรวจแล้วและต้องการเพิ่มอีกสำเนา</label></div>`;
        return;
      }
    }
    const continueAdding=$('#continue-adding').checked; let savedSeriesId;
    if (await mutate(next => {
      let series = next.series.find(s => s.id === seriesId);
      if(series?.trashedAt || next.drafts.some(d=>d.id===draftId&&d.trashedAt))throw Error('รายการนี้อยู่ในถังขยะ กรุณาเปิดใหม่');
      if (seriesId && !series) throw Error('ฉบับที่เลือกเปลี่ยนไปแล้ว กรุณาเปิดใหม่');
      if (series && d.groupSourceId) requireOtherFormat(next, d.groupSourceId, series, true);
      if (!series) { series = { id: newId(), title: d.title, author: d.author, alias: '', category: d.category, edition: d.edition, language: d.language, format: d.format, tags: d.tags, entries: [] }; next.series.push(series); attachNewEdition(next, d.groupSourceId, series); }
      series.entries.push(entry); savedSeriesId=series.id; next.drafts = next.drafts.filter(item => item.id !== draftId);
    })) { $('#modal').close(); render(); if(continueAdding)openAdd(null,savedSeriesId,{prefill:{label:nextLabel([d.label]),status:entry.status,location:d.location},continueAdding:true}); else if(d.groupSourceId)openDetail(savedSeriesId); notify('เพิ่มเข้าชั้นแล้ว · รอซิงก์กับบัญชี'); }
  } catch (error) { notify(error.message); } finally { finish(); }
}
function editionLabel(series) {
  return [series.title, series.author, series.edition, series.language, FORMATS[series.format]].filter(Boolean).join(' · ');
}

function openEditionLink(id) {
  const source = state.series.find(s => s.id === id);
  if (!source) return;
  const members = linkedEditions(account.state.series, source);
  const candidates = state.series.filter(s => !members.some(member => member.id === s.id));
  openModal(`${modalHeading('เชื่อมฉบับของเรื่องนี้', editionLabel(source))}
    <form id="edition-link-form">
      <label class="field">เลือกฉบับที่จะเชื่อม<select name="edition" required><option value="">เลือกฉบับ</option>${candidates.map(s => `<option value="${esc(s.id)}">${esc(editionLabel(s))}</option>`).join('')}</select></label>
      <ul id="edition-link-preview"></ul>
      <div class="form-actions">${source.groupId ? '<button type="button" class="button" id="unlink-edition">แยกฉบับนี้ออก</button>' : ''}<button type="submit" class="button primary" disabled>ยืนยันเชื่อมฉบับ</button></div>
    </form>`);
  const form = $('#edition-link-form');
  let expected = members.map(s => s.id);
  const refresh = () => {
    const target = candidates.find(s => s.id === form.elements.edition.value);
    const preview = [...members, ...(target ? linkedEditions(account.state.series, target) : [])];
    expected = preview.map(s => s.id);
    $('#edition-link-preview').innerHTML = preview.map(s => `<li>${esc(editionLabel(s))}${s.trashedAt ? ' · อยู่ในถังขยะ' : ''}</li>`).join('');
    form.querySelector('[type=submit]').disabled = !target;
  };
  const save = async (target, ids) => {
    const finish = beginReviewSave(form);
    if (!finish) return;
    try {
      if (await mutate(next => changeEditionGroup(next, id, target, ids, newId()))) {
        render(); openDetail(id); notify('บันทึกการเชื่อมฉบับแล้ว · รอเซิร์ฟเวอร์ยืนยัน');
      }
    } finally { finish(); }
  };
  refresh();
  form.elements.edition.addEventListener('change', refresh);
  form.addEventListener('submit', event => { event.preventDefault(); void save(form.elements.edition.value, expected); });
  $('#unlink-edition')?.addEventListener('click', () => void save('', members.map(s => s.id)));
}

function openReleaseTarget(id) {
  const series = state.series.find(s => s.id === id);
  if (!series) return;
  openModal(`${modalHeading('ระบุเล่มที่ออกแล้ว', editionLabel(series))}
    <form id="release-target-form">
      <label class="field">เลขเล่มที่ออกแล้ว<input name="target" value="${esc((series.target ?? []).join(', '))}" placeholder="เช่น 1–10, เล่มพิเศษ"><small>ใส่ช่วงหรือคั่นเลขด้วยจุลภาค เว้นว่างได้ถ้ายังไม่ทราบ</small></label>
      <p role="alert" id="release-target-error"></p>
      <div class="form-actions"><button type="button" class="button" data-detail="${esc(id)}">ยกเลิก</button><button type="submit" class="button primary">บันทึกเลขเล่ม</button></div>
    </form>`);
  const form = $('#release-target-form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const finish = beginReviewSave(form);
    if (!finish) return;
    try {
      const target = targetLabels(form.elements.target.value);
      if (await mutate(next => {
        const current = next.series.find(s => s.id === id && !s.trashedAt);
        if (!current) throw Error('ฉบับนี้เปลี่ยนไปแล้ว กรุณาเปิดใหม่');
        current.target = target;
      })) { render(); openDetail(id); }
    } catch (error) { $('#release-target-error').textContent = error.message; }
    finally { finish(); }
  });
}

function addOtherFormat(id) {
  const source = state.series.find(s => s.id === id);
  if (!source) return;
  openAdd(null, '', {
    groupSourceId: id,
    prefill: { title: source.title, author: source.author, category: source.category, language: source.language,
      edition: 'ฉบับธรรมดา', format: source.format === 'ebook' ? 'physical' : 'ebook' }
  });
}

function addEditionChoices(groupSourceId) {
  if (!groupSourceId) return state.series;
  const source = state.series.find(s => s.id === groupSourceId);
  if (!source) return [];
  return linkedEditions(state.series, source).filter(s => s.format !== source.format);
}

function requireOtherFormat(next, sourceId, edition, mustBeLinked = false) {
  const source = next.series.find(s => s.id === sourceId && !s.trashedAt);
  if (!source || (mustBeLinked && (!source.groupId || edition.groupId !== source.groupId))) {
    throw Error('ฉบับที่เชื่อมไว้เปลี่ยนไปแล้ว กรุณาเปิดใหม่');
  }
  if (edition.format === source.format) throw Error('เลือกรูปแบบอื่นเพื่อเพิ่มให้เรื่องนี้');
}

function attachNewEdition(next, groupSourceId, newEdition) {
  if (!groupSourceId) return;
  requireOtherFormat(next, groupSourceId, newEdition);
  const source = state.series.find(s => s.id === groupSourceId);
  if (!source) throw Error('ฉบับต้นทางเปลี่ยนไปแล้ว กรุณาเปิดใหม่');
  const expected = [...linkedEditions(account.state.series, source).map(s => s.id), newEdition.id];
  changeEditionGroup(next, source.id, newEdition.id, expected, newId());
}

function openDetail(id) {
  const series = state.series.find(item => item.id === id); if (!series) return;
  const expanded = new Set([...document.querySelectorAll('#modal[open] [data-edition-settings][open]')].map(el => el.dataset.editionSettings));
  const editions = linkedEditions(state.series, series);
  openModal(detailMarkup(series, {esc,cover,heading:modalHeading,editions}), 'detail');
  for (const panel of document.querySelectorAll('[data-edition-settings]')) panel.open = expanded.has(panel.dataset.editionSettings);
}
async function scanImage(file, target) {
  if (!file || !target) return;
  const generation = ++scanGeneration;
  notify('กำลังอ่านบาร์โค้ดจากรูป…');
  try {
    // Yield once so the progress message is visible before decoding.
    await new Promise(resolve => requestAnimationFrame(resolve));
    const isbn = await decodeBarcodeFile(file);
    if (generation !== scanGeneration || page !== target.page || !target.form && target.input !== $('#search')) return;
    if (target.form) {
      if (!target.form.isConnected || !$('#modal').open) return;
      $('#lookup-isbn').value = isbn; target.form.requestSubmit();
    } else if (page === 'check' && !$('#modal').open && query === target.query) {
      query = isbn; checkLabel = ''; $('#search').value = isbn; $('#check-volume').value = ''; renderResults();
    } else return;
    notify('อ่าน ISBN ได้แล้ว: ' + isbn);
  } catch (error) {
    if (generation === scanGeneration && page === target.page && (!target.form || target.form.isConnected)) notify(error.message || 'อ่านรูปไม่ได้ ลองพิมพ์ ISBN แทนได้');
  }
}
function download(text, name) { const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

document.addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.shelfView) {
    shelfView = button.dataset.shelfView;
    try { localStorage.setItem(`khanwai-shelf-view-v1:${account.user.id}`, shelfView); } catch { notify('เปลี่ยนมุมมองแล้ว แต่เบราว์เซอร์จำค่าไม่ได้'); }
    document.querySelectorAll('[data-shelf-view]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); renderResults();
  }
  if (button.id === 'shelf-select' || button.id === 'exit-shelf-selection') { selectionMode = button.id==='shelf-select' && !selectionMode; selectedSeries.clear(); render(); }
  if (button.id === 'clear-selection') { selectedSeries.clear(); renderResults(); }
  if (button.id === 'select-visible') { document.querySelectorAll('[data-select-series]').forEach(el => selectedSeries.add(el.dataset.selectSeries)); renderResults(); }
  if (button.id === 'clear-shelf-filters' || button.id === 'clear-shelf-all') { clearShelfFilters();if(button.id==='clear-shelf-all')query='';render(); }
  if(button.id==='apply-shelf-filters'||button.id==='close-shelf-filters'){ $('#shelf-filters').open=false; if(button.id==='apply-shelf-filters'){$('#shelf-result-count').focus({preventScroll:true});$('#shelf-result-count').scrollIntoView({block:'start'});}else $('#shelf-filters summary').focus(); }
  if(button.dataset.removeShelfFilter){const key=button.dataset.removeShelfFilter;if(key==='category')category='all';if(key==='format')bookFormat='all';if(key==='smart')smartFilter='all';if(key==='location')locationFilter='';if(key==='tag')tagFilter='';if(key==='reading')readingFilter='';render();$('#shelf-filters summary').focus({preventScroll:true});}

  if (button.id === 'open-trash') startTrash();
  if (button.id === 'random-unread') startUnreadPick();
  if (button.dataset.trashSeries && confirm('ย้ายทั้งฉบับและเล่มที่อยู่ในฉบับนี้ไปถังขยะ? กู้คืนได้ภายหลัง')) {
    if (await mutate(next => moveToTrash(next,'series',button.dataset.trashSeries))) { $('#modal').close(); render(); notify('ย้ายทั้งฉบับไปถังขยะแล้ว · รอเซิร์ฟเวอร์ยืนยัน'); }
  }
  if (button.id === 'bulk-edit') startBulkEdit();
  if (button.id === 'manage-categories') startCategoryManager();
  if (button.id === 'import-csv') startCsvImport();
  if (button.dataset.page) { page = button.dataset.page; selectedSeries.clear(); selectionMode = false; smartFilter = 'all'; locationFilter = ''; tagFilter = ''; readingFilter = ''; filter = 'all'; category = 'all'; bookFormat = 'all'; query = ''; checkLabel = ''; render(); window.scrollTo(0, 0); }
  if (button.hasAttribute('data-add')) openAdd();
  if (button.dataset.authMode) { authMode = button.dataset.authMode; renderAuth(); return; }
  if (button.id === 'resolve-conflict') openConflict({ store: account, openModal, heading: modalHeading, escape: esc, notify });
  if (button.id === 'sync-now') await account.sync();
  if (button.id === 'reload-app') location.reload();
  if (button.id === 'change-password') openPasswordChange({ openModal, heading: modalHeading });
  if (button.id === 'logout') { try { if (account.pending) await account.sync(); const discard = account.pending && confirm('ยังมีงานรอซิงก์ ต้องการละทิ้งงานในเครื่องและออกจากระบบหรือไม่? ส่งออกข้อมูลเก็บไว้ก่อนได้'); if (!account.pending || discard) await account.logout({ discard: Boolean(discard) }); } catch (error) { notify(error.message); } }
  if (button.id === 'delete-account') openDeleteAccount();
  if (button.id === 'reset-from-server') {
    openModal(`${modalHeading('กู้ข้อมูลจากเซิร์ฟเวอร์', 'ละทิ้งเฉพาะงานรอส่งของบัญชีนี้ในเครื่อง')}<p>ส่งออกงานในเครื่องก่อนเก็บไว้ได้ การยืนยันจะโหลดข้อมูลที่เซิร์ฟเวอร์มีและล้างคิวรอส่ง โดยไม่แก้ข้อมูลบนเซิร์ฟเวอร์</p><div class="form-actions"><button class="button" id="export">ส่งออกข้อมูล JSON</button><button class="button danger" id="confirm-reset-server">ยืนยันละทิ้งคิวและโหลดใหม่</button></div>`);
  }
  if (button.id === 'confirm-reset-server') {
    try { await account.resetFromServer(); $('#modal').close(); render(); } catch (error) { notify(error.message); }
  }
  if (button.id === 'load-samples') {
    if(await mutate(next=>{for(const sample of seedState().series){const existing=next.series.find(s=>s.id===sample.id);if(!existing)next.series.push(sample);else if(existing.sample&&existing.trashedAt){delete existing.trashedAt;for(const entry of existing.entries)if(sample.entries.some(e=>e.id===entry.id))delete entry.trashedAt;}}}))render();
  }
  if (button.id === 'import-legacy') { try { previewImport(migrateState(JSON.parse(localStorage.getItem(KEY)))); } catch (error) { notify('อ่านข้อมูลเดิมไม่ได้: ' + error.message); } }
  if (button.id === 'export-legacy') download(localStorage.getItem(KEY) ?? '{}', 'khanwai-legacy-backup.json');
  if (button.dataset.editPhoto) editEntryPhoto(button.dataset.series, button.dataset.editPhoto);
  if (button.dataset.editSeriesPhoto) editEntryPhoto(button.dataset.editSeriesPhoto);
  if (button.dataset.openGroup) openDetail(button.dataset.openGroup);
  if (button.dataset.linkEdition) openEditionLink(button.dataset.linkEdition);
  if (button.dataset.releaseTarget) openReleaseTarget(button.dataset.releaseTarget);
  if (button.dataset.addFormat) addOtherFormat(button.dataset.addFormat);
  if (button.dataset.editSeries) openEdit(button.dataset.editSeries);
  if (button.dataset.editEntry) openEdit(button.dataset.series, button.dataset.editEntry);
  if (button.dataset.addTo) openAdd(null, button.dataset.addTo);
  if (button.dataset.seriesReading) {
    if (button.dataset.saving) return;
    button.dataset.saving='true';
    const controls=[...document.querySelectorAll('[data-series-reading]')];controls.forEach(el=>el.disabled=true);
    const id=button.dataset.readingSeries,value=button.dataset.seriesReading;
    if (await mutate(next=>{const series=next.series.find(s=>s.id===id);if(!series||series.trashedAt)throw Error('ฉบับนี้ถูกลบแล้ว กรุณาเปิดใหม่');setSeriesReading(series,value);})) {
      render();openDetail(id);[...document.querySelectorAll('[data-series-reading]')].find(el=>el.dataset.seriesReading===value && el.dataset.readingSeries===id)?.focus({preventScroll:true});notify('บันทึกการอ่านทั้งชุดแล้ว · รอเซิร์ฟเวอร์ยืนยัน');
    } else { controls.forEach(el=>el.disabled=false);delete button.dataset.saving; }
  }
  if (button.dataset.detail) { if(selectionMode && page==='shelf' && !$('#modal').open){const id=button.dataset.detail;if(selectedSeries.has(id))selectedSeries.delete(id);else selectedSeries.add(id);updateSelectionBar();}else openDetail(button.dataset.detail); }
  if (button.hasAttribute('data-close')) $('#modal').close();
  if (button.dataset.filter) { filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); }); renderResults(); }
  if (button.dataset.review) openAdd(state.drafts.find(d => d.id === button.dataset.review));
  if (button.dataset.removeDraft && confirm('ย้ายรายการนี้ไปถังขยะ? กู้คืนได้ภายหลัง')) { if (await mutate(next => moveToTrash(next,'draft',button.dataset.removeDraft))) { render(); notify('ย้ายไปถังขยะแล้ว · รอเซิร์ฟเวอร์ยืนยัน'); } }
  if (button.dataset.deleteEntry && confirm('ย้ายรายการนี้ไปถังขยะ? กู้คืนข้อมูลและสถานะเดิมได้')) { if (await mutate(next => moveToTrash(next,'entry',button.dataset.deleteEntry))) { render(); openDetail(button.dataset.series); notify('ย้ายไปถังขยะแล้ว · รอเซิร์ฟเวอร์ยืนยัน'); } }
  if (button.id === 'clear-search') { query = ''; $('#search').value = ''; if (page === 'check') { checkLabel = ''; $('#check-volume').value = ''; } renderResults(); $('#search').focus(); }
  if (button.dataset.scan) {
    scanGeneration++;
    scanTarget = { page, query, input: $('#search'), form: $('#modal').open ? $('#lookup-form') : null };
    $(button.dataset.scan === 'camera' ? '#barcode-camera' : '#barcode-file').click();
  }
  if (button.id === 'export' || button.id === 'export-conflict') await exportCurrent();
  if (button.id === 'import') $('#import-file').click();
  if (button.id === 'clear-samples' && confirm('ลบเฉพาะรายการตัวอย่าง? รายการที่เพิ่มเองในเรื่องตัวอย่างจะย้ายเป็นเรื่องส่วนตัว')) {
    if (await mutate(next => {
      for(const series of next.series) if(series.sample && !series.trashedAt) {
        for(const entry of series.entries) if(!entry.trashedAt && /^(sample-|order-|box-|wish-)/.test(entry.id)) moveToTrash(next,'entry',entry.id);
        if(series.entries.every(e=>e.trashedAt)) moveToTrash(next,'series',series.id);
        else {series.sample=false;series.target=[];}
      }
    })) { render(); notify('ย้ายข้อมูลตัวอย่างไปถังขยะแล้ว'); }
  }
  if (button.id === 'install') {
    if (pendingInstall) { pendingInstall.prompt(); pendingInstall = null; }
    else $('#install-help').textContent = 'บน iPhone: เปิดใน Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม · บน Android/คอม: มองหา “ติดตั้งแอพ” ในเมนูเบราว์เซอร์ ตัวเลือกขึ้นอยู่กับอุปกรณ์ ต้องเปิดผ่าน localhost หรือ HTTPS';
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'lookup-isbn') { lookupController?.abort(); $('#lookup-result').textContent = ''; }
  if (event.target.id === 'search') { query = event.target.value; renderResults(); }
  if (event.target.id === 'check-volume') { checkLabel = event.target.value; renderResults(); }
  if (event.target.closest('#review-form') && event.target.id !== 'confirm-duplicate') $('#duplicate-warning').innerHTML = '';
});
document.addEventListener('change', async event => {
  const target = event.target;
  if (target.dataset.selectSeries) { if(target.checked) selectedSeries.add(target.dataset.selectSeries); else selectedSeries.delete(target.dataset.selectSeries); updateSelectionBar(); }
  if (['shelf-smart','shelf-location','shelf-tag','shelf-reading'].includes(target.id)) {
    if(target.id==='shelf-smart') smartFilter=target.value;
    if(target.id==='shelf-location') locationFilter=target.value;
    if(target.id==='shelf-reading') readingFilter=target.value;
    if(target.id==='shelf-tag') tagFilter=target.value;
    renderResults();
  }
  if (target.id === 'shelf-order' && Object.hasOwn(SHELF_ORDERS, target.value)) {
    shelfOrder = target.value;
    try { localStorage.setItem(`khanwai-shelf-order-v1:${account.user.id}`, shelfOrder); } catch { notify('เรียงแล้ว แต่เบราว์เซอร์จำค่าที่เลือกไม่ได้'); }
    renderResults();
  }
  if (target.id === 'category') { category = target.value; renderResults(); }
  if (target.id === 'format-filter') { bookFormat = target.value; renderResults(); }
  if (target.dataset.entryReading) {
    const id=target.dataset.series, entryId=target.dataset.entryReading, member=target.dataset.readingMember, scroll=$('#modal').scrollTop;
    const expanded=[...document.querySelectorAll('[data-box-reading][open]')].map(el=>el.dataset.boxReading);
    if (await mutate(next=>{const entry=next.series.find(s=>s.id===id&&!s.trashedAt)?.entries.find(e=>e.id===target.dataset.entryReading);if(!entry||entry.trashedAt)throw Error('รายการเปลี่ยนไปแล้ว กรุณาเปิดใหม่');setReading(entry,target.value,target.dataset.readingMember);})) {render();openDetail(id);document.querySelectorAll('[data-box-reading]').forEach(el=>el.open=expanded.includes(el.dataset.boxReading));[...document.querySelectorAll('[data-entry-reading]')].find(el=>el.dataset.entryReading===entryId && el.dataset.readingMember===member)?.focus({preventScroll:true});$('#modal').scrollTop=scroll;notify('บันทึกการอ่านแล้ว · รอเซิร์ฟเวอร์ยืนยัน');}
  }
  if (target.dataset.entryStatus) {
    const id=target.dataset.series,entryId=target.dataset.entryStatus,scroll=$('#modal').scrollTop;
    const expanded=[...document.querySelectorAll('[data-box-reading][open]')].map(el=>el.dataset.boxReading);
    if (await mutate(next => { const entry=next.series.find(s=>s.id===id&&!s.trashedAt)?.entries.find(e=>e.id===entryId);if(!entry||entry.trashedAt)throw Error('รายการเปลี่ยนไปแล้ว กรุณาเปิดใหม่');entry.status=target.value; })) {
      render();openDetail(id);document.querySelectorAll('[data-box-reading]').forEach(el=>el.open=expanded.includes(el.dataset.boxReading));[...document.querySelectorAll('[data-entry-status]')].find(el=>el.dataset.entryStatus===entryId)?.focus({preventScroll:true});$('#modal').scrollTop=scroll;notify('เปลี่ยนสถานะแล้ว · รอเซิร์ฟเวอร์ยืนยัน');
    }
  }
});
document.querySelectorAll('#barcode-file, #barcode-camera').forEach(input => input.addEventListener('change', event => { scanImage(event.target.files[0], scanTarget); event.target.value = ''; }));
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  try {
    if (file.size > 50 * 1024 * 1024) throw Error('ไฟล์ใหญ่เกิน 50 MB กรุณาแบ่งนำเข้าเป็นชุด');
    previewImport(migrateState(JSON.parse(await file.text())));
  } catch (error) { notify(`นำเข้าไม่ได้: ${error.message}`); }
});
$('#modal').addEventListener('close', () => { lookupController?.abort(); if (!$('#modal').open && account.user && !account.needsLogin && refreshAfterModal) renderPreservingFocus(); });
$('#auth-modal').addEventListener('cancel', event => { if (account.needsLogin) event.preventDefault(); });
window.addEventListener('storage', event => {
  if (event.key === 'khanwai-last-user-v1' && account.user) {
    let user; try { user = JSON.parse(event.newValue); } catch {}
    if (user?.id !== account.user.id) { account.needsLogin = true; render(); }
  }
});
function connection() {
  $('#connection').textContent = account.status;
  $('#connection').classList.toggle('pending', Boolean(account.pending || account.cache?.conflict));
  $('#footer-status').textContent = account.user ? 'ชั้นส่วนตัว · ' + account.status : 'ชั้นหนังสือส่วนตัว';
}
$('#connection').addEventListener('click', () => { if (account.cache?.conflict) openConflict({ store: account, openModal, heading: modalHeading, escape: esc, notify }); else account.sync(); });
window.addEventListener('online', () => account.sync());
window.addEventListener('offline', () => { account.online = false; account.status = account.pending ? `ออฟไลน์ · รอซิงก์ ${account.pending} รายการ` : 'ออฟไลน์ · ข้อมูลที่เคยโหลด'; connection(); });
window.addEventListener('focus', () => { if (!$('#modal').open) account.sync(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#modal').open) account.sync(); });
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); pendingInstall = event; });
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(() => account.photoAccount()).catch(() => notify('ยังเตรียมโหมดออฟไลน์ไม่ได้ ใช้ออนไลน์ต่อได้'));
  navigator.serviceWorker.addEventListener('controllerchange', () => account.photoAccount());
}
setInterval(() => { if (!document.hidden && !$('#modal').open) account.sync(); }, 15000);
$('#main').innerHTML = '<div class="empty"><h2>กำลังเปิดชั้นหนังสือ…</h2><p>ตรวจบัญชีและข้อมูลที่เก็บไว้</p></div>';
account.boot().catch(error => { storageError = 'เปิดพื้นที่เก็บข้อมูลในเครื่องไม่ได้: ' + error.message; account.needsLogin = true; render(); });

// The management menu is a lightweight disclosure, not a modal dialog.
document.addEventListener('pointerdown',event=>{const menu=document.querySelector('.shelf-manage[open]');if(menu&&!menu.contains(event.target))menu.open=false;});
document.addEventListener('keydown',event=>{if(event.key!=='Escape'||$('#modal').open)return;const disclosure=document.querySelector('.shelf-manage[open]')||document.querySelector('.shelf-filters[open]');if(disclosure){disclosure.open=false;disclosure.querySelector('summary').focus();event.preventDefault();}});

// Native disclosures keep each volume's secondary actions out of its reading controls.
document.addEventListener('pointerdown',event=>{document.querySelectorAll('.entry-actions[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});});
document.addEventListener('toggle',event=>{if(event.target.matches?.('.entry-actions')&&event.target.open)document.querySelectorAll('.entry-actions[open]').forEach(menu=>{if(menu!==event.target)menu.open=false;});},true);
$('#modal').addEventListener('cancel',event=>{const menu=$('#modal .entry-actions[open]');if(menu){event.preventDefault();menu.open=false;menu.querySelector('summary').focus();}});
