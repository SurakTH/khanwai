# Docker: หนึ่ง image หนึ่ง volume

## เริ่มใช้

```sh
test -e .env || cp .env.example .env
docker build -t khanwai:0.10.2 .
docker compose up -d --wait
```

ไฟล์ `.env.example` มีค่าเริ่มต้นและคำอธิบายครบตาม Compose ให้แก้ `.env` ตามเครื่องที่ติดตั้ง คำสั่งคัดลอกจะไม่เขียนทับ `.env` เดิม ถ้าต้องการเข้าผ่าน IP จากเครื่องอื่น ตั้ง `BIND_ADDRESS=0.0.0.0` ก่อนเริ่ม สำหรับ HTTP ผ่าน IP เว้น `APP_ORIGIN` ว่างได้; เมื่อใช้โดเมน HTTPS ให้ตั้ง URL จริงตามตัวอย่างในไฟล์

เปิด `http://localhost:4173` สมัครบัญชีเอง ไม่มีบัญชี/รหัสผ่านตั้งต้น แอพหนึ่ง service เสิร์ฟเว็บและ API พร้อม SQLite ใน process เดียว รัน non-root, root filesystem read-only และเขียนเฉพาะ data volume `/data` Healthcheck `/healthz` อ่านสถานะฐานข้อมูลที่เปิดตอนเริ่มแอพ

`docker compose down` หยุดโดยรักษาข้อมูล อย่าใช้ `down -v` ถ้าต้องการเก็บชั้นไว้

## แจก image

ยังไม่มี registry ที่เผยแพร่จริง ผู้สร้างส่ง image กับ compose.yaml ได้:

```sh
docker image save -o khanwai-0.10.0.tar khanwai:0.10.2
```

ผู้รับใช้ `docker image load -i khanwai-0.10.0.tar` แล้ว `docker compose up -d --wait` ไม่ต้องมี source หรือ Node การย้าย image ไม่ได้ย้าย volume; ใช้ backup/restore เพื่อย้ายข้อมูล ทดสอบ image บน Linux amd64 ยังไม่ยืนยัน ARM64

## ตั้งค่า

ใส่ค่าลง `.env` ข้าง Compose หรือส่ง environment ให้คำสั่ง Compose:

| ตัวแปร | ค่าเริ่มต้น | หน้าที่ |
| --- | --- | --- |
| PORT | 4173 | พอร์ต host |
| BIND_ADDRESS | 127.0.0.1 | interface host |
| KHANWAI_IMAGE | khanwai:0.10.2 | image/tag |
| DATA_DIR | /data | โฟลเดอร์ฐานข้อมูลใน volume ใช้เปลี่ยนหลัง restore |
| ALLOW_REGISTRATION | true | ตั้ง false หลังสมัครบัญชีที่ต้องการแล้ว |
| APP_ORIGIN | ว่าง | URL เว็บภายนอก เช่น https://books.example.com สำหรับ origin check |
| COOKIE_SECURE | false | true เมื่อต้องการบังคับ secure cookie; ใช้ https APP_ORIGIN แล้วเปิดอัตโนมัติด้วย |
| GOOGLE_BOOKS_API_KEY | ว่าง | คีย์ Google Books ฝั่งเซิร์ฟเวอร์ เป็นตัวเลือกเสริม ไม่จำเป็นสำหรับเริ่มใช้แอพ |

หากต้องเปิดจากมือถือใน LAN ใช้ `BIND_ADDRESS=0.0.0.0` แล้วเข้า IP เครื่อง Docker ใช้ HTTPS ที่ระบบ host มีอยู่เมื่อใช้งานบัญชีจริงผ่านเครือข่าย PWA/service worker ต้อง secure context (localhost หรือ HTTPS) ไม่เพิ่ม reverse proxy ใน Compose โดยอัตโนมัติ ไม่เชื่อ X-Forwarded-Host/Proto จากผู้เรียก ให้ตั้ง APP_ORIGIN เป็น URL ที่เปิดจริง

## สำรองข้อมูล

สำรองบนเซิร์ฟเวอร์รวมทุกบัญชีและรูป เป็นไฟล์ของผู้ดูแล ไม่ใช่ไฟล์แชร์ให้ผู้ใช้ทั่วไป:

```sh
docker compose exec app node src/cli.mjs backup /data/backups/first
mkdir -p backups
docker compose cp app:/data/backups/first ./backups/first
```

ใช้ชื่อโฟลเดอร์ใหม่ทุกครั้ง CLI ไม่เขียนทับ backup เดิม ล็อกการแก้ข้อมูลชั่วคราวระหว่าง SQLite backup กับคัดลอกรูป งานรอส่งจะยังอยู่ในเครื่องและ retry ได้ มี manifest/checksum ตรวจไฟล์ครบ เก็บ backup อีกที่นอกเครื่อง Docker ด้วย สำเนาใน volume เดียวไม่ป้องกันดิสก์เสีย

แนวทางเริ่มใช้: สำรองก่อนอัปเกรดและอย่างน้อยทุกวันเมื่อมีการแก้ข้อมูล เก็บรายวัน 7 ชุด/รายสัปดาห์ 4 ชุดโดยผู้ดูแล รอบนี้ไม่มี scheduler หรือลบ backup อัตโนมัติ ไฟล์ backup มีข้อมูลส่วนตัว password hashes และ session snapshot ต้องจำกัดสิทธิ์; restore จะล้าง sessions ให้ล็อกอินใหม่

ส่งออก JSON ในเว็บเป็น backup เฉพาะบัญชี รวมงานที่ยังรอส่งและรูปที่โหลดได้ หากรูปโหลดไม่ครบจะแจ้งให้ต่อเน็ต ไม่บอกว่าสำรองครบแล้ว

## กู้คืนโดยรักษาข้อมูลเดิม

ตัวอย่างใช้ backup ที่อยู่ใน volume เดิม ตรวจว่าชื่อปลายทางใหม่ยังไม่มีข้อมูล:

```sh
docker compose exec app node src/cli.mjs restore /data/backups/first /data/restored-first
```

CLI ตรวจ checksum, SQLite integrity, foreign keys, schema และรูป แล้วกู้ลงโฟลเดอร์ว่างเท่านั้น เมื่อผ่าน ให้ตั้ง `DATA_DIR=/data/restored-first` ใน `.env` แล้ว `docker compose up -d --wait` เข้าสู่ระบบใหม่ ตรวจชั้น/รูปก่อนตัดสินใจลบข้อมูลเก่า หากย้ายเครื่อง ให้นำโฟลเดอร์ backup เข้ามาใน volume ใหม่ด้วย `docker compose cp ./backups/first app:/data/backups/first` ก่อนรัน restore

การกู้ backup ย้อนเวลาข้อมูลเซิร์ฟเวอร์ งานที่เครื่องลูกแก้หลัง snapshot ต้องตรวจอีกครั้ง ไม่ใช้การคืน backup เป็นวิธีแก้ conflict รายรายการ

## ลืมรหัสผ่าน

ไม่มี SMTP หรือ magic link ผู้ดูแลที่เข้าถึง Docker ได้รีเซ็ตรหัสผ่านผ่าน stdin ได้ โดยไม่ใส่รหัสลง command arguments:

```sh
docker compose exec app node src/cli.mjs reset-password reader@example.com
```

พิมพ์รหัสใหม่อย่างน้อย 10 ตัวอักษรแล้วจบ stdin (Ctrl-D) คำสั่งนี้ไม่ใช่ช่องทางลับ: อย่าแชร์ terminal/session ที่ใช้กรอกรหัส ทุกอุปกรณ์ต้องล็อกอินใหม่หลัง reset เปลี่ยนรหัสเองได้จากหน้า settings เช่นกัน

## อัปเกรดและย้อนกลับ

รุ่นปัจจุบัน **0.10.2** เพิ่ม [การวางรูปปก](17-cover-paste.md) ไม่เปลี่ยน DB schema ตั้ง `KHANWAI_IMAGE=khanwai:0.10.2` ใน `.env` หลังดึง source แล้ว `docker build -t khanwai:0.10.2 .` และ `docker compose up -d` ใช้ volume เดิมและรับอัปเดต PWA เมื่อพร้อม

สำรอง -> build/load image tag ใหม่ -> ตั้ง KHANWAI_IMAGE -> `docker compose up -d --wait` -> ตรวจ login/ชั้น/รูป เก็บ image เก่าไว้จนตรวจเสร็จ ถ้า schema ใหม่กว่า image เก่า แอพจะปฏิเสธการเปิด ต้องใช้ backup ที่เข้ากันกับ image เก่าลงโฟลเดอร์ใหม่ก่อนย้อนกลับ

การลบบัญชีลบข้อมูลและรูปของบัญชีนั้นในระบบปัจจุบัน ไม่ลบ backup ที่ผู้ดูแลคัดลอกไว้ ต้องจัดการ retention ของ backup แยกกัน

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

รอบนี้ DB ยังเป็น v3 ไม่เพิ่มบริการ ถังขยะรวมใน JSON/SQLite backup พร้อมรูป อัปเดตเว็บหรือ PWA ทุกเครื่องก่อนแก้ต่อ เพราะรุ่นเก่าอาจยังแสดงรายการที่อยู่ในถังขยะ หากต้องย้อนกลับให้กู้ backup ก่อนอัปเดตลง directory ว่างตามวิธีในส่วนก่อนหน้า ดู [วิธีใช้สุ่มและถังขยะ](16-trash-and-picker.md)

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

จะเพิ่มตารางหมวดเป็น SQLite v3 อัตโนมัติ หนังสือ/บัญชี/รูปเดิมคงอยู่ หมวดรวมใน JSON export และ server backup แล้ว ไม่เพิ่ม container หรือ reverse proxy หลังเข้าเว็บให้รับอัปเดต PWA เมื่อพร้อม ดูวิธีใช้ที่ [หมวดหมู่](15-categories.md)

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
