import { validateTrash } from './trash.js';
import { DEFAULT_CATEGORIES, validateCategoryList, validateCategoryName } from './categories.js';
import { validateReading } from './reading.js';
export const STATUSES = { owned: 'มีแล้ว', ordered: 'รอส่ง', wishlist: 'อยากซื้อ' };
export const CATEGORIES = DEFAULT_CATEGORIES;
export const FORMATS = { physical: 'หนังสือเล่ม', ebook: 'ebook' };
export const normalizeText = text => String(text ?? '').normalize('NFKC').trim().toLocaleLowerCase('th');

export function normalizeIsbn(input) {
  const value = String(input ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(value)) {
    const sum = [...value].reduce((n, c, i) => n + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
    if (sum % 11) return null;
    const base = '978' + value.slice(0, 9);
    const check = (10 - [...base].reduce((n, c, i) => n + Number(c) * (i % 2 ? 3 : 1), 0) % 10) % 10;
    return base + check;
  }
  if (!/^97[89]\d{10}$/.test(value)) return null;
  const sum = [...value].reduce((n, c, i) => n + Number(c) * (i % 2 ? 3 : 1), 0);
  return sum % 10 === 0 ? value : null;
}

export function coverage(series, status = 'owned') {
  return [...new Set(series.entries.filter(e => !e.trashedAt && e.status === status).flatMap(e => e.kind === 'box' ? e.members : [e.label]))]
    .sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
}

export function matchingEntries(series, entry) {
  const isbn = normalizeIsbn(entry.isbn);
  return series.entries.filter(e => !e.trashedAt && ((isbn && normalizeIsbn(e.isbn) === isbn) ||
    (entry.kind !== 'box' && (e.kind === 'box' ? e.members.includes(entry.label) : e.label === entry.label))));
}

export function searchLibrary(series, query = '', filter = 'all', format = 'all') {
  const text = normalizeText(query);
  const isbn = normalizeIsbn(query);
  return series.filter(s => {
    const statusMatches = filter === 'all' || !Object.hasOwn(STATUSES,filter) && normalizeText(s.category) === normalizeText(filter) ||
      s.entries.some(e => e.status === filter);
    const haystack = normalizeText([s.title, s.author, s.alias, s.edition, s.language, ...(s.tags ?? []),
      ...s.entries.flatMap(e => [e.label, e.isbn, e.location])].join(' '));
    return (format === 'all' || s.format === format) && statusMatches && (!text || haystack.includes(text) || isbn && s.entries.some(e => normalizeIsbn(e.isbn) === isbn));
  }).sort((a, b) => {
    if (!isbn) return 0;
    return Number(b.entries.some(e => normalizeIsbn(e.isbn) === isbn)) - Number(a.entries.some(e => normalizeIsbn(e.isbn) === isbn));
  });
}

function requireText(value, max = 300, empty = false) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw new Error('ข้อมูลข้อความไม่ถูกต้อง');
}

function validateOptionalMedia(item) {
  validateTrash(item);
  if (item.tags !== undefined) {
    if (!Array.isArray(item.tags) || item.tags.length > 30) throw Error('แท็กไม่ถูกต้อง');
    for (const tag of item.tags) requireText(tag, 50);
  }
  if (item.location !== undefined) requireText(item.location, 150, true);
  if (item.coverData !== undefined && item.coverData !== '' && (typeof item.coverData !== 'string' || item.coverData.length > 450000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(item.coverData) && !/^\/api\/photos\/[a-f0-9]{64}$/.test(item.coverData))) throw new Error('รูปปกไม่ถูกต้องหรือใหญ่เกินไป');
}

export function validateState(data) {
  if (!data || data.schemaVersion !== 2 || !Array.isArray(data.series) || !Array.isArray(data.drafts) ||
      data.series.length > 5000 || data.drafts.length > 1000) throw new Error('รูปแบบข้อมูลหรือเวอร์ชันไม่รองรับ');
  if(data.categories!==undefined) validateCategoryList(data.categories);
  const ids = new Set();
  function id(value) {
    requireText(value, 100);
    if (ids.has(value)) throw new Error('พบ ID ซ้ำ');
    ids.add(value);
  }
  for (const s of data.series) {
    validateOptionalMedia(s);
    if(s.metadataSeed!==undefined){
      const seed=s.metadataSeed;
      if(!seed||typeof seed!=='object'||!normalizeIsbn(seed.isbn))throw Error('ISBN ต้นทางของชุดไม่ถูกต้อง');
      requireText(seed.label,80);requireText(seed.source,300,true);
    }
    id(s.id);
    requireText(s.title); requireText(s.author, 300, true); requireText(s.alias, 300, true);
    requireText(s.edition); requireText(s.language); requireText(s.category);
    if (!Object.hasOwn(FORMATS, s.format)) throw new Error('รูปแบบหนังสือไม่ถูกต้อง');
    validateCategoryName(s.category);
    if (!Array.isArray(s.entries) || s.entries.length > 5000) throw new Error('ข้อมูลชุดไม่ถูกต้อง');
    if (s.target !== undefined && (!Array.isArray(s.target) || s.target.length > 1000)) throw new Error('ข้อมูลเล่มเป้าหมายไม่ถูกต้อง');
    for (const label of s.target ?? []) requireText(label, 80);
    for (const e of s.entries) {
      validateOptionalMedia(e); validateReading(e);
      id(e.id);
      requireText(e.label, 80); requireText(e.isbn, 30, true);
      if (e.isbn && !normalizeIsbn(e.isbn)) throw new Error('พบ ISBN ที่ไม่ถูกต้อง');
      if (!Object.hasOwn(STATUSES, e.status) || !['volume', 'box'].includes(e.kind) ||
          !Number.isInteger(e.quantity) || e.quantity < 1 || e.quantity > 999) throw new Error('สถานะหรือจำนวนไม่ถูกต้อง');
      if (e.kind === 'box') {
        if (!Array.isArray(e.members) || e.members.length > 1000) throw new Error('ข้อมูลบ็อกซ์ไม่ถูกต้อง');
        e.members.forEach(label => requireText(label, 80));
      }
    }
  }
  for (const d of data.drafts) {
    validateOptionalMedia(d); validateReading(d);
    id(d.id);
    if (!Object.hasOwn(FORMATS, d.format)) throw new Error('รูปแบบหนังสือในถาดไม่ถูกต้อง');
    for (const key of ['title', 'author', 'isbn', 'label', 'edition', 'language', 'category', 'source']) requireText(d[key], 300, true);
    if (d.isbn && !normalizeIsbn(d.isbn)) throw new Error('ISBN ในถาดไม่ถูกต้อง');
  }
  return data;
}

export function migrateState(input) {
  const data = structuredClone(input);
  if (data?.schemaVersion === 1 && Array.isArray(data.series) && Array.isArray(data.drafts)) {
    for (const s of data.series) s.format = 'physical';
    for (const d of data.drafts) d.format = 'physical';
    data.schemaVersion = 2;
  }
  return validateState(data);
}

export function seedState() {
  const specifications = [
    ['ใต้แสงจันทร์มีเธอ', 'ละอองดาว', 'นิยายวายไทย', 'moon', [1, 2, 4], [5], [], [1, 2, 3, 4, 5]],
    ['ร้านหนังสือปลายฤดู', 'ต้นส้ม', 'การ์ตูน', 'garden', [1, 2, 3], [4], [], [1, 2, 3, 4]],
    ['พันลี้เคียงใจ', 'หลินเยว่', 'นิยายแปลจีน', 'mountain', [], [], [1, 2, 3], [1, 2, 3, 4]],
    ['จดหมายถึงวันพรุ่งนี้', 'เมฆคราม', 'นิยายวายไทย', 'letter', [1, 2], [], [], [1, 2]],
    ['บันทึกแมวข้างบ้าน', 'มะลิ', 'การ์ตูน', 'cat', [1], [], [], [1, 2]],
    ['วสันต์หวนคืน', 'ชิงเหอ', 'นิยายแปลจีน', 'flower', [], [], [], []],
  ];
  return { schemaVersion: 2, drafts: [], series: specifications.map(([title, author, category, art, owned, ordered, box, target], index) => ({
    id: `sample-${index}`, title, author, category, art, alias: index === 0 ? 'จันทร์เธอ' : '',
    edition: 'ฉบับธรรมดา', language: 'ไทย', format: index === 3 ? 'ebook' : 'physical', target: target.map(String), sample: true,
    entries: [
      ...owned.map(label => ({ id: `sample-${index}-${label}`, label: String(label), status: 'owned', isbn: '', kind: 'volume', quantity: 1 })),
      ...ordered.map(label => ({ id: `order-${index}-${label}`, label: String(label), status: 'ordered', isbn: '', kind: 'volume', quantity: 1 })),
      ...(box.length ? [{ id: `box-${index}`, label: 'บ็อกซ์ 1–3', status: 'owned', isbn: '', kind: 'box', members: box.map(String), quantity: 1 }] : []),
      ...(index === 5 ? [{ id: 'wish-5', label: '1', status: 'wishlist', isbn: '', kind: 'volume', quantity: 1 }] : []),
    ],
  })) };
}
