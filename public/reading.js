export const READING_STATUSES = { unread: 'ยังไม่อ่าน', planned: 'อยากอ่าน', reading: 'กำลังอ่าน', read: 'อ่านแล้ว' };
export const readingLabel = value => Object.hasOwn(READING_STATUSES,value) ? READING_STATUSES[value] : READING_STATUSES.unread;
export function readingOptions(value = 'unread') {
  value = value || 'unread';
  return Object.entries(READING_STATUSES).map(([key,label])=>`<option value="${key}" ${value===key?'selected':''}>${label}</option>`).join('');
}
export function validateReading(item) {
  const valid = value => typeof value === 'string' && (value === '' || Object.hasOwn(READING_STATUSES,value));
  if (item.readingStatus !== undefined && !valid(item.readingStatus)) throw Error('สถานะการอ่านไม่ถูกต้อง');
  if (item.readingByMember !== undefined) {
    const map = item.readingByMember;
    if (item.kind !== 'box' || !map || typeof map !== 'object' || Array.isArray(map) || Object.keys(map).length > 1000 || Object.entries(map).some(([label,value])=>!item.members?.includes(label)||!valid(value))) throw Error('สถานะการอ่านของเล่มในบ็อกซ์ไม่ถูกต้อง');
  }
}
export function readingItems(entry) {
  return [...new Set(entry.kind === 'box' && entry.members.length ? entry.members : [entry.label])].map(label=>({label,status:entry.kind==='box' && Object.hasOwn(entry.readingByMember ?? {},label) ? entry.readingByMember[label] || 'unread' : entry.readingStatus || 'unread'}));
}
export function setReading(entry, value, member) {
  if (value !== '' && !Object.hasOwn(READING_STATUSES,value)) throw Error('สถานะการอ่านไม่ถูกต้อง');
  if (member !== undefined) {
    if (entry.kind !== 'box' || !entry.members.includes(member)) throw Error('เล่มนี้ไม่อยู่ในบ็อกซ์แล้ว กรุณาเปิดรายละเอียดใหม่');
    entry.readingByMember = Object.fromEntries([...Object.entries(entry.readingByMember ?? {}).filter(([key])=>key!==member),[member,value]]);
  } else { entry.readingStatus = value; if(entry.kind==='box')entry.readingByMember={}; }
}
export function matchesReading(entry, filter) { return !filter || readingItems(entry).some(item=>item.status === (filter==='unknown'?'unread':filter)); }
// A second copy does not erase that this volume has been read. Editions/formats remain separate.
export function readingSummary(series) {
  const ranks = {'':0,unread:1,planned:2,reading:3,read:4}, labels = new Map();
  for (const entry of series.entries) for (const item of readingItems(entry)) if(!labels.has(item.label) || ranks[item.status]>ranks[labels.get(item.label)]) labels.set(item.label,item.status);
  return Object.fromEntries(['read','reading','planned','unread',''].map(status=>[status,[...labels.values()].filter(s=>s===status).length]));
}
export function readingSummaryText(series) { return Object.entries(readingSummary(series)).filter(([,count])=>count).map(([status,count])=>`${readingLabel(status)} ${count}`).join(' · ') || 'ยังไม่มีเล่มในฉบับนี้'; }
export function entryReadingOptions(entry) {
  const statuses = [...new Set(readingItems(entry).map(item=>item.status))];
  if (statuses.length > 1) return '<option value="mixed" disabled selected>ต่างกันแต่ละเล่ม</option>' + readingOptions().replaceAll(' selected','');
  return readingOptions(statuses[0] ?? entry.readingStatus);
}

export function setSeriesReading(series, value) {
  if (!Object.hasOwn(READING_STATUSES,value)) throw Error('สถานะการอ่านไม่ถูกต้อง');
  for (const entry of series.entries) setReading(entry,value);
}
