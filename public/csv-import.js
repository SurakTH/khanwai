import { categoryList, categoryOptions, categoryKey } from './categories.js';
import { READING_STATUSES } from './reading.js';
import { FORMATS, STATUSES, normalizeIsbn, matchingEntries, validateState } from './lib.js';
import { parseTags, targetLabels, tagKey } from './shelf-tools.js';
import { newId } from './ids.js';
export const CSV_FIELDS = { readingStatus:'สถานะการอ่าน', title:'ชื่อเรื่อง', author:'ผู้เขียน', edition:'ฉบับ', language:'ภาษา', format:'รูปแบบหนังสือ', category:'ประเภท', label:'เลขเล่ม / ชื่อบ็อกซ์', isbn:'ISBN', status:'สถานะ', quantity:'จำนวนสำเนา', location:'ที่เก็บ / แพลตฟอร์ม', tags:'แท็ก', target:'เลขเป้าหมายของชุด', kind:'ชนิดรายการ', members:'สมาชิกบ็อกซ์' };
export function parseCsv(text, delimiter = ',') {
  if (typeof text !== 'string' || text.length > 2 * 1024 * 1024) throw Error('ไฟล์ใหญ่เกิน 2 MB');
  if (![',',';','\t'].includes(delimiter)) throw Error('ตัวคั่นไม่ถูกต้อง');
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], field = '', quoted = false, closed = false;
  const pushField = () => { if (field.length > 5000) throw Error('ข้อมูลในช่องยาวเกิน 5,000 ตัวอักษร'); row.push(field); field = ''; closed = false; if (row.length > 100) throw Error('คอลัมน์เกิน 100 ช่อง'); };
  const pushRow = () => { pushField(); if (row.some(s => s.trim())) rows.push(row); row = []; if (rows.length > 1001) throw Error('นำเข้าได้ครั้งละไม่เกิน 1,000 รายการ'); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } } else field += c; }
    else if (c === delimiter) pushField();
    else if (c === '\r' || c === '\n') { if (c === '\r' && text[i+1] === '\n') i++; pushRow(); }
    else if (c === '"') { if (field || closed) throw Error('เครื่องหมายคำพูดใน CSV ไม่ถูกต้อง'); quoted = true; }
    else { if (closed) { if (c === ' ' || c === '\t') continue; throw Error('มีข้อความหลังปิดเครื่องหมายคำพูด'); } field += c; }
  }
  if (quoted) throw Error('CSV มีเครื่องหมายคำพูดที่ยังปิดไม่ครบ');
  if (field || row.length || closed) pushRow();
  if (rows.length < 2) throw Error('ต้องมีหัวคอลัมน์และข้อมูลอย่างน้อยหนึ่งแถว');
  const headers = rows.shift().map(s => s.trim());
  if (headers.some(s => !s) || new Set(headers).size !== headers.length) throw Error('หัวคอลัมน์ต้องมีชื่อและไม่ซ้ำกัน');
  if (rows.some(r => r.length !== headers.length)) throw Error('จำนวนช่องแต่ละแถวไม่ตรงกับหัวคอลัมน์ ตรวจตัวคั่นหรือเครื่องหมายคำพูด');
  return { headers, rows };
}
const aliases = { readingStatus:['readingstatus','reading_status','สถานะการอ่าน'], title:['title','ชื่อเรื่อง','ชื่อหนังสือ'],author:['author','ผู้เขียน'],edition:['edition','ฉบับ'],language:['language','ภาษา'],format:['format','รูปแบบ','รูปแบบหนังสือ'],category:['category','ประเภท'],label:['label','volume','เลขเล่ม'],isbn:['isbn'],status:['status','สถานะ'],quantity:['quantity','จำนวน'],location:['location','ที่เก็บ','แพลตฟอร์ม'],tags:['tags','แท็ก'],target:['target','เป้าหมาย'],kind:['kind','ชนิดรายการ'],members:['members','สมาชิกบ็อกซ์'] };
export function autoMapping(headers) {
  return Object.fromEntries(Object.keys(CSV_FIELDS).map(key => [key, headers.findIndex(h => aliases[key].includes(h.trim().toLocaleLowerCase('th')))]));
}
export function csvCandidates(table, mapping, defaults) {
  if (!Number.isInteger(mapping.title) || mapping.title < 0) throw Error('เลือกคอลัมน์ชื่อเรื่องก่อน');
  const indexes = Object.values(mapping).filter(n => n >= 0);
  if (new Set(indexes).size !== indexes.length) throw Error('คอลัมน์หนึ่งใช้จับคู่ได้เพียงข้อมูลเดียว');
  return table.rows.map((row, index) => ({ index, selected:true, ...Object.fromEntries(Object.keys(CSV_FIELDS).map(key => [key, mapping[key] >= 0 ? row[mapping[key]].trim() : defaults[key] ?? ''])) }));
}
function enumValue(raw, values) {
  const normalized = String(raw).trim();
  return Object.hasOwn(values, normalized) ? normalized : Object.keys(values).find(k => values[k] === normalized) ?? '';
}
const identity = s => [s.title,s.author,s.edition,s.language,s.format].map(v => String(v).trim().normalize('NFC').toLocaleLowerCase('th')).join('\u0000');
function rowData(row, state) {
  const format = enumValue(row.format, FORMATS), status = enumValue(row.status, STATUSES);
  if (!format) throw Error('เลือกรูปแบบหนังสือเล่มหรือ ebook');
  if (!status) throw Error('เลือกสถานะมีแล้ว รอส่ง หรืออยากซื้อ');
  if (!row.title.trim() || !row.edition.trim() || !row.language.trim() || !row.label.trim()) throw Error('กรอกชื่อเรื่อง ฉบับ ภาษา และเลขเล่มให้ครบ');
  const category = categoryList(state).find(name => categoryKey(name) === categoryKey(row.category));
  if (!category) throw Error('เลือกหมวดหมู่ที่มีอยู่ หรือเพิ่มหมวดหมู่ในตั้งค่าก่อน');
  const isbn = row.isbn.trim() ? normalizeIsbn(row.isbn) : '';
  if (row.isbn.trim() && !isbn) throw Error('ISBN ไม่ถูกต้อง (ถ้า Excel เปลี่ยนเป็นเลขวิทยาศาสตร์ ให้แก้เป็นข้อความ)');
  const kind = ['','volume','เล่ม'].includes(row.kind) ? 'volume' : ['box','บ็อกซ์'].includes(row.kind) ? 'box' : '';
  if (!kind) throw Error('ชนิดรายการใช้ volume หรือ box');
  if (kind === 'volume' && row.members.trim()) throw Error('สมาชิกบ็อกซ์ต้องใช้ชนิด box');
  const readingRaw = String(row.readingStatus ?? '').trim();
  const readingStatus = readingRaw === 'ตั้งใจจะอ่าน' ? 'planned' : readingRaw ? enumValue(readingRaw,READING_STATUSES) : 'unread';
  if(readingRaw && !readingStatus) throw Error('สถานะการอ่านไม่ถูกต้อง');
  const quantity = row.quantity.trim() ? Number(row.quantity) : 1;
  const series = { id:'candidate-series', title:row.title.trim(),author:row.author.trim(),alias:'',edition:row.edition.trim(),language:row.language.trim(),format,category,tags:parseTags(row.tags),entries:[],target:targetLabels(row.target) };
  const entry = { id:'candidate-entry',kind,label:row.label.trim(),isbn,quantity,status,readingStatus,location:row.location.trim(),source:'CSV · ตรวจแล้ว',...(kind === 'box' ? { members:targetLabels(row.members) } : {}) };
  if (kind === 'box' && !entry.members.length) throw Error('ระบุเล่มในบ็อกซ์ก่อนนำเข้า เพื่อเช็กซ้ำได้ถูกต้อง');
  validateState({schemaVersion:2,series:[{...series,entries:[entry]}],drafts:[]});
  return {series,entry};
}
// This is a plan only. Existing records are never overwritten or tagged by a skipped row.
export function planCsv(state, candidates, idFactory = newId) {
  const next = structuredClone(state), results = [], additions = [];
  for (const row of candidates) {
    try {
      if (!row.selected) { results.push({index:row.index,status:'excluded',message:'เว้นไว้'}); continue; }
      const {series,entry} = rowData(row, next);
      const matches = next.series.filter(s => identity(s) === identity(series));
      if (matches.length > 1) throw Error('พบฉบับเดิมหลายรายการที่ข้อมูลตรงกัน โปรดแยกฉบับให้ชัดก่อน');
      let target = matches[0];
      const sameIsbn = entry.isbn && next.series.some(s => s.format === series.format && s.entries.some(e => normalizeIsbn(e.isbn) === entry.isbn));
      const overlap = target && (matchingEntries(target,entry).length || entry.kind === 'box' && target.entries.some(e => (e.kind === 'box'?e.members:[e.label]).some(l => entry.members.includes(l))));
      if (sameIsbn || overlap) { results.push({index:row.index,status:'duplicate',message:sameIsbn?'ISBN นี้มีในชั้นหรือไฟล์แล้ว':'เลขเล่มซ้ำหรืออยู่ในบ็อกซ์แล้ว'}); continue; }
      if (target && series.target.length && target.target?.length && JSON.stringify([...series.target].sort()) !== JSON.stringify([...target.target].sort())) throw Error('เป้าหมายของชุดไม่ตรงกับฉบับเดิม แก้เป้าหมายให้ตรงหรือเว้นว่าง');
      if (!target) { target = {...series,id:idFactory(),entries:[]}; next.series.push(target); }
      else {
        target.tags = parseTags([...(target.tags ?? []),...series.tags].join(','));
        if (!target.target?.length && series.target.length) target.target = series.target;
      }
      const added = {...entry,id:idFactory(),reviewedAt:new Date().toISOString()};target.entries.push(added);
      additions.push({index:row.index,seriesId:target.id,entryId:added.id});results.push({index:row.index,status:'ready',message:'พร้อมเพิ่ม'});
    } catch (error) { results.push({index:row.index,status:'error',message:error.message}); }
  }
  validateState(next);
  return {next,results,additions};
}
export function csvFingerprint(plan) { return JSON.stringify(plan.results.map(r => [r.index,r.status,r.message])); }
export const CSV_TEMPLATE = '\uFEFFtitle,author,edition,language,format,category,label,isbn,status,quantity,location,tags,target,kind,members,readingStatus\r\nเรื่องตัวอย่าง,ผู้เขียนตัวอย่าง,ฉบับธรรมดา,ไทย,physical,การ์ตูน,1,,owned,1,ตู้ A,ฉบับสะสม,1-3,volume,,unread\r\n';
