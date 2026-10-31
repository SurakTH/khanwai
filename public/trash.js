// Retain the original owner-scoped records and photo references for recovery.
export function validateTrash(item) {
  if (item.trashedAt !== undefined && (typeof item.trashedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(item.trashedAt) || !Number.isFinite(Date.parse(item.trashedAt)) || new Date(item.trashedAt).toISOString() !== item.trashedAt)) throw Error('วันที่ย้ายเข้าถังขยะไม่ถูกต้อง');
}
export function activeLibrary(state) {
  return { ...state, series: state.series.filter(s => !s.trashedAt).map(s => ({ ...s, entries: s.entries.filter(e => !e.trashedAt) })), drafts: state.drafts.filter(d => !d.trashedAt) };
}
export function trashItems(state) {
  const items = [];
  for (const series of state.series) {
    if (series.trashedAt) items.push({ kind: 'series', id: series.id, record: series, series, date: series.trashedAt });
    else for (const entry of series.entries) if (entry.trashedAt) items.push({ kind: 'entry', id: entry.id, record: entry, series, date: entry.trashedAt });
  }
  for (const draft of state.drafts) if (draft.trashedAt) items.push({ kind: 'draft', id: draft.id, record: draft, date: draft.trashedAt });
  return items.sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
function findRecord(state, kind, id) {
  if (kind === 'series') return state.series.find(s => s.id === id);
  if (kind === 'draft') return state.drafts.find(d => d.id === id);
  if (kind === 'entry') return state.series.flatMap(s => s.entries).find(e => e.id === id);
  throw Error('ชนิดรายการไม่ถูกต้อง');
}
export function moveToTrash(state, kind, id, now = new Date().toISOString()) {
  if(kind==='entry'&&state.series.some(s=>s.trashedAt&&s.entries.some(e=>e.id===id)))throw Error('ฉบับนี้อยู่ในถังขยะแล้ว กรุณาเปิดใหม่');
  const record = findRecord(state,kind,id);
  if (!record || record.trashedAt) throw Error('รายการนี้เปลี่ยนไปแล้ว กรุณาเปิดใหม่');
  validateTrash({ trashedAt: now }); record.trashedAt = now;
}
export function restoreFromTrash(state, kind, id) {
  const item = trashItems(state).find(item => item.kind === kind && item.id === id);
  if (!item) throw Error('รายการนี้กู้คืนแล้วหรือเปลี่ยนไป กรุณาเปิดถังขยะใหม่');
  delete item.record.trashedAt;
}
