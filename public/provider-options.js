export const LOOKUP_PROVIDERS = [
  { id:'google', name:'Google Books', description:'ค้นข้อมูลหนังสือจาก Google Books' },
  { id:'openlibrary', name:'Open Library', description:'แค็ตตาล็อกหนังสือแบบเปิด' },
  { id:'nlt', name:'หอสมุดแห่งชาติ (NLT)', description:'Single Search · แหล่งข้อมูลทดลอง' },
];
export const DEFAULT_PROVIDERS = ['google','openlibrary'];
export function validateProviders(value) {
  if (!Array.isArray(value) || value.length > LOOKUP_PROVIDERS.length || value.some(id=>!LOOKUP_PROVIDERS.some(p=>p.id===id)) || new Set(value).size!==value.length) throw Error('เลือกแหล่งข้อมูลจากรายการ และไม่เลือกซ้ำ');
  return [...value];
}
