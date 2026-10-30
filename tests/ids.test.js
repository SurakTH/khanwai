import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { newId } from '../public/ids.js';
const v4=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
test('ID creation uses native UUID when available and CSPRNG v4 UUID when it is absent',()=>{
 const native='native-id';assert.equal(newId({randomUUID:()=>native}),native);
 const fallback={getRandomValues:bytes=>webcrypto.getRandomValues(bytes)};
 const values=Array.from({length:1000},()=>newId(fallback));
 assert.ok(values.every(value=>v4.test(value)));assert.equal(new Set(values).size,1000);
 assert.match(newId({getRandomValues:bytes=>{bytes.fill(255);return bytes;}}),v4);
 assert.throws(()=>newId({}),/สร้างรหัสรายการไม่ได้/);
});
