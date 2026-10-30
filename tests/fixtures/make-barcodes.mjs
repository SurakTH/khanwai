// Independent EAN-13 test patterns: ISBN control 9780306406157 and retail EAN 4006381333931.
// No user images or lookup service is involved. Regenerate with node tests/fixtures/make-barcodes.mjs.
import { deflateSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const P = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
function crc32(data) { let n = 0xffffffff; for (const byte of data) { n ^= byte; for (let bit = 0; bit < 8; bit++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); } return (n ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const name = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name,data]))); return Buffer.concat([length,name,data,crc]); }
async function fixture(name, value, rotate = false) {
  const bits = '0'.repeat(12) + '101' + [...value.slice(1,7)].map((d,i) => (P[Number(value[0])][i] === 'L' ? L : G)[Number(d)]).join('') + '01010' + [...value.slice(7)].map(d => [...L[Number(d)]].map(b => b === '0' ? '1' : '0').join('')).join('') + '101' + '0'.repeat(12);
  const w = bits.length * 4, h = 240, width = rotate ? h : w, height = rotate ? w : h;
  const rows = Buffer.alloc((width + 1) * height);
  for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
    const originalX = rotate ? y : x, originalY = rotate ? h - 1 - x : y;
    rows[y * (width + 1) + x + 1] = originalY >= 20 && originalY < 220 && bits[Math.floor(originalX / 4)] === '1' ? 0 : 255;
  }
  const header=Buffer.alloc(13); header.writeUInt32BE(width,0); header.writeUInt32BE(height,4); header[8]=8;
  await writeFile(new URL(name,import.meta.url), Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
}
await fixture('isbn.png','9780306406157');
await fixture('isbn-rotated.png','9780306406157',true);
await fixture('retail.png','4006381333931');
