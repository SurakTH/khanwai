import { api } from './account-store.js';
import { LOOKUP_PROVIDERS } from './provider-options.js';
let draft;
export const lookupSettingsMarkup = () => '<section class="panel" aria-labelledby="lookup-settings-title"><h2 id="lookup-settings-title">แหล่งข้อมูลหนังสือ</h2><p>เปิดแหล่งที่ต้องการ แล้วเรียงลำดับจากบนลงล่าง เมื่อไม่พบหรือติดต่อไม่ได้จะลองแหล่งถัดไป ข้อมูลที่พบยังต้องตรวจยืนยันก่อนเข้าชั้น</p><div id="lookup-settings"><p role="status">กำลังโหลดการตั้งค่า…</p></div></section>';
export async function mountLookupSettings(owner, esc) {
  const root=document.querySelector('#lookup-settings'); if(!root)return;
  if(draft?.owner!==owner)draft=undefined;
  const draw=()=>{
    if(!root.isConnected || draft?.owner!==owner)return;
    const ids=[...draft.isbnProviders,...LOOKUP_PROVIDERS.filter(p=>!draft.isbnProviders.includes(p.id)).map(p=>p.id)];
    root.innerHTML=`<form id="lookup-settings-form"><div class="provider-list">${ids.map(id=>{
      const provider=LOOKUP_PROVIDERS.find(p=>p.id===id),index=draft.isbnProviders.indexOf(id),enabled=index>=0;
      return `<div class="provider-row" data-provider-row="${id}"><label><input type="checkbox" data-provider="${id}" ${enabled?'checked':''} ${draft.saving?'disabled':''}><span><strong>${esc(provider.name)}</strong><small>${esc(provider.description)}</small></span></label><div class="provider-order"><button type="button" class="button" data-provider-move="${id}" data-direction="-1" aria-label="เลื่อน ${esc(provider.name)} ขึ้น" ${!enabled||index===0||draft.saving?'disabled':''}>↑</button><button type="button" class="button" data-provider-move="${id}" data-direction="1" aria-label="เลื่อน ${esc(provider.name)} ลง" ${!enabled||index===draft.isbnProviders.length-1||draft.saving?'disabled':''}>↓</button></div></div>`;
    }).join('')}</div><p class="subtitle">${draft.isbnProviders.length?'ค้นตามลำดับ: '+draft.isbnProviders.map(id=>esc(LOOKUP_PROVIDERS.find(p=>p.id===id).name)).join(' → '):'ปิดการค้นภายนอก · ยังสแกน ISBN เช็กชั้น และกรอกเองได้'}</p><p class="subtitle">NLT เป็นแหล่งทดลอง รูปแบบข้อมูลอาจเปลี่ยนได้ การเลือกแหล่งข้อมูลไม่เปลี่ยนหนังสือที่บันทึกไว้</p><p id="lookup-settings-status" class="subtitle" role="status">${esc(draft.message|| (draft.dirty?'ยังไม่ได้บันทึกการเปลี่ยนแปลง':'การตั้งค่าของบัญชีนี้ ใช้ร่วมกันทุกเครื่อง'))}</p><div class="actions"><button class="button primary" type="submit" ${draft.saving?'disabled':''}>${draft.saving?'กำลังบันทึก…':'บันทึกแหล่งข้อมูล'}</button><button class="button" type="button" id="reload-lookup-settings" ${draft.saving?'disabled':''}>โหลดค่าล่าสุด</button></div><small>ต้องออนไลน์เพื่อบันทึกการตั้งค่านี้</small></form>`;
    root.querySelectorAll('[data-provider]').forEach(input=>input.addEventListener('change',()=>{
      draft.isbnProviders=input.checked?[...draft.isbnProviders,input.dataset.provider]:draft.isbnProviders.filter(id=>id!==input.dataset.provider);draft.dirty=true;draft.message='';draw();
    }));
    root.querySelectorAll('[data-provider-move]').forEach(button=>button.addEventListener('click',()=>{
      const index=draft.isbnProviders.indexOf(button.dataset.providerMove),target=index+Number(button.dataset.direction);
      if(index<0||target<0||target>=draft.isbnProviders.length)return;
      [draft.isbnProviders[index],draft.isbnProviders[target]]=[draft.isbnProviders[target],draft.isbnProviders[index]];draft.dirty=true;draft.message='';draw();
    }));
    root.querySelector('#reload-lookup-settings').addEventListener('click',()=>{
      if(draft.dirty&&!confirm('โหลดค่าล่าสุดและละทิ้งการตั้งค่าที่ยังไม่บันทึก?'))return;
      draft=undefined;mountLookupSettings(owner,esc);
    });
    root.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault();if(draft.saving)return;
      const current=draft;current.saving=true;current.message='';draw();
      try{
        const value=await api('/api/settings',{method:'PUT',body:JSON.stringify({owner,isbnProviders:current.isbnProviders,revision:current.revision})});
        if(draft!==current)return;
        if(value.owner!==owner)throw Error('บัญชีเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่');
        Object.assign(current,value,{dirty:false,message:'บันทึกบนเซิร์ฟเวอร์แล้ว · ใช้กับการค้นครั้งต่อไป'});
      }catch(error){current.message=error.status===409?'การตั้งค่าถูกเปลี่ยนจากอีกเครื่อง กดโหลดค่าล่าสุดเพื่อตรวจ ก่อนเลือกและบันทึกใหม่':error.message;}
      finally{current.saving=false;if(root.isConnected)draw();else if(draft===current&&document.querySelector('#lookup-settings'))mountLookupSettings(owner,esc);}
    });
  };
  if(draft?.dirty||draft?.saving){draw();return;}
  try{
    const value=await api('/api/settings');
    if(!root.isConnected)return;
    if(value.owner!==owner)throw Error('บัญชีเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่');
    draft={...value,dirty:false,saving:false,message:''};draw();
  }catch(error){if(root.isConnected)root.textContent='โหลดการตั้งค่าไม่ได้: '+error.message+' · ลองเปิดหน้านี้ใหม่เมื่อออนไลน์';}
}
