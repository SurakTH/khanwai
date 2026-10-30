# สถาปัตยกรรม บัญชี PWA และซิงก์

> สถานะ implementation 0.3.0 ดู [10-implementation.md](10-implementation.md) เอกสารนี้มีแบบเป้าหมายและข้อเสนออนาคตที่ยังไม่ทำ ไม่ใช้แทน schema ที่ทำงานจริง

## แนวทางเสนอ

อัปเดตตามคำขอผู้ใช้: ให้ Docker เป็นทางหลักและคุมระบบให้เรียบง่าย ดู `09-docker.md` ทิศทางคือหนึ่ง app image + data volume เมื่อมี server storage เสนอ SQLite ใน process เดียว ส่วนบริการ auth แบบ hosted เป็นตัวเลือก ไม่ใช่ข้อบังคับ ยังไม่ได้เลือก auth จริง ไม่เพิ่ม reverse proxy หรือบริการแยกเพียงเพื่อให้แผนครบทุกเทคโนโลยี

ใช้เว็บ responsive หนึ่งชุดกับ backend และฐานข้อมูลกลาง มี local database ในเบราว์เซอร์สำหรับสำเนาข้อมูลและงานรอส่ง แยกการติดตั้ง PWA ออกจากความสามารถ sync: ติดตั้งแล้วไม่ได้แปลว่าสำรองข้อมูลขึ้นคลาวด์แล้ว

ยังไม่เลือก framework หรือบริการ ภารกิจ Phase 0 คือเลือกชุดที่รองรับ auth, relational constraints, transactions, private file storage, migrations และการทดสอบได้ โดยไม่เพิ่มบริการเกินจำเป็น

## ส่วนประกอบ

| ส่วน | หน้าที่ |
| --- | --- |
| Web/PWA | UI, กล้อง/เลือกไฟล์, local search, review, outbox |
| Auth | ยืนยันตัวตน จัดการ session และการกู้การเข้าใช้ |
| Application backend | ตรวจสิทธิ์ validation, CRUD, conflict handling, ISBN/AI adapters |
| Database | ข้อมูลส่วนตัว ความสัมพันธ์ revision และ idempotency |
| Private storage | รูปที่ผู้ใช้เก็บไว้ ใช้ลิงก์จำกัดอายุเมื่อจำเป็น |
| Background jobs | งาน OCR/AI และ lookup ที่ใช้เวลานาน หากผลทดลองชี้ว่าจำเป็น |

API สำคัญเชิงหน้าที่: อ่าน delta ชั้น, ส่ง mutation พร้อม base revision, สร้าง lookup, เริ่ม AI extraction, จัดการ draft, export/import และลบบัญชี ไม่ต้องมี public API หรือ microservices ในเวอร์ชันแรก

## Auth และขอบเขตข้อมูล

- เสนอเริ่มจาก email magic link ต้องตรวจ UX เมื่อเปิดลิงก์จากคนละเครื่อง/เบราว์เซอร์และโควตาอีเมลก่อนเลือกบริการ
- ตรวจ owner ฝั่ง backend ทุก request และไฟล์ ไม่เชื่อ owner ID จาก client ถ้าฐานข้อมูลรองรับให้ใช้ row policies เพิ่มชั้นป้องกัน
- key ของ AI/metadata ที่เป็นความลับอยู่ฝั่ง server และไม่อยู่ใน frontend bundle
- draft, export และงาน background ต้องตรวจเจ้าของเหมือน LibraryEntry
- จำกัดขนาด/ชนิดไฟล์ ตรวจไฟล์จริง และไม่ให้ URL ที่ผู้ใช้ใส่กลายเป็นคำสั่ง fetch ที่ไม่จำกัด
- ตั้งขีดจำกัด AI/lookup ต่อบัญชี พร้อม timeout และ retry ที่มีเพดาน ไม่บันทึก token หรือรูปส่วนตัวลง log

## PWA และข้อมูลในเครื่อง

- ให้บริการผ่าน HTTPS พร้อม web app manifest, icons และ service worker
- cache ไฟล์แอพแยกจากข้อมูลบัญชี ใช้ IndexedDB หรือเทียบเท่าสำหรับข้อมูล structured/outbox
- อย่า cache response ส่วนตัวแบบรวมบัญชีด้วย URL อย่างเดียว
- ดาวน์โหลดชั้นทั้งหมดได้สำหรับขนาดเริ่มต้น แต่รูปปกโหลดตามต้องการและมีขนาดจำกัด
- ทุกสำเนาในเครื่องมี namespace ตาม account ID การสลับบัญชีต้องไม่เห็นข้อมูลค้างของอีกคน
- browser storage อาจถูกล้าง/ขับออก งานที่ยังไม่ซิงก์จึงยังเสี่ยงสูญหาย ต้องแสดงค้างส่งชัดเจน
- ออฟไลน์ในเครื่องที่เคยล็อกอินยังอ่านข้อมูล cached ได้ จึงต้องมีคำแนะนำ logout สำหรับเครื่องร่วม และล้าง cache ส่วนตัวเมื่อ logout
- รุ่นแรกไม่รับรองการใช้ออฟไลน์หลัง logout หรือ login ครั้งแรกขณะไม่มีเน็ต
- แสดง update prompt เมื่อมีแอพใหม่ รักษา outbox และทำ local schema migration ก่อน reload ห้ามรีโหลดกลางฟอร์มอัตโนมัติ

## โปรโตคอลซิงก์

1. ผู้ใช้แก้ข้อมูล -> เขียน local state และ outbox ใน transaction เดียวกัน
2. operation มี ID ที่คงเดิมทุก retry, account ID, entity ID และ base revision
3. เมื่อมีเน็ตและ session ใช้งานได้ client ส่ง operation เซิร์ฟเวอร์ตรวจสิทธิ์ validation และ revision
4. เซิร์ฟเวอร์บันทึกข้อมูลกับผล operation แบบ atomic; retry ID เดิมได้ผลเดิม ไม่เพิ่มซ้ำ
5. ถ้า revision ตรง คืน revision ใหม่แล้วจึง mark ว่าซิงก์แล้ว
6. ถ้าขัดแย้ง คืนข้อมูลปัจจุบัน เก็บการแก้ในเครื่องไว้ ให้ผู้ใช้เลือกและสร้าง operation ใหม่บน revision ล่าสุด
7. ดึง delta ด้วย server cursor รวม tombstone; ถ้า cursor หมดอายุทำ full resync โดยไม่ทิ้ง outbox
8. สร้าง parent ก่อน child และรักษาลำดับ operation ของ record เดียวกัน หาก parent ไม่สำเร็จ child ต้องไม่ถูกส่งแบบ orphan

เริ่ม sync เมื่อเปิดแอพ กลับเข้าแอพ กลับมาออนไลน์ หรือกดซิงก์ ไม่พึ่ง Background Sync ว่าจะทำงานได้ทุกเบราว์เซอร์ แสดงเวลาซิงก์ล่าสุดและจำนวนงานค้าง

## การลบและกู้ข้อมูล

- ลบรายการด้วย tombstone เพื่อส่งการลบไปทุกเครื่อง ไม่ให้ stale client คืนรายการเอง
- กำหนดอายุ operation/tombstone และวิธี force resync ก่อนเก็บกวาดข้อมูลเก่า
- JSON export แบบมี schema version เป็นรูปแบบกู้คืนหลัก; CSV ใช้อ่าน/แก้ภายนอก แต่อาจไม่เก็บโครงสร้างเซ็ตครบ
- import มี validation, preview, ตรวจซ้ำ และเลือกว่าจะเพิ่ม/ข้าม ห้าม overwrite ทั้งชั้นเงียบ ๆ
- server backup เป็นงานแยกจาก export ต้องกำหนดรอบ backup, retention และทดสอบ restore ก่อน production
- การลบบัญชีต้องครอบคลุมข้อมูล รูป งานรอประมวลผล และอธิบายนโยบาย backup ของบริการจริง

## Deployment และการปฏิบัติการ

- แยก development/staging/production และ secrets แต่ละชุด
- มี migrations ที่ตรวจได้ แผน rollback และการตรวจสุขภาพ lookup/AI/sync โดยไม่เก็บข้อมูลส่วนตัวเกินจำเป็น
- ตั้ง budget alert และเพดานค่าใช้จ่ายเมื่อบริการรองรับ อย่าเปิด AI ไม่จำกัด
- ทดสอบติดตั้งและกล้องบนอุปกรณ์เป้าหมายจริง การรองรับเบราว์เซอร์ยังต้องยืนยันใน Phase 0
