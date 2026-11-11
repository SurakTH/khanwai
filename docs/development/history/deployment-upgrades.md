# ประวัติการอัปเกรด Docker

คำสั่งในหน้านี้บันทึกไว้ตามรุ่นในอดีต ขั้นตอนสำหรับระบบปัจจุบันอยู่ใน [คู่มือเซิร์ฟเวอร์](../../deployment.md)

## อัปเกรดเป็น 0.10.0

```sh
docker compose exec -T app node src/cli.mjs backup /data/backups/pre-0100-trash
git pull
```

ตั้ง `KHANWAI_IMAGE=khanwai:0.10.0` ใน `.env` โดยเก็บค่าอื่นเดิม แล้ว:

```sh
docker build -t khanwai:0.10.0 .
docker compose up -d
```

รอบนี้ DB ยังเป็น v3 ไม่เพิ่มบริการ ถังขยะรวมใน JSON/SQLite backup พร้อมรูป อัปเดตเว็บหรือ PWA ทุกเครื่องก่อนแก้ต่อ เพราะรุ่นเก่าอาจยังแสดงรายการที่อยู่ในถังขยะ หากต้องย้อนกลับให้กู้ backup ก่อนอัปเดตลง directory ว่างตามวิธีในส่วนก่อนหน้า ดู [วิธีใช้สุ่มและถังขยะ](../../reference/trash-and-picker.md)

## อัปเกรดเป็น 0.9.0: หมวดหมู่ส่วนตัว

สำรองด้วย container เดิมก่อนอัปเกรด:

```sh
docker compose exec -T app node src/cli.mjs backup /data/backups/pre-090-categories
git pull
```

แก้เฉพาะ `KHANWAI_IMAGE=khanwai:0.9.0` ใน `.env` ของเครื่อง เก็บ APP_ORIGIN, bind และค่าอื่นเดิมไว้ จากนั้น:

```sh
docker build -t khanwai:0.9.0 .
docker compose up -d
```

จะเพิ่มตารางหมวดเป็น SQLite v3 อัตโนมัติ หนังสือ/บัญชี/รูปเดิมคงอยู่ หมวดรวมใน JSON export และ server backup แล้ว ไม่เพิ่ม container หรือ reverse proxy หลังเข้าเว็บให้รับอัปเดต PWA เมื่อพร้อม ดูวิธีใช้ที่ [หมวดหมู่](../../reference/categories.md)

หากต้องย้อนกลับ 0.8.6 ให้ใช้ image เก่ากู้ **backup ก่อนอัปเกรด** ลง directory ว่าง ไม่เปิด DB v3 ด้วย image เก่า:

```sh
KHANWAI_IMAGE=khanwai:0.8.6 docker compose run --rm --no-deps app node src/cli.mjs restore /data/backups/pre-090-categories /data/rollback-086
```

จากนั้นตั้ง `.env` เป็น `KHANWAI_IMAGE=khanwai:0.8.6` และ `DATA_DIR=/data/rollback-086` แล้ว `docker compose up -d` การย้อนผ่าน backup จะได้ข้อมูล ณ เวลาสำรอง จึงควรเก็บ export ล่าสุดไว้ก่อนด้วย

## ISBN lookup ใน 0.4.0

Google Books มี Open Library เป็นแหล่งสำรองอัตโนมัติ มี cache/dedup และพักคำขอเมื่อโควตาหมด UI บอกผลรายแหล่ง การมี ISBN ไม่รับประกันว่าฐานใดฐานหนึ่งมีข้อมูล โดยเฉพาะฉบับภาษาไทย

ถ้ามี Google Books API key ของตัวเองแล้ว ใส่ `GOOGLE_BOOKS_API_KEY=...` ใน `.env` แล้ว `docker compose up -d --wait` key ใช้เฉพาะฝั่งเซิร์ฟเวอร์ ไม่ต้องใช้ key เพื่อเริ่มเว็บ และไม่รับประกันว่าการใส่ key จะทำให้ค้นพบเล่มที่ไม่มีในฐานข้อมูล อย่า commit `.env` หรือส่ง key ในภาพหน้าจอ/แชต

## 0.4.0: เลือกแหล่งข้อมูลและ schema v2

ในเว็บไป **ข้อมูลและการตั้งค่า → แหล่งข้อมูลหนังสือ** เลือกเปิดแหล่งที่ต้องการ แล้วใช้ ↑/↓ เรียงลำดับและกดบันทึก ใช้ร่วมกันในบัญชีนี้ทุกเครื่อง ไม่ใช้ผลจากแหล่งที่ปิด ถ้าปิดทั้งหมดจะยังสแกน ISBN เช็กชั้น/กรอกเองได้แต่ไม่เรียกบริการภายนอก การบันทึก settings ต้องออนไลน์และถ้าชนกับอีกเครื่องจะให้โหลดค่าล่าสุดก่อน

ค่าเริ่มต้นยังเป็น Google Books → Open Library ส่วน NLT ต้องเลือกเปิดเอง (ทดลอง) ถ้าต้องการลอง ISBN ไทย ให้เปิด NLT เลื่อนขึ้นบนแล้วบันทึก ไม่ต้องมีเครื่องยิงหรือ API key สำหรับเส้นทาง NLT ที่ทดสอบครั้งนี้

อัปเกรดครั้งนี้เพิ่ม SQLite preferences เป็น schema v2 ให้สำรองด้วย image เดิมก่อน Compose up ข้อมูลหนังสือ/บัญชี/รูปเดิมคงอยู่ การตั้งค่าแหล่งข้อมูลรวมใน server backup แต่ยังไม่อยู่ใน JSON ส่งออกหนังสือ

ถ้าจะ rollback ไป 0.3.1 ต้องใช้ **backup ก่อน migration** และใช้ CLI จาก **image 0.3.1** กู้ลงโฟลเดอร์ใหม่ (CLI 0.4.0 จะ migrate backup เก่าเป็น v2):

```sh
KHANWAI_IMAGE=khanwai:0.3.1 docker compose run --rm --no-deps app node src/cli.mjs restore /data/backups/pre-040-settings /data/rollback-031
```

จากนั้นตั้ง KHANWAI_IMAGE=khanwai:0.3.1 และ DATA_DIR=/data/rollback-031 ใน .env แล้ว Compose up อย่าให้ image เก่าเปิดฐาน v2 โดยตรง ข้อมูลที่เพิ่มหลัง backup ไม่อยู่ใน snapshot นี้

Smoke test migration/rollback แบบไม่แตะข้อมูลจริง: `MIGRATE_FROM_IMAGE=khanwai:0.3.1 node tests/docker-smoke.mjs` (ต้องมี image เก่าและใหม่ในเครื่อง) ใช้ scratch project/volume ที่สร้างเฉพาะและลบทิ้งหลังตรวจ

## 0.5.0: ISBN ต้นทางของชุด

ปุ่มเพิ่มหนังสือเดียวสลับทีละเล่ม/หลายเล่มได้ ISBN ที่ใช้ช่วยกรอกจะผูกกับเล่มที่ระบุเท่านั้นเมื่อเพิ่มเล่มนั้นด้วย metadataSeed เป็นข้อมูลตั้งต้น ไม่ใช่รายการ owned อยู่ใน export/backup ของชุด ใช้ SQLite schema v2 เดิม ไม่ต้องมีบริการหรือ volume เพิ่ม ก่อนอัปเดตสำรองตามขั้นตอนเดิมได้
