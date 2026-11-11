# สถานะ implementation และทางอ่านโครงสร้างปัจจุบัน

อัปเดตตามซอร์ส **0.10.3** — 31 ตุลาคม 2026

เอกสารนี้เดิมรวมรายละเอียดตั้งแต่ 0.4.0 และบันทึกเสริมหลายรุ่น จึงจัดข้อมูลปัจจุบันเป็นหัวข้อเฉพาะด้าน อ่านได้โดยไม่ต้องไล่ประวัติทั้งหมด:

| อยากเข้าใจอะไร | เอกสารปัจจุบัน |
| --- | --- |
| เทคโนโลยี แผนภาพระบบ หน้าที่ไฟล์ และขอบเขตที่ยังไม่มี | [18 — ภาพรวมเว็บและโครงสร้างโค้ด](../../reference/code-map.md) |
| series/entry/box, fields, ตาราง SQL, รูป, cache และ backup | [19 — ข้อมูลและฐานข้อมูล](../../reference/data-and-storage.md) |
| endpoints, session, operation/revision, outbox และ conflict | [20 — API และการซิงก์](../../reference/api-and-sync.md) |
| ติดตั้ง/อัปเดต HTTPS สำรองและกู้คืน | [09 — Docker](../../deployment.md) |
| คู่มือเฉพาะฟังก์ชัน แผน และประวัติ | [สารบัญเอกสาร](../../README.md) |

## ข้อเท็จจริงหลัก

- Vanilla HTML/CSS/JS + Node.js HTTP server; Docker pin Node 24.22.2 หนึ่ง app container ไม่มี ORM/runtime npm dependencies เพิ่ม
- SQLite schema **v3**, Library JSON **v2**; series รวมเรื่องกับฉบับ entries แยกรายเล่ม/box drafts คือถาดรอตรวจ catalogs คือหมวดต่อบัญชี ไม่ใช่ global catalog
- Email/password ใช้ scrypt และ session cookie; server ตรวจ owner ทุก API ส่วนตัว รวมรูป/export ไม่มี magic link หรือ SMTP
- รูปจริงเก็บไฟล์ใน volume ตาม owner; SQLite เก็บ metadata และข้อมูลชั้นอ้าง `/api/photos/HASH` ไม่เก็บ bytes รูปใน SQL
- IndexedDB เก็บ full state/outbox ต่อบัญชีก่อนส่ง server; operation ID กัน retry ซ้ำ ใช้ revisions และ conflict UI ไม่เขียนทับเงียบ ๆ
- ถังขยะอยู่ใน JSON เดิมผ่าน trashedAt; raw state/export/backup เก็บครบ หน้าชั้นใช้ activeLibrary เฉพาะแสดงผล
- แหล่ง ISBN เลือกต่อบัญชี: Google Books/Open Library และ NLT ทดลอง default-off; ทุกผลต้อง review ยังไม่มี AI provider
- หมวดส่วนตัว/สถานะการอ่าน/box member reading/CSV/รูปวางจาก clipboard ใช้ mutation และ owner scope เดิม

## เมื่อต้องแก้ต่อ

อ่าน [AGENTS.md](../../../AGENTS.md) และคู่มือเฉพาะส่วนก่อนแก้ ข้อมูลใน [03](data-model-proposal.md)/[04](architecture-proposal.md) เป็นแบบตั้งต้นที่มีข้อเสนออนาคต ไม่ใช่ schema/API ปัจจุบัน

ประวัติและเหตุผลคงอยู่ใน [07](../decisions.md)/[08](releases.md); หลักฐานตรวจรับอยู่ใน [06](../roadmap.md) รอบจัดเอกสารนี้ไม่เปลี่ยน runtime, schema, image version หรือข้อมูลใน instance ที่ใช้อยู่
