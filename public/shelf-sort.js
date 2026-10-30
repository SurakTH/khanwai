export const SHELF_ORDERS = {
  newest: 'เพิ่มล่าสุด', oldest: 'เพิ่มเก่าสุด', title: 'ชื่อเรื่อง ก–ฮ / A–Z',
  'title-desc': 'ชื่อเรื่องย้อนกลับ', updated: 'แก้ไขล่าสุด', author: 'ผู้เขียน ก–ฮ / A–Z',
};
const collator = new Intl.Collator('th', { numeric: true, sensitivity: 'base' });
const text = value => String(value ?? '').trim();
// Thai first, then Latin, numbers and other scripts. Thai collation handles leading vowels.
function group(value) { return /^[\u0E00-\u0E7F]/u.test(value) ? 0 : /^[A-Za-z]/u.test(value) ? 1 : /^\d/u.test(value) ? 2 : 3; }
function compareText(a, b) {
  a = text(a); b = text(b);
  return group(a) - group(b) || collator.compare(a, b);
}
function date(value) { const n = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(n) ? n : null; }
function added(series) {
  return date(series.createdAt) ?? extrema(series.entries.map(e => date(e.createdAt) ?? date(e.reviewedAt)), Math.min);
}
function extrema(values, fn) { const known = values.filter(v => v !== null); return known.length ? fn(...known) : null; }
function updated(series) {
  return extrema([added(series), date(series.updatedAt), ...series.entries.flatMap(e => [date(e.updatedAt), date(e.createdAt), date(e.reviewedAt)])], Math.max);
}
function compareDates(a, b, descending) {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return descending ? b - a : a - b;
}
export function sortShelf(series, order = 'newest') {
  if (!Object.hasOwn(SHELF_ORDERS, order)) order = 'newest';
  return [...series].sort((a, b) => {
    let result;
    if (order === 'title' || order === 'title-desc') result = compareText(a.title, b.title) * (order === 'title-desc' ? -1 : 1);
    else if (order === 'author') result = !text(a.author) || !text(b.author) ? Number(!text(a.author)) - Number(!text(b.author)) : compareText(a.author, b.author);
    else result = compareDates(order === 'updated' ? updated(a) : added(a), order === 'updated' ? updated(b) : added(b), order !== 'oldest');
    return result || compareText(a.title, b.title) || collator.compare(text(a.edition), text(b.edition)) || text(a.id).localeCompare(text(b.id));
  });
}
// Stamp only changed records: editing one volume must not revise unrelated records.
export function stampShelfChanges(before, after, now = new Date().toISOString()) {
  const previous = new Map(before.series.map(s => [s.id, s]));
  for (const series of after.series) {
    const old = previous.get(series.id);
    const { entries, ...fields } = series;
    const { entries: oldEntries, ...oldFields } = old ?? {};
    if (!old) { series.createdAt ??= new Date(added(series) ?? Date.parse(now)).toISOString(); series.updatedAt ??= new Date(updated(series) ?? Date.parse(now)).toISOString(); }
    else if (JSON.stringify(fields) !== JSON.stringify(oldFields) || oldEntries.some(e => !entries.some(n => n.id === e.id))) series.updatedAt = now;
    const previousEntries = new Map((oldEntries ?? []).map(e => [e.id, e]));
    for (const entry of entries) {
      const prior = previousEntries.get(entry.id);
      if (!prior) { entry.createdAt ??= entry.reviewedAt ?? now; entry.updatedAt ??= entry.createdAt; }
      else if (JSON.stringify(entry) !== JSON.stringify(prior)) entry.updatedAt = now;
    }
  }
}
