import { matchesReading, setReading } from './reading.js';
import { coverage, STATUSES } from './lib.js';
export const tagKey = value => value.trim().normalize('NFC').toLocaleLowerCase('th');
export function parseTags(value) {
  const result = [], seen = new Set();
  for (const raw of String(value ?? '').split(/[,;|\n]/)) {
    const tag = raw.trim().normalize('NFC'); if (!tag) continue;
    if (tag.length > 50) throw Error('แท็กแต่ละอันยาวได้ไม่เกิน 50 ตัวอักษร');
    if (!seen.has(tagKey(tag))) { result.push(tag); seen.add(tagKey(tag)); }
  }
  if (result.length > 30) throw Error('ใส่แท็กได้ไม่เกิน 30 แท็กต่อฉบับ');
  return result;
}
export function targetLabels(value) {
  const labels = new Set();
  for (const part of String(value ?? '').split(/[,;|\n]/).map(s => s.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const a = Number(range[1]), b = Number(range[2]);
      if (b < a || b - a >= 1000) throw Error('ช่วงเลขเป้าหมายไม่ถูกต้อง หรือเกิน 1,000 เล่ม');
      for (let n = a; n <= b; n++) labels.add(String(n));
    } else { if (part.length > 80) throw Error('เลขเล่มยาวเกินไป'); labels.add(part); }
    if (labels.size > 1000) throw Error('กำหนดเป้าหมายได้ไม่เกิน 1,000 เล่ม');
  }
  return [...labels];
}
export function collectionSummary(series) {
  const owned = coverage(series), ordered = coverage(series, 'ordered').filter(l => !owned.includes(l));
  const target = [...new Set(series.target ?? [])];
  return { owned, ordered, target, incomplete: target.some(l => !owned.includes(l)),
    missing: target.filter(l => !owned.includes(l) && !ordered.includes(l)) };
}
export function filterShelf(series, { smart = 'all', location = '', tag = '', reading = '' } = {}) {
  return series.filter(s => ((!location && !reading) || s.entries.some(e => (!location || (e.location ?? '').trim() === location) && matchesReading(e, reading))) &&
    (!tag || (s.tags ?? []).some(t => tagKey(t) === tagKey(tag))) &&
    (smart === 'all' || smart === 'incomplete' && collectionSummary(s).incomplete ||
      smart === 'no-cover' && !s.coverData && !s.entries.some(e => e.coverData) ||
      smart === 'no-location' && s.entries.some(e => !(e.location ?? '').trim())));
}
export function bulkPatch(state, entryIds, patch) {
  const ids = new Set(entryIds); if (!ids.size) throw Error('เลือกอย่างน้อยหนึ่งรายการ');
  if (patch.status !== undefined && !Object.hasOwn(STATUSES, patch.status)) throw Error('สถานะไม่ถูกต้อง');
  if (patch.location !== undefined && (typeof patch.location !== 'string' || patch.location.length > 150)) throw Error('ที่เก็บยาวเกินไป');
  if (patch.tagMode && !['add','replace','remove'].includes(patch.tagMode)) throw Error('วิธีแก้แท็กไม่ถูกต้อง');
  const tags = patch.tagMode ? parseTags(patch.tags) : [];
  const found = [];
  for (const series of state.series) {
    const selected = series.entries.filter(e => ids.has(e.id)); if (!selected.length) continue;
    found.push(...selected.map(e => e.id));
    if (patch.readingStatus !== undefined) for (const entry of selected) setReading(entry,patch.readingStatus);
    for (const entry of selected) for (const key of ['status','location']) if (patch[key] !== undefined) entry[key] = patch[key];
    if (patch.tagMode) {
      series.tags = patch.tagMode === 'replace' ? tags : patch.tagMode === 'add' ? parseTags([...(series.tags ?? []), ...tags].join(',')) : (series.tags ?? []).filter(t => !tags.some(v => tagKey(t) === tagKey(v)));
    }
  }
  if (found.length !== ids.size) throw Error('บางรายการถูกลบหรือเปลี่ยนไปแล้ว กรุณาเลือกใหม่');
}
