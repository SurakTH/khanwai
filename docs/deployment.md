# Docker: หนึ่ง image หนึ่ง volume

## เริ่มใช้

```sh
test -e .env || cp .env.example .env
docker build -t khanwai:0.11.0 .
docker compose up -d --wait
```

ไฟล์ `.env.example` มีค่าเริ่มต้นและคำอธิบายครบตาม Compose ให้แก้ `.env` ตามเครื่องที่ติดตั้ง คำสั่งคัดลอกจะไม่เขียนทับ `.env` เดิม ถ้าต้องการเข้าผ่าน IP จากเครื่องอื่น ตั้ง `BIND_ADDRESS=0.0.0.0` ก่อนเริ่ม สำหรับ HTTP ผ่าน IP เว้น `APP_ORIGIN` ว่างได้; เมื่อใช้โดเมน HTTPS ให้ตั้ง URL จริงตามตัวอย่างในไฟล์

เปิด `http://localhost:4173` สมัครบัญชีเอง ไม่มีบัญชี/รหัสผ่านตั้งต้น แอพหนึ่ง service เสิร์ฟเว็บและ API พร้อม SQLite ใน process เดียว รัน non-root, root filesystem read-only และเขียนเฉพาะ data volume `/data` Healthcheck `/healthz` อ่านสถานะฐานข้อมูลที่เปิดตอนเริ่มแอพ

`docker compose down` หยุดโดยรักษาข้อมูล อย่าใช้ `down -v` ถ้าต้องการเก็บชั้นไว้

## แจก image

ยังไม่มี registry ที่เผยแพร่จริง ผู้สร้างส่ง image กับ compose.yaml ได้:

```sh
docker image save -o khanwai-0.11.0.tar khanwai:0.11.0
```

ผู้รับใช้ `docker image load -i khanwai-0.11.0.tar` แล้ว `docker compose up -d --wait` ไม่ต้องมี source หรือ Node การย้าย image ไม่ได้ย้าย volume; ใช้ backup/restore เพื่อย้ายข้อมูล ทดสอบ image บน Linux amd64 ยังไม่ยืนยัน ARM64

## ตั้งค่า

ใส่ค่าลง `.env` ข้าง Compose หรือส่ง environment ให้คำสั่ง Compose:

| ตัวแปร | ค่าเริ่มต้น | หน้าที่ |
| --- | --- | --- |
| PORT | 4173 | พอร์ต host |
| BIND_ADDRESS | 127.0.0.1 | interface host |
| KHANWAI_IMAGE | khanwai:0.11.0 | image/tag |
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

สำหรับรุ่น **0.11.0** สำรองข้อมูลก่อน ตั้ง `KHANWAI_IMAGE=khanwai:0.11.0` ใน `.env` เดิม แล้ว build และเปิด Compose ด้วยคำสั่งด้านบน รุ่นนี้ใช้ฐาน SQLite v3 และ volume เดิม หลังอัปเดตให้เปิดเว็บใหม่เพื่อรับไฟล์ PWA รุ่นล่าสุด

หลังดึงซอร์สแล้ว ให้ build image ด้วย tag ที่ตรงกับ `KHANWAI_IMAGE` ใน `.env` หรือค่าเริ่มต้นใน [compose.yaml](../compose.yaml) จากนั้นรัน `docker compose up -d` และตรวจว่าเปิดชั้นกับรูปปกได้ตามเดิม

สำรอง -> build/load image tag ใหม่ -> ตั้ง KHANWAI_IMAGE -> `docker compose up -d --wait` -> ตรวจ login/ชั้น/รูป เก็บ image เก่าไว้จนตรวจเสร็จ ถ้า schema ใหม่กว่า image เก่า แอพจะปฏิเสธการเปิด ต้องใช้ backup ที่เข้ากันกับ image เก่าลงโฟลเดอร์ใหม่ก่อนย้อนกลับ

การลบบัญชีลบข้อมูลและรูปของบัญชีนั้นในระบบปัจจุบัน ไม่ลบ backup ที่ผู้ดูแลคัดลอกไว้ ต้องจัดการ retention ของ backup แยกกัน

ดู [ประวัติการอัปเกรดแต่ละรุ่น](development/history/deployment-upgrades.md) สำหรับคำสั่งของรุ่นเก่า
