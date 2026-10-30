import EAN13Reader from '@zxing/library/esm/core/oned/EAN13Reader.js';
import RGBLuminanceSource from '@zxing/library/esm/core/RGBLuminanceSource.js';
import BinaryBitmap from '@zxing/library/esm/core/BinaryBitmap.js';
import HybridBinarizer from '@zxing/library/esm/core/common/HybridBinarizer.js';
import DecodeHintType from '@zxing/library/esm/core/DecodeHintType.js';

export function decodePixels(rgba, width, height) {
  const luminance = new Uint8ClampedArray(width * height);
  for (let i = 0; i < luminance.length; i++) {
    const p = i * 4;
    luminance[i] = (rgba[p] + 2 * rgba[p + 1] + rgba[p + 2]) / 4;
  }
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, width, height)));
  return new EAN13Reader().decode(bitmap, new Map([[DecodeHintType.TRY_HARDER, true]])).getText();
}
