// Local prototype only: images never leave this browser.
export function photoEditorMarkup(escape) {
  return `<section class="photo-editor" aria-label="แนบรูปปก"><div id="photo-preview" class="photo-preview"><span aria-hidden="true">▧</span></div><div><strong>รูปปก</strong><p class="subtitle">เลือกจากเครื่องหรือถ่ายรูป · JPG, PNG, WebP<br>พรีวิวรูปในเครื่อง แล้วส่งเก็บในบัญชีหลังยืนยัน</p><div class="photo-actions"><label class="button">เลือกรูป<input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp" class="visually-hidden"></label><label class="button">ถ่ายรูป<input id="photo-camera" type="file" accept="image/*" capture="environment" class="visually-hidden"></label><button type="button" class="button ghost" id="photo-remove">ลบรูป</button></div><p id="photo-status" class="subtitle" role="status">${escape('ไม่จำเป็นต้องมีรูปก็เพิ่มหนังสือได้')}</p></div></section>`;
}

export function mountPhotoEditor(root, initial = '') {
  let image = initial, busy = false, generation = 0;
  const preview = root.querySelector('#photo-preview');
  const message = root.querySelector('#photo-status');
  const render = () => {
    preview.replaceChildren();
    if (image) { const img = document.createElement('img'); img.src = image; img.alt = 'พรีวิวรูปปก'; preview.append(img); }
    else { const label = document.createElement('span'); label.textContent = '▧'; preview.append(label); }
  };
  const choose = async event => {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    const version = ++generation; busy = true; message.textContent = 'กำลังเตรียมรูป…';
    let bitmap;
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw Error('ใช้ JPG, PNG หรือ WebP นะ ถ้ารูปเป็น HEIC ให้แปลงก่อน');
      if (file.size > 12 * 1024 * 1024) throw Error('รูปใหญ่เกิน 12 MB ลองเลือกรูปที่เล็กลง');
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 40000000) throw Error('ความละเอียดรูปสูงเกินไป ลองย่อรูปก่อน');
      const scale = Math.min(1, 720 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fffefb'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL('image/jpeg', .76);
      if (result.length > 450000) throw Error('รูปยังใหญ่เกินไป ลองครอปเฉพาะปกก่อน');
      if (version !== generation || !root.isConnected) return;
      image = result; render(); message.textContent = 'เตรียมรูปแล้ว · จะบันทึกเมื่อเธอกดยืนยัน';
    } catch (error) { if (version === generation && root.isConnected) message.textContent = error.message || 'อ่านรูปไม่ได้ ลองใช้รูปอื่น'; }
    finally { bitmap?.close(); if (version === generation) busy = false; }
  };
  root.querySelectorAll('#photo-file, #photo-camera').forEach(input => input.addEventListener('change', choose));
  root.querySelector('#photo-remove').addEventListener('click', () => { generation++; busy = false; image = ''; render(); message.textContent = 'ลบรูปจากพรีวิวแล้ว กดยืนยันเพื่อบันทึก'; });
  render();
  return () => { if (busy) throw Error('รอเตรียมรูปให้เสร็จก่อนนะ'); return image; };
}
