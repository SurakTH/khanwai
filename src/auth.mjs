import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { AppError } from './storage.mjs';

const derive = promisify(scrypt);
const parameters = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export function credentials(body, { registration = false } = {}) {
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') throw new AppError(400, 'invalid_credentials', 'กรอกอีเมลและรหัสผ่านให้ครบ');
  const email = body.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || body.password.length > 256 || body.password.length < (registration ? 10 : 1)) throw new AppError(400, 'invalid_credentials', registration ? 'ใช้อีเมลที่ถูกต้องและรหัสผ่านอย่างน้อย 10 ตัวอักษร' : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (registration && (!name || name.length > 80)) throw new AppError(400, 'invalid_name', 'กรอกชื่อที่แสดงไม่เกิน 80 ตัวอักษร');
  return { email, password: body.password, name };
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, parameters);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const parts = typeof stored === 'string' ? stored.split(':') : [];
  const valid = parts.length === 3 && parts[0] === 'scrypt' && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2]);
  const hash = await derive(password, valid ? parts[1] : '0'.repeat(32), 64, parameters);
  return valid && timingSafeEqual(hash, Buffer.from(parts[2], 'hex'));
}
export function sessionToken(req) {
  return (req.headers.cookie ?? '').split(';').map(s => s.trim()).find(s => s.startsWith('khanwai_session='))?.slice('khanwai_session='.length) ?? '';
}
export function startSession(storage, owner, secure) {
  const token = randomBytes(32).toString('hex'), age = 7 * 24 * 3600;
  storage.addSession(owner, token, Date.now() + age * 1000);
  return `khanwai_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`;
}
export const clearCookie = secure => `khanwai_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
