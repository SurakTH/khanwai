import { LibraryStorage, sha256 } from './storage.mjs';
import { hashPassword } from './auth.mjs';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync, lstatSync, copyFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function restoreBackup(source, destination) {
  const origin = path.resolve(source), target = path.resolve(destination);
  if (existsSync(target) && readdirSync(target).length) throw Error('ปลายทางต้องเป็นโฟลเดอร์ว่าง เพื่อไม่เขียนทับข้อมูลเดิม');
  const manifest = JSON.parse(readFileSync(path.join(origin, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || manifest.database?.path !== 'library.sqlite' || !Array.isArray(manifest.files)) throw Error('รูปแบบ backup ไม่รองรับ');
  const files = [manifest.database, ...manifest.files];
  for (const file of files) {
    if (file.path !== 'library.sqlite' && !/^photos\/[a-f0-9-]{36}\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(file.path)) throw Error('ชื่อไฟล์ใน backup ไม่ถูกต้อง');
    const sourcePath = path.join(origin, file.path);
    if (!lstatSync(sourcePath).isFile() || lstatSync(sourcePath).isSymbolicLink() || sha256(readFileSync(sourcePath)) !== file.sha256) throw Error(`ไฟล์ backup เสียหรือไม่ครบ: ${file.path}`);
  }
  const verify = new DatabaseSync(path.join(origin, 'library.sqlite'), { readOnly: true });
  try {
    if (verify.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || verify.prepare('PRAGMA foreign_key_check').all().length || ![1,2].includes(verify.prepare('PRAGMA user_version').get().user_version)) throw Error('ฐานข้อมูล backup ไม่ผ่านการตรวจสอบ');
  } finally { verify.close(); }
  mkdirSync(target, { recursive: true, mode: 0o700 });
  for (const file of files) { const output = path.join(target, file.path); mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 }); copyFileSync(path.join(origin, file.path), output); }
  const storage = new LibraryStorage(target);
  try {
    storage.db.exec('DELETE FROM maintenance; DELETE FROM sessions;');
    for (const user of storage.db.prepare('SELECT id FROM users').all()) { storage.exportAccount(user.id); storage.settings(user.id); }
  } finally { storage.close(); }
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, arg1, arg2] = process.argv.slice(2);
  try {
    if (command === 'restore') {
      if (!arg1 || !arg2) throw Error('ใช้: node src/cli.mjs restore BACKUP_DIRECTORY EMPTY_DATA_DIRECTORY');
      restoreBackup(arg1, arg2); console.log('กู้ข้อมูลสำเร็จ ต้องเข้าสู่ระบบใหม่เมื่อเปิดแอพด้วย DATA_DIR ปลายทาง');
    } else {
      const directory = process.env.DATA_DIR ?? './data', storage = new LibraryStorage(directory);
      try {
        if (command === 'backup') {
          const destination = arg1 ?? path.join(directory, 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
          mkdirSync(path.dirname(path.resolve(destination)), { recursive: true, mode: 0o700 });
          const result = await storage.backupTo(path.resolve(destination));
          console.log(`สำรองข้อมูลแล้ว: ${path.resolve(destination)} (${result.files.length} รูป)`);
        } else if (command === 'reset-password') {
          const user = storage.findUser(String(arg1 ?? '').toLowerCase());
          if (!user) throw Error('ไม่พบบัญชีนี้');
          let password = ''; for await (const chunk of process.stdin) password += chunk;
          password = password.replace(/\r?\n$/, '');
          if (password.length < 10 || password.length > 256) throw Error('ส่งรหัสผ่านใหม่ทาง stdin ความยาว 10–256 ตัวอักษร');
          const hash = await hashPassword(password);
          storage.transaction(() => { storage.db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, user.id); storage.db.prepare('DELETE FROM sessions WHERE owner=?').run(user.id); });
          console.log('เปลี่ยนรหัสผ่านแล้ว ทุกเครื่องต้องเข้าสู่ระบบใหม่');
        } else throw Error('คำสั่ง: backup [DIRECTORY] | restore BACKUP_DIRECTORY EMPTY_DATA_DIRECTORY | reset-password EMAIL (password via stdin)');
      } finally { storage.close(); }
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
