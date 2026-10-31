export const DEFAULT_CATEGORIES = Object.freeze(['การ์ตูน','นิยายวายไทย','นิยายแปลจีน','อื่น ๆ']);
export const categoryKey = value => String(value??'').normalize('NFKC').trim().toLocaleLowerCase('th');
export function validateCategoryName(value) {
  if(typeof value!=='string'||!value.trim()||value.length>300||/[\u0000-\u001f\u007f]/.test(value)||categoryKey(value)==='all')throw Error('ชื่อหมวดหมู่ต้องไม่ว่าง ไม่เกิน 300 ตัวอักษร และไม่ใช้ชื่อ all');
  return value.normalize('NFC').trim();
}
export function validateCategoryList(names) {
  if(!Array.isArray(names)||!names.length||names.length>100)throw Error('ต้องมีหมวดหมู่อย่างน้อย 1 หมวด และไม่เกิน 100 หมวด');
  const seen=new Set();for(const name of names){validateCategoryName(name);if(name!==name.normalize('NFC').trim()||seen.has(categoryKey(name)))throw Error('ชื่อหมวดหมู่ซ้ำหรือมีช่องว่างเกิน');seen.add(categoryKey(name));}
  return names;
}
// Referenced names from older devices/imports stay available rather than losing book assignments.
export function categoryList(state) {
  const names=[...(state.categories??DEFAULT_CATEGORIES),...state.series.map(s=>s.category),...state.drafts.map(d=>d.category)].filter(n=>typeof n==='string'&&n.trim()).map(n=>n.normalize('NFC').trim());
  const seen=new Set();return names.filter(name=>{const key=categoryKey(name);if(seen.has(key))return false;seen.add(key);return true;});
}
export function categoryOptions(state, selected, esc) {
  return categoryList(state).map(name=>{const matches=categoryKey(name)===categoryKey(selected),value=matches?selected:name;return `<option value="${esc(value)}" ${matches?'selected':''}>${esc(name)}</option>`;}).join('');
}
export function categoryUsage(state,name) {const key=categoryKey(name);return {series:state.series.filter(s=>categoryKey(s.category)===key).length,drafts:state.drafts.filter(d=>categoryKey(d.category)===key).length};}
export function changeCategory(state,{action,name,value,target}) {
  const names=categoryList(state),key=categoryKey(name),index=names.findIndex(n=>categoryKey(n)===key);
  let replacement;
  if(action==='add') {
    const next=validateCategoryName(value);if(names.some(n=>categoryKey(n)===categoryKey(next)))throw Error('มีหมวดหมู่ชื่อนี้แล้ว');names.push(next);
  } else {
    if(index<0)throw Error('หมวดหมู่นี้เปลี่ยนไปแล้ว กรุณาเปิดใหม่');
    if(action==='rename') {
      replacement=validateCategoryName(value);if(names.some((n,i)=>i!==index&&categoryKey(n)===categoryKey(replacement)))throw Error('มีหมวดหมู่ชื่อนี้แล้ว');names[index]=replacement;
    } else if(action==='delete') {
      if(names.length===1)throw Error('ต้องเหลือหมวดหมู่อย่างน้อย 1 หมวด');
      const usage=categoryUsage(state,name);replacement=names.find(n=>categoryKey(n)===categoryKey(target)&&categoryKey(n)!==key);
      if((usage.series||usage.drafts)&&!replacement)throw Error('เลือกหมวดหมู่ปลายทางสำหรับหนังสือและถาดรอตรวจก่อน');names.splice(index,1);
    } else throw Error('คำสั่งจัดการหมวดหมู่ไม่ถูกต้อง');
  }
  validateCategoryList(names);
  if(replacement)for(const item of [...state.series,...state.drafts])if(categoryKey(item.category)===key)item.category=replacement;
  state.categories=names;return state;
}
