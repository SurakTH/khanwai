import { READING_STATUSES, readingLabel } from './reading.js';
import { CATEGORIES, FORMATS, STATUSES } from './lib.js';
import { CSV_FIELDS, CSV_TEMPLATE, parseCsv, autoMapping, csvCandidates, planCsv, csvFingerprint } from './csv-import.js';
export function openCsvImport({ getState, openModal, heading, escape: esc, onSave, isCurrent = () => true }) {
  let fileText = '', table, mapping, defaults, candidates, plan;
  const error = message => { const el = document.querySelector('#csv-error'); if (el) el.textContent = message; };
  const enumOptions = (values, current) => `${current && !Object.hasOwn(values,current) ? `<option selected value="${esc(current)}">${esc(current)}</option>` : ''}${Object.entries(values).map(([k,v]) => `<option value="${esc(k)}" ${k===current?'selected':''}>${esc(v)}</option>`).join('')}`;
  const start = () => {
    if (!isCurrent()) return; fileText = '';
    openModal(`${heading('นำเข้าหนังสือจาก CSV', 'ไฟล์ UTF-8 จาก Excel หรือ Google Sheets · ไม่ส่งไฟล์ไปแหล่งค้นภายนอก')}<p class="subtitle">หนึ่งแถวต่อเล่มหรือบ็อกซ์ มีหัวคอลัมน์ · สูงสุด 1,000 แถว / 2 MB · ตรวจทานก่อนเข้าชั้นเสมอ</p><div class="actions"><button class="button" id="csv-template">ดาวน์โหลดไฟล์ตัวอย่าง</button><label class="field">เลือกไฟล์ CSV<input id="csv-file" type="file" accept=".csv,text/csv,text/plain"></label></div><label class="field">ตัวคั่น<select id="csv-delimiter"><option value=",">จุลภาค (,)</option><option value=";">เซมิโคลอน (;)</option><option value="tab">แท็บ</option></select></label><p id="csv-error" role="alert"></p>`);
    document.querySelector('#csv-template').onclick = () => { const url = URL.createObjectURL(new Blob([CSV_TEMPLATE],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='khanwai-template.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); };
    document.querySelector('#csv-file').onchange = async event => {
      const file = event.target.files[0]; event.target.value=''; if (!file) return;
      const delimiter = document.querySelector('#csv-delimiter').value;
      try { if (file.size > 2*1024*1024) throw Error('ไฟล์ใหญ่เกิน 2 MB');fileText = await file.text();if(!isCurrent())return;table=parseCsv(fileText,delimiter==='tab'?'\t':delimiter);mapping=autoMapping(table.headers);defaults={format:'physical',status:'owned',category:CATEGORIES[0],quantity:'1',label:'1',kind:'volume',edition:'',language:''};mapView(); }
      catch(e) { if(isCurrent())error(e.message); }
    };
  };
  const mapView = () => {
    if (!isCurrent()) return;
    openModal(`${heading('จับคู่คอลัมน์ CSV', `${table.rows.length} แถว · ช่องที่ไม่จับคู่จะใช้ค่าด้านล่าง`)}<form id="csv-mapping"><div class="form-grid">${Object.entries(CSV_FIELDS).map(([k,label])=>`<label class="field">${label}<select data-map="${k}" aria-label="คอลัมน์ ${label}"><option value="-1">ไม่ใช้คอลัมน์นี้</option>${table.headers.map((h,i)=>`<option value="${i}" ${mapping[k]===i?'selected':''}>${esc(h)} · เช่น ${esc(table.rows[0][i].slice(0,50))}</option>`).join('')}</select></label>`).join('')}</div><h3>ค่าที่ใช้เมื่อไม่จับคู่คอลัมน์</h3><div class="form-grid">${['edition','language','label','location'].map(k=>`<label class="field">${CSV_FIELDS[k]}<input data-default="${k}" value="${esc(defaults[k] ?? '')}" maxlength="${k==='location'?150:k==='label'?80:300}"></label>`).join('')}<label class="field">รูปแบบ<select data-default="format">${enumOptions(FORMATS,defaults.format)}</select></label><label class="field">สถานะ<select data-default="status">${enumOptions(STATUSES,defaults.status)}</select></label><label class="field">ประเภท<select data-default="category">${enumOptions(Object.fromEntries(CATEGORIES.map(v=>[v,v])),defaults.category)}</select></label></div><p class="subtitle">ช่องจำนวนว่างใช้ 1 สำเนา ชนิดรายการว่างใช้เล่มเดี่ยว แท็กและเป้าหมายใช้จุลภาคคั่น เช่น 1-10, ภาคพิเศษ · บ็อกซ์ต้องระบุชนิด box และสมาชิก</p><p id="csv-error" role="alert"></p><div class="form-actions"><button type="button" class="button" id="csv-start">เลือกไฟล์ใหม่</button><button type="submit" class="button primary">ตรวจข้อมูล CSV</button></div></form>`);
    document.querySelector('#csv-start').onclick=start;
    document.querySelector('#csv-mapping').onsubmit=e=>{e.preventDefault();try{document.querySelectorAll('[data-map]').forEach(el=>mapping[el.dataset.map]=Number(el.value));document.querySelectorAll('[data-default]').forEach(el=>defaults[el.dataset.default]=el.value.trim());candidates=csvCandidates(table,mapping,defaults);review();}catch(e){error(e.message);}};
  };
  const review = () => {
    if (!isCurrent()) return;
    try { plan=planCsv(getState(),candidates); } catch(e){ error(e.message); return; }
    const counts = name => plan.results.filter(r=>r.status===name).length;
    openModal(`${heading('ตรวจทาน CSV ก่อนเข้าชั้น', `พร้อมเพิ่ม ${counts('ready')} · ซ้ำ ${counts('duplicate')} · ต้องแก้ ${counts('error')} · เว้นไว้ ${counts('excluded')}`)}<p class="subtitle">ตรวจชื่อ ฉบับ รูปแบบ สถานะ และเลขเล่มก่อนยืนยัน รายการซ้ำจะข้าม ไม่เพิ่มสำเนาหรือเขียนทับของเดิม แถวที่ผิดต้องแก้หรือติ๊กเว้นก่อนยืนยัน แท็กจากแถวที่เพิ่มจะรวมกับแท็กฉบับเดิม</p><div class="csv-rows">${candidates.map((row,i)=>{const r=plan.results[i];return `<article class="csv-row"><label class="checkbox-line"><input type="checkbox" data-csv-select="${i}" ${row.selected?'checked':''}><span>แถว ${i+2}: ${esc(row.title || 'ยังไม่มีชื่อ')} · เล่ม ${esc(row.label)}<small>${esc(row.edition)} · ${esc(row.language)} · ${esc(FORMATS[row.format] || row.format)} · ${esc(STATUSES[row.status] || row.status)} · การอ่าน: ${esc(readingLabel(row.readingStatus))}</small></span></label><p class="csv-result ${r.status==='error'?'csv-invalid':''}">${esc(r.message)}</p><details data-csv-edit="${i}"><summary>ดู / แก้ข้อมูลแถว ${i+2}</summary><div class="form-grid"></div></details></article>`;}).join('')}</div><p id="csv-error" role="alert"></p><div class="form-actions"><button class="button" id="csv-map-back">กลับไปจับคู่ใหม่</button><button class="button" id="csv-recheck">ตรวจข้อมูลอีกครั้ง</button><button class="button primary" id="csv-confirm" ${counts('ready') && !counts('error')?'':'disabled'}>ยืนยันเพิ่ม ${counts('ready')} รายการ</button></div>`);
    const invalidate = () => { document.querySelector('#csv-confirm').disabled=true;error('ข้อมูลเปลี่ยนแล้ว กดตรวจข้อมูลอีกครั้งก่อนยืนยัน'); };
    document.querySelectorAll('[data-csv-select]').forEach(el=>el.onchange=()=>{candidates[Number(el.dataset.csvSelect)].selected=el.checked;invalidate();});
    document.querySelectorAll('[data-csv-edit]').forEach(detail=>detail.addEventListener('toggle',()=>{
      if(!detail.open || detail.dataset.mounted)return;detail.dataset.mounted='1';const index=Number(detail.dataset.csvEdit),row=candidates[index];
      detail.querySelector('.form-grid').innerHTML=Object.entries(CSV_FIELDS).map(([k,label])=>`<label class="field">${label}${['format','status','category','kind','readingStatus'].includes(k)?`<select data-csv-field="${k}">${enumOptions(k==='readingStatus'?READING_STATUSES:k==='format'?FORMATS:k==='status'?STATUSES:k==='category'?Object.fromEntries(CATEGORIES.map(v=>[v,v])):{volume:'เล่ม',box:'บ็อกซ์'},row[k])}</select>`:`<input data-csv-field="${k}" value="${esc(row[k])}" maxlength="${['target','members'].includes(k)?4000:k==='tags'?1529:300}">`}</label>`).join('');
      detail.querySelectorAll('[data-csv-field]').forEach(el=>el.addEventListener('input',()=>{row[el.dataset.csvField]=el.value;invalidate();}));
    }));
    document.querySelector('#csv-map-back').onclick=mapView;
    document.querySelector('#csv-recheck').onclick=review;
    document.querySelector('#csv-confirm').onclick=async event=>{
      const button=event.currentTarget;button.disabled=true;
      try { const latest=planCsv(getState(),candidates);if(latest.results.some(r=>r.status==='error'))throw Error('แก้แถวที่ผิดหรือติ๊กเว้นก่อนยืนยัน');if(csvFingerprint(latest)!==csvFingerprint(plan)){review();error('ชั้นเปลี่ยนระหว่างตรวจทาน โปรดตรวจผลล่าสุดก่อนยืนยันอีกครั้ง');return;}await onSave(candidates,csvFingerprint(plan)); }
      catch(e){error(e.message);}finally{if(button.isConnected)button.disabled=false;}
    };
  };
  start();
}
