# โครงสร้างที่ implementation แล้วใน 0.4.0

## เพิ่มใน 0.9.0

หมวดหมู่ส่วนตัวอยู่ใน optional state.categories / sync catalog:categories พร้อม SQLite catalogs แยก owner และ schema DB v3 อัปเกรดจาก v1/v2 โดยเพิ่มตาราง ไม่เขียนข้อมูลหนังสือเดิม ตั้งค่าจัดการเพิ่ม/เปลี่ยนชื่อ/ลบพร้อมย้าย ใช้หมวดเดียวกันทุกแบบฟอร์ม ตัวกรอง และ CSV รวมใน outbox/export/import/backup เดิม ดู [15-categories.md](15-categories.md)

mobile-inputs.css โหลดท้ายเพื่อให้ช่องกรอกมือถืออย่างน้อย 16px โดยคง pinch zoom และ shelf layout เดิม shell-v27 รวม asset ใหม่ทั้งหมด


เอกสารนี้ระบุระบบปัจจุบัน ต่างจากแบบเป้าหมายใน 03/04 ที่ยังมีส่วนอนาคต

## ข้อมูลและบัญชี

Node 24.22.2 HTTP + node:sqlite ไม่เพิ่ม runtime npm dependency ใช้ scrypt แบบ async พร้อม salt สุ่ม เก็บ session token แบบ hash ใน SQLite cookie HttpOnly/SameSite=Lax อายุ 7 วัน เปิด Secure เมื่อใช้ HTTPS ไม่มีอีเมลยืนยัน/ส่งอีเมล/ผู้ให้บริการ auth ภายนอก เป็นการเลือก implementation ให้เหมาะกับ self-host ไม่ใช่การอ้างว่าผู้ใช้เลือก magic link แล้ว

SQLite ใช้ WAL, foreign keys, synchronous FULL, user_version=2 มี migration เริ่มฐานข้อมูลใหม่และปฏิเสธ schema อนาคต ตาราง preferences/users/sessions/series/entries/drafts/photos/operations/changes/rate_limits/maintenance ทุก record ส่วนตัวรวม key เจ้าของ entries มี composite FK ไป series ของเจ้าของเดียวกัน

payload ของแต่ละ entity เก็บ JSON ที่ตรวจรูปแบบแล้ว แยกแถวและ revision จริง ไม่ได้เก็บทั้งบัญชีใน blob เดียว ส่วนเรื่องกับฉบับยังรวมใน series; ยังไม่ได้แยก work/edition กลางตามแบบใน 03 ไม่มี catalog สาธารณะ

รูป browser ย่อ/re-encode ก่อนส่งหลังยืนยัน เก็บไฟล์ immutable ใน /data/photos/OWNER/HASH.ext เก็บ reference /api/photos/HASH ในข้อมูล ตรวจ owner ทุกครั้งก่อนเสิร์ฟ ไม่มี static URL อ่านข้ามบัญชี ภาพบาร์โค้ดใช้เฉพาะอ่านในเครื่อง ไม่อัปโหลดเป็นปกโดยอัตโนมัติ

## ซิงก์

GET /api/library คืน snapshot + versions + cursor; GET /api/sync?after=N คืน delta เฉพาะเจ้าของ POST /api/sync รับ operation ID และ changes ที่มี baseRevision ตรวจทั้งหมดใน transaction เดียว ถ้าชนคืน 409 พร้อมข้อมูลเปรียบเทียบ ไม่เขียนบางส่วน ส่ง operation ID เดิมซ้ำคืนผลเดิม ถ้าเปลี่ยน payload แต่ใช้ ID เดิมปฏิเสธ

การแก้ record เดิมหลายครั้งตอน offline อ้าง revision ของ operation ก่อนหน้าได้ ใช้ tombstone แทนลบประวัติทันที ป้องกันเครื่องเก่าคืนรายการที่ลบแล้ว ผู้ใช้เลือกฝั่งเซิร์ฟเวอร์/ในเครื่องใน conflict UI ก่อนสร้าง operation ใหม่บน revision ล่าสุด

IndexedDB accounts แยก user UUID มี state/versions/cursor/outbox/conflict/lastSynced/generation บันทึกแบบ transaction ก่อนแสดงว่าอยู่ในคิว ใช้ generation compare-and-swap ป้องกันแท็บเก่าทับงานรอส่งอีกแท็บ เมื่อพบให้โหลดใหม่ ชื่อสถานะแยกออฟไลน์/รอส่ง/เซิร์ฟเวอร์ยืนยัน

API ไม่เข้า service-worker cache รูป private cache แยก owner และ mapping ต่อ client; ออกจากระบบล้าง cache/ข้อมูลบัญชีนี้ ถ้า session หมดเก็บ outbox ของบัญชีเดิมไว้ให้ login อีกครั้ง ไม่ส่งด้วยบัญชีใหม่ local cache ไม่ได้เข้ารหัสกับผู้ที่มีสิทธิ์อ่าน browser profile/เครื่อง ต้องออกจากระบบเมื่อใช้เครื่องร่วม

ขณะ form เปิดเก็บ base revision ไว้ จึงไม่ถือว่าข้อมูลใหม่ที่โหลดระหว่างกรอกได้รับการยอมรับแล้ว การอัปเดต SW รอ lifecycle ปกติ ไม่ skipWaiting/force reload ฟอร์มหรือ outbox ยังอยู่ใน IndexedDB ไม่มี migration IndexedDB เพิ่มในรอบนี้

## นำเข้าและสำรอง

schemaVersion2 JSON รวมรูป inline; โหลด v1 เป็น physical โดยรักษา ID/box members/status นำเข้ามี preview default รวมแล้วข้าม ID/ISBN ที่ซ้ำ เลือกแทนที่ได้หลังยืนยัน ไม่ auto-import localStorage ของต้นแบบ

operator backup ใช้ SQLite backup API และ maintenance lease ป้องกันแก้ข้อมูล/ลบรูปกลางทาง ต่ออายุ lease ระหว่างทำ สำเนารวมไฟล์ที่อ้างในตาราง photos และ checksums กู้ไปโฟลเดอร์ว่าง ทดสอบ integrity/FK/ไฟล์แล้วล้าง sessions

retention ตอนนี้: เก็บ operation IDs, change log และ tombstone ไม่หมดอายุ เพื่อไม่ทำ offline retry/delta ผิด รูปเก่าที่เปลี่ยนแล้วเก็บจนลบบัญชี ไม่มี GC อัตโนมัติ ไฟล์จาก transaction ที่ล้มอาจเหลือโดยไม่มี reference; ไม่ถูกเสิร์ฟผ่าน API และไม่รวม backup จัด GC ที่เคารพ snapshot/backup ก่อน scale-up ข้อมูลขนาด 200+ ไม่ต้องเพิ่ม Redis/queue server

## ข้อจำกัดที่ยังต้องทำ/ลอง

- ยังไม่มี AI provider/extraction และไม่ส่งรูปส่วนตัวไป AI
- Google Books lookup อาจไม่พบหรือ 429 ต้องกรอกเองได้เสมอ ไม่มีคำรับรอง coverage
- กล้อง Safari/iPhone, Android จริง และ install PWA ยังต้องทดลองบนอุปกรณ์ผู้ใช้
- ยังไม่มี CSV export, UI สร้างบ็อกซ์ใหม่, provenance ราย field, password recovery ทางอีเมล หรือ public hosting
- ไม่มี multi-process scaling/automatic backup scheduler ใช้หนึ่ง app กับ local disk volume; ไม่วาง SQLite WAL บน shared network filesystem

เอกสารทางการที่ตรวจรอบ implementation: [Node SQLite v24](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html) (release candidate จึง pin runtime), [Node scrypt](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [SQLite backup](https://www.sqlite.org/backup.html)

0.4.0 เพิ่ม preferences ต่อ owner พร้อม revision แยกจาก library delta/outbox; GET/PUT /api/settings ตรวจ owner จาก session และ expected owner ใน body, CAS revision, ปฏิเสธ provider/field แปลก API key ไม่อยู่ใน settings ดูรายละเอียด 07-decisions.md


0.6.0 เพิ่ม shelf-tools/bulk-edit/csv-import/csv-ui เป็น ES modules ที่อยู่ใน PWA shell Optional tags อยู่ใน record/draft เดิม ตรวจผ่าน validateState ฝั่ง server และไม่เปลี่ยน DB user_version การเลือกหลายรายการและ CSV ลงผ่าน mutate เดิมจึงใช้ generation CAS/revision/operation IDs/conflict รวม export/backup ตามเจ้าของ ไม่ใช่ bulk endpoint ที่ข้าม auth คู่มือจริงดู 11-shelf-management.md CSV export และแบบฟอร์มสร้างบ็อกซ์เฉพาะยังไม่ทำ แต่ CSV รองรับ box พร้อม explicit members


0.7.0 ใช้ reading.js เป็น shared enum/validation/box member helpers ระหว่าง browser และ server entry.readingStatus + readingByMember เก็บใน JSON เดิมไม่เปลี่ยน SQLite user_version รองรับ generation CAS, outbox, conflict, portable export, backup/restore ต่อ owner เหมือน entry เดิม ดู docs/12-reading-status.md
