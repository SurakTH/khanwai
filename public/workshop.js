import { categoryList, categoryOptions, categoryKey } from './categories.js';
import { readingOptions, readingLabel } from './reading.js';
import { parseTags } from './shelf-tools.js';
import { FORMATS, STATUSES, matchingEntries, normalizeIsbn } from './lib.js';
import { photoEditorMarkup, mountPhotoEditor } from './photos.js';

export function batchLabels(start, end, excluded = '') {
  const first = Number(start), last = Number(end);
  if (String(start).trim() === '' || String(end).trim() === '' || !Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last < first || last > 999 || last - first >= 200) throw Error('ใส่ช่วงเลขเล่ม 0–999 เรียงจากน้อยไปมาก ครั้งละไม่เกิน 200 เล่ม');
  const skipped = new Set();
  for (const part of excluded.trim() ? excluded.split(',') : []) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw Error('เล่มที่เว้นไว้ใช้รูปแบบ 3, 5, 8-10');
    const a = Number(match[1]), b = Number(match[2] ?? match[1]);
    if (a < first || b > last || a > b) throw Error('เล่มที่เว้นไว้ต้องอยู่ในช่วงที่กำหนด');
    for (let n = a; n <= b; n++) skipped.add(String(n));
  }
  const all = Array.from({ length: last - first + 1 }, (_, i) => String(first + i));
  return { all, included: all.filter(label => !skipped.has(label)), skipped: [...skipped] };
}

export function seriesTitleFromCandidate(candidate) {
  const title=String(candidate.title ?? '').trim(),label=String(candidate.label ?? '').trim();
  const match=title.match(/^(.*?)\s+เล่ม\s*(\d+(?:\.\d+)?)\s*$/);
  return match && label && match[2]===label && match[1].trim() ? match[1].trim() : title;
}
export function batchSeed(isbn, label, source='กรอกเอง') {
  if(!String(isbn ?? '').trim())return null;
  const normalized=normalizeIsbn(isbn);
  if(!normalized)throw Error('ISBN ต้นทางไม่ถูกต้อง ตรวจเลขหรือเว้นว่างได้');
  if(!String(label ?? '').trim() || String(label).length>80)throw Error('ระบุว่า ISBN ต้นทางเป็นของเล่มไหนก่อน');
  return {isbn:normalized,label:String(label).trim(),source:String(source).slice(0,300)};
}
export function openBatchForm({ state, editions = state.series, initial={}, intro='', lookupMarkup='', openModal, heading, escape:esc, onSave, notify }) {
  const options=(values,selected)=>Object.entries(values).map(([key,value])=>`<option value="${esc(key)}" ${key===selected?'selected':''}>${esc(value)}</option>`).join('');
  openModal(`${heading('เพิ่มหนังสือ', 'ใช้ข้อมูลจากเล่มหนึ่ง แล้วเลือกเล่มที่จะเพิ่มก่อนยืนยัน')}${intro}${lookupMarkup}<form id="batch-form"><div class="form-grid">
    <label class="field full">เพิ่มเข้าฉบับ<select name="seriesId" id="batch-series"><option value="">สร้างเรื่อง / ฉบับใหม่</option>${editions.map(s=>`<option value="${esc(s.id)}" ${initial.seriesId===s.id?'selected':''}>${esc(s.title)} · ${esc(s.edition)} · ${esc(FORMATS[s.format])}</option>`).join('')}</select></label>
    <label class="field full">ชื่อเรื่อง *<input name="title" required maxlength="300" placeholder="ชื่อชุด ไม่รวมเลขเล่ม"></label>
    <label class="field">ผู้เขียน<input name="author" maxlength="300"></label>
    <label class="field">ประเภท<select name="category">${categoryOptions(state,initial.category??categoryList(state)[0],esc)}</select></label>
    <label class="field">รูปแบบ<select name="format">${options(FORMATS,initial.format??'physical')}</select></label>
    <label class="field">ฉบับ *<input name="edition" required maxlength="300"></label>
    <label class="field">ภาษา *<input name="language" required maxlength="100"></label>
    <label class="field">สถานะเริ่มต้น<select name="status">${options(STATUSES,initial.status??'owned')}</select></label>
    <label class="field">การอ่านเริ่มต้น<select name="readingStatus">${readingOptions(initial.readingStatus ?? 'unread')}</select></label><label class="field full">แท็กส่วนตัวของฉบับ<input name="tags" maxlength="1529" placeholder="เช่น ฉบับสะสม, งานหนังสือ"></label><label class="field full"><span id="batch-location-label">ตำแหน่งเก็บ</span><input name="location" maxlength="150" placeholder="เช่น ตู้ B ชั้น 2"></label>
    <label class="field">ISBN ต้นทาง<input name="seedIsbn" maxlength="30" placeholder="ไม่มีให้เว้นว่าง"></label>
    <label class="field">ISBN นี้เป็นของเล่ม<input name="seedLabel" maxlength="80" placeholder="เช่น 10"></label>
    </div><p class="subtitle">ISBN ต้นทางช่วยกรอกข้อมูลชุด จะใส่ ISBN ให้เฉพาะเล่มที่ระบุเมื่อเพิ่มเล่มนั้นด้วย เล่มอื่นจะเว้น ISBN ไว้</p>
    <p class="subtitle" id="source-label"></p>
    <details class="batch-photo"><summary>แนบรูปปกสำหรับแสดงชุดนี้ (ไม่บังคับ)</summary>${photoEditorMarkup(esc)}<p class="subtitle">รูปนี้เป็นภาพแทนชุด ไม่ใช้แทนปกแต่ละเล่ม</p></details>
    <div class="batch-range"><h3>ช่วงที่ต้องการสะสม</h3><div class="form-grid"><label class="field">ตั้งแต่เล่ม<input name="start" type="number" min="0" max="999" required></label><label class="field">ถึงเล่ม<input name="end" type="number" min="0" max="999" required></label><label class="field full">เล่มที่ยังไม่มี / เว้นไว้<input name="excluded" placeholder="เช่น 3, 5, 8-10" maxlength="500"><small>เล่มที่เว้นไว้จะไม่ถูกบันทึกว่ามีแล้ว</small></label></div></div><div id="batch-error" class="subtitle" role="alert"></div><div class="form-actions"><button class="button primary" type="submit">ตรวจรายการก่อนเพิ่ม →</button></div></form><section id="batch-review" hidden></section>`);
  const form=document.querySelector('#batch-form');
  const defaults={tags:'',title:'',author:'',edition:'ฉบับธรรมดา',language:'ไทย',location:'',seedIsbn:'',seedLabel:'',start:'1',end:'',excluded:''};
  for(const [key,value] of Object.entries(defaults))form.elements[key].value=initial[key]??value;
  form.dataset.source=initial.source??'กรอกเอง';
  const getPhoto=mountPhotoEditor(document.querySelector('#modal-content'),initial.coverData??'');
  const locationLabel=()=>{const ebook=form.elements.format.value==='ebook';document.querySelector('#batch-location-label').textContent=ebook?'แพลตฟอร์ม ebook':'ตำแหน่งเก็บ';form.elements.location.placeholder=ebook?'เช่น แอพที่ซื้อ ebook':'เช่น ตู้ B ชั้น 2';};
  const updateLinked=()=>{
    const series=state.series.find(s=>s.id===form.elements.seriesId.value);
    if(series&&!form.elements.seedIsbn.value){
      const seed=series.metadataSeed??series.entries.find(e=>e.kind==='volume'&&e.isbn);
      if(seed){form.elements.seedIsbn.value=seed.isbn;form.elements.seedLabel.value=seed.label;form.dataset.source=seed.source||'ข้อมูลจากชั้นของฉัน';}
    }
    for(const key of ['title','author','category','format','edition','language','tags']){if(series)form.elements[key].value=key==='tags'?(series.tags??[]).join(', '):series[key];form.elements[key].disabled=Boolean(series);}
    locationLabel();
  };
  form.elements.format.addEventListener('change',locationLabel);
  form.elements.seriesId.addEventListener('change',updateLinked);updateLinked();
  document.querySelector('#source-label').textContent='แหล่งข้อมูล: '+form.dataset.source+' · ตรวจข้อมูลร่วมและเล่มของ ISBN ก่อนบันทึก';
  let saving=false;
  const getData=()=>{
    if(saving)throw Error('กำลังบันทึก กรุณารอสักครู่');
    const data={...initial,coverData:getPhoto(),source:form.dataset.source,continueAdding:document.querySelector('#batch-continue')?.checked??initial.continueAdding,lookupIsbn:document.querySelector('#lookup-isbn')?.value??''};
    for(const key of ['title','author','category','format','edition','language','location','status','seriesId','seedIsbn','seedLabel','start','end','excluded','tags','readingStatus'])data[key]=form.elements[key].value.trim();
    return data;
  };
  form.addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const details=getData();parseTags(details.tags);const range=batchLabels(details.start,details.end,details.excluded),seed=batchSeed(details.seedIsbn,details.seedLabel,details.source);
      const series=state.series.find(s=>s.id===details.seriesId);
      const duplicateLabels=new Set(range.all.filter(label=>series&&matchingEntries(series,{kind:'volume',label,isbn:''}).length));
      const rows=range.all.map(label=>({label,included:range.included.includes(label)&&!duplicateLabels.has(label),duplicate:duplicateLabels.has(label)}));
      const isbnDuplicate=seed&&state.series.some(s=>s.entries.some(e=>normalizeIsbn(e.isbn)===seed.isbn));
      const review=document.querySelector('#batch-review');form.hidden=true;review.hidden=false;
      const searchControls=[...document.querySelectorAll('.add-modes,#lookup-form,#lookup-result')];searchControls.forEach(element=>{element.hidden=true;});
      review.innerHTML=`<div class="batch-review-title"><span class="badge">ตรวจรายการ</span><h3>${esc(details.title)}</h3><p>การอ่าน: ${esc(readingLabel(details.readingStatus))}</p><p>${esc(details.edition)} · ${esc(FORMATS[details.format])}${details.location?` · ${esc(details.location)}`:''}</p></div><p class="subtitle">เลือกเล่มที่จะเพิ่มได้อีกครั้ง รายการที่มีข้อมูลแล้วรวมเล่มในบ็อกซ์จะข้ามให้</p><div class="batch-volume-list">${rows.map((row,i)=>`<label class="batch-volume-row"><input type="checkbox" data-batch-row="${i}" ${row.included?'checked':''} ${row.duplicate?'disabled':''}><span>เล่ม ${esc(row.label)}${seed&&row.label===seed.label?`<small class="batch-isbn">ISBN ${esc(seed.isbn)}</small>`:''}</span><span class="badge ${row.duplicate?'neutral':row.included?'':'neutral'}">${row.duplicate?'มีข้อมูลแล้ว · ข้าม':row.included?esc(STATUSES[details.status]):'เว้นไว้'}</span></label>`).join('')}</div>
        <div id="batch-seed-summary" class="notice"></div>${isbnDuplicate?'<label class="checkbox-line" id="batch-duplicate-warning"><input type="checkbox" id="batch-confirm-duplicate">ISBN ต้นทางมีในชั้นแล้ว ฉันตรวจและต้องการเพิ่มอีกสำเนา</label>':''}
        <div id="batch-total" class="notice"></div><label class="checkbox-line"><input id="batch-continue" type="checkbox" ${details.continueAdding?'checked':''}>เพิ่มเล่มถัดไปต่อหลังบันทึก</label><p id="batch-save-error" class="subtitle" role="alert"></p><div class="form-actions"><button class="button" id="batch-back">← กลับไปแก้</button><button class="button primary" id="batch-confirm">ยืนยันเพิ่มเข้าชั้น</button></div>`;
      const update=()=>{
        const chosen=rows.filter(row=>row.included),assigns=seed&&chosen.some(row=>row.label===seed.label);
        document.querySelector('#batch-total').textContent=`จะเพิ่ม ${chosen.length} เล่ม · เล่มอื่นไม่สร้าง ISBN สมมติ`;
        document.querySelector('#batch-seed-summary').textContent=seed?(assigns?`ISBN ${seed.isbn} จะใส่เฉพาะเล่ม ${seed.label}`:`ใช้ ISBN เล่ม ${seed.label} เป็นข้อมูลตั้งต้นเท่านั้น ไม่ได้เพิ่มเล่มนี้หรือเปลี่ยน ISBN ของรายการเดิม`):'ยังไม่ระบุ ISBN · เพิ่มด้วยข้อมูลที่ตรวจแล้วได้';
        const warning=document.querySelector('#batch-duplicate-warning');if(warning)warning.hidden=!assigns;
        document.querySelector('#batch-confirm').disabled=saving||!chosen.length||Boolean(assigns&&isbnDuplicate&&!document.querySelector('#batch-confirm-duplicate').checked);
      };
      review.querySelectorAll('[data-batch-row]').forEach(input=>input.addEventListener('change',()=>{rows[Number(input.dataset.batchRow)].included=input.checked;input.closest('label').querySelector('.badge').textContent=input.checked?STATUSES[details.status]:'เว้นไว้';update();}));
      document.querySelector('#batch-confirm-duplicate')?.addEventListener('change',update);
      document.querySelector('#batch-back').addEventListener('click',()=>{if(saving)return;form.hidden=false;review.hidden=true;searchControls.forEach(element=>{element.hidden=false;});document.querySelector('#modal').scrollTop=0;});
      document.querySelector('#batch-confirm').addEventListener('click',async()=>{
        if(saving)return;saving=true;update();
        const controls=[...review.querySelectorAll('input,button')];controls.forEach(control=>{control.disabled=true;});
        try{if(await onSave({...details,seed,target:range.all,labels:rows.filter(row=>row.included).map(row=>row.label),confirmDuplicate:Boolean(document.querySelector('#batch-confirm-duplicate')?.checked),continueAdding:document.querySelector('#batch-continue').checked}))notify('เพิ่มชุดแล้ว · รอเซิร์ฟเวอร์ยืนยัน');}
        catch(error){const output=document.querySelector('#batch-save-error');if(output)output.textContent=error.message;}
        finally{saving=false;controls.forEach(control=>{control.disabled=false;});rows.forEach((row,i)=>{const input=review.querySelector(`[data-batch-row="${i}"]`);if(input)input.disabled=row.duplicate;});if(review.isConnected)update();}
      });update();document.querySelector('#modal').scrollTop=0;
    }catch(error){document.querySelector('#batch-error').textContent=error.message;}
  });
  return {form,getData,getPhoto};
}
