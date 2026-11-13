import { decodePixels } from './vendor/barcode-decoder.js';
import { normalizeIsbn } from './lib.js';

export function scanControls() {
  return '<div class="barcode-actions"><button type="button" class="button" data-scan="camera"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8a2 2 0 0 1 2-2h2.5l1.4-2h4.2l1.4 2H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>ถ่ายบาร์โค้ด</button><button type="button" class="button" data-scan="file"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m20 15-4.5-4.5L7 19"/></svg>เลือกรูปบาร์โค้ด</button></div>';
}

export async function decodeBarcodeFile(file) {
  if (file.size > 12 * 1024 * 1024) throw Error('รูปใหญ่เกิน 12 MB ลองถ่ายเฉพาะบาร์โค้ดหรือย่อรูปก่อน');
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) throw Error('ใช้รูป JPG, PNG หรือ WebP นะ หากเป็น HEIC แล้วอ่านไม่ได้ให้แปลงเป็น JPG ก่อน');
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(Error('เปิดรูปไม่ได้ ลองใช้ JPG หรือ PNG แล้วเลือกใหม่ได้เลย'));
      image.src = url;
    });
    const { naturalWidth: width, naturalHeight: height } = image;
    if (!width || !height || width * height > 40000000) throw Error('รูปมีความละเอียดสูงเกินไป ลองครอปเฉพาะบาร์โค้ดก่อน');
    const scale = Math.min(1, 1600 / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    // Canvas is shared across iOS/Android; no BarcodeDetector or camera API is required.
    const canvas = document.createElement('canvas');
    let nonIsbn = false;
    for (const rotated of [false, true]) {
      canvas.width = rotated ? h : w; canvas.height = rotated ? w : h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (rotated) { ctx.translate(h, 0); ctx.rotate(Math.PI / 2); }
      ctx.drawImage(image, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      try {
        const raw = decodePixels(pixels.data, canvas.width, canvas.height);
        const isbn = normalizeIsbn(raw);
        if (isbn) return isbn;
        nonIsbn = true;
      } catch { /* Try the other orientation before asking for another photo. */ }
    }
    if (nonIsbn) throw Error('อ่านบาร์โค้ดได้ แต่ไม่ใช่ ISBN หนังสือ ลองถ่ายรหัสที่ขึ้นต้น 978 หรือ 979');
    throw Error('ยังอ่าน ISBN ไม่ได้ ลองถ่ายให้ตรง เห็นแท่งครบทั้งสองข้าง หรือพิมพ์เลขใต้บาร์โค้ดแทน');
  } finally { image.onload = null; image.onerror = null; URL.revokeObjectURL(url); }
}
