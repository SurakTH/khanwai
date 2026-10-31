// Shared cover editor: prepare locally; the caller saves only after review.
export function photoEditorMarkup(escape) {
  return `<section class="photo-editor" aria-label="แนบรูปปก"><div id="photo-preview" class="photo-preview"><span aria-hidden="true">▧</span></div><div><strong>รูปปก</strong><p class="subtitle">JPG, PNG, WebP · บันทึกเมื่อกดยืนยัน</p><div class="photo-actions"><label class="button">เลือกรูป<input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp" class="visually-hidden"></label><label class="button">ถ่ายรูป<input id="photo-camera" type="file" accept="image/*" capture="environment" class="visually-hidden"></label><button type="button" class="button" id="photo-paste-button" aria-label="วางรูปจากคลิปบอร์ด">วางรูป</button><button type="button" class="button ghost" id="photo-remove">ลบรูป</button></div><details class="photo-paste-options"><summary>วางด้วยคีย์บอร์ด / แตะค้าง</summary><label class="photo-paste-label" for="photo-paste">วางรูปตรงนี้</label><textarea id="photo-paste" rows="2" aria-label="วางรูปปกที่นี่" aria-describedby="photo-paste-help" placeholder="⌘V / Ctrl+V หรือแตะค้าง"></textarea><p id="photo-paste-help" class="subtitle">ใช้ “คัดลอกรูปภาพ” แทนคัดลอกลิงก์รูป</p></details><p id="photo-status" class="subtitle" role="status">${escape('ไม่จำเป็นต้องมีรูปก็เพิ่มหนังสือได้')}</p></div></section>`;
}

export function mountPhotoEditor(root, initial = '') {
  let image = initial, busy = false, generation = 0;
  const preview = root.querySelector('#photo-preview');
  const message = root.querySelector('#photo-status');
  const editor = root.querySelector('.photo-editor'), pasteArea = root.querySelector('#photo-paste'), pasteButton = root.querySelector('#photo-paste-button');
  const supported = ['image/png', 'image/jpeg', 'image/webp'];
  const current = version => version === generation && editor.isConnected && (!editor.closest('dialog') || editor.closest('dialog').open);
  const setBusy = value => { busy=value; pasteButton.disabled=value; editor.setAttribute('aria-busy',String(value)); };
  const render = () => {
    preview.replaceChildren();
    if (image) { const img = document.createElement('img'); img.src = image; img.alt = 'พรีวิวรูปปก'; preview.append(img); }
    else { const label = document.createElement('span'); label.textContent = '▧'; preview.append(label); }
  };
  const prepare = async read => {
    const version = ++generation; setBusy(true); message.textContent = 'กำลังเตรียมรูป…';
    let bitmap;
    try {
      const file = await read();
      if (!current(version)) return;
      if (!supported.includes(file.type)) throw Error('ใช้ JPG, PNG หรือ WebP นะ ถ้ารูปเป็น HEIC ให้แปลงก่อน');
      if (file.size > 12 * 1024 * 1024) throw Error('รูปใหญ่เกิน 12 MB ลองเลือกรูปที่เล็กลง');
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 40000000) throw Error('ความละเอียดรูปสูงเกินไป ลองย่อรูปก่อน');
      const scale = Math.min(1, 720 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fffefb'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL('image/jpeg', .76);
      if (result.length > 450000) throw Error('รูปยังใหญ่เกินไป ลองครอปเฉพาะปกก่อน');
      if (!current(version)) return;
      image = result; render(); message.textContent = 'เตรียมรูปแล้ว · จะบันทึกเมื่อเธอกดยืนยัน';
    } catch (error) { if (current(version)) message.textContent = error.name === 'InvalidStateError' ? 'อ่านรูปนี้ไม่ได้ ลองใช้รูปอื่น' : error.message || 'อ่านรูปไม่ได้ ลองใช้รูปอื่น'; }
    finally { bitmap?.close(); if (version === generation) setBusy(false); }
  };
  const choose = event => {
    const file = event.target.files[0]; event.target.value = ''; if (file) prepare(() => file);
  };
  editor.addEventListener('paste', event => {
    const files = [...(event.clipboardData?.files ?? [])];
    if (!files.length) for (const item of event.clipboardData?.items ?? []) if (item.kind === 'file') { const file=item.getAsFile();if(file)files.push(file); }
    const file = files.find(file => supported.includes(file.type)) ?? files.find(file => file.type.startsWith('image/'));
    if (file) { event.preventDefault();pasteArea.value='';prepare(() => file); }
    else if (event.target === pasteArea) { event.preventDefault();pasteArea.value='';message.textContent='ยังไม่มีไฟล์รูปให้วาง ใช้ “คัดลอกรูปภาพ” แล้วลองใหม่ หรือกดเลือกรูป'; }
  });
  pasteArea.addEventListener('input', () => { pasteArea.value='';message.textContent='ช่องนี้สำหรับวางรูปที่คัดลอกไว้ ใช้ ⌘V / Ctrl+V หรือแตะค้างแล้วเลือกวาง'; });
  pasteButton.addEventListener('click', () => {
    if (!window.isSecureContext || !navigator.clipboard?.read) { root.querySelector('.photo-paste-options').open=true;pasteArea.focus();message.textContent='แตะช่องวางรูป แล้วใช้ ⌘V / Ctrl+V หรือแตะค้างเลือกวาง หากใช้ปุ่มวางรูปให้เปิดเว็บผ่าน HTTPS';return; }
    prepare(async () => {
      let items;
      try { items=await navigator.clipboard.read(); }
      catch { throw Error('ยังวางรูปไม่ได้ ลองอนุญาตให้เบราว์เซอร์วางรูป หรือใช้ช่องวางรูป / ปุ่มเลือกรูป'); }
      for(const item of items) {
        const type=supported.find(type=>item.types.includes(type)) ?? item.types.find(type=>type.startsWith('image/'));
        if(type)return item.getType(type);
      }
      throw Error('ยังไม่มีไฟล์รูปให้วาง ใช้ “คัดลอกรูปภาพ” แล้วลองใหม่ หรือกดเลือกรูป');
    });
  });
  root.querySelectorAll('#photo-file, #photo-camera').forEach(input => input.addEventListener('change', choose));
  root.querySelector('#photo-remove').addEventListener('click', () => { generation++; setBusy(false); pasteArea.value=''; image = ''; render(); message.textContent = 'ลบรูปจากพรีวิวแล้ว กดยืนยันเพื่อบันทึก'; });
  render();
  return () => { if (busy) throw Error('รอเตรียมรูปให้เสร็จก่อนนะ'); return image; };
}
