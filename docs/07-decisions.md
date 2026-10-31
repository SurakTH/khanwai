# การตัดสินใจ คำถามค้าง และความเสี่ยง

## การเลือกสำหรับ implementation 0.3.0 — 30 ตุลาคม 2026

เลือก Node 24.22.2 HTTP + SQLite ใน data volume เดียว, บัญชีอีเมล/รหัสผ่านในแอพโดยใช้ scrypt/session cookie แทน SMTP/magic link เพื่อตรง self-host ที่ผู้ใช้สั่งให้เรียบง่าย เป็นการตัดสินใจ implementation ของงานที่ได้รับอนุญาต ไม่ใช่คำอ้างว่าผู้ใช้เลือก auth provider ภายนอกแล้ว ไม่มีค่าใช้บริการเพิ่ม

ใช้ node:sqlite ที่เป็น release candidate จึง pin runtime และตรวจผ่าน owner isolation, concurrent revisions, backup/restore ก่อนใช้ ข้อมูลแต่ละ entity อยู่แยกแถว มี owner composite FK/revision/tombstones ส่วน work/edition ยังรวมใน series ไม่อ้างว่าทำ catalog schema เป้าหมายครบแล้ว

เลือก IndexedDB ต่อบัญชี + outbox + generation CAS, delta sync และ UI resolve conflict; ไม่ส่ง cookie/token ลง localStorage รูป private เก็บบน volume และ cache แยกบัญชี ไม่ใช้ shared object storage/service เพิ่ม เลือก JSON รวมรูปและ CLI SQLite backup เป็นการสำรองรอบนี้

เอกสารทางการที่ตรวจ: [SQLite Node v24](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [scrypt](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) รายละเอียด/retention และขอบเขตที่ยังไม่ทำอยู่ใน [10-implementation.md](10-implementation.md)

รายการ P01 magic link ด้านล่างเป็นข้อเสนอเก่าที่ยังไม่ได้เลือก ใช้ email/password ในเวอร์ชันปัจจุบันแทน คำถาม stack/database ปิดสำหรับรอบนี้แล้ว hosting/AI ยังเปิดอยู่ iPhone หลักและ Android ยืนยันแล้ว รอทดสอบอุปกรณ์จริง

## สิ่งที่ผู้ใช้ยืนยันจากบทสนทนา

| ID | การตัดสินใจ | เหตุผล |
| --- | --- | --- |
| D01 | เว็บสำหรับหนังสือส่วนตัว 200+ เล่ม | ต้องเช็กการซื้อซ้ำและเลขเล่ม |
| D02 | มีบัญชีและข้อมูลข้ามมือถือ/คอม | ไม่ผูกข้อมูลอยู่ที่เครื่องเดียว |
| D03 | รองรับ PWA | เข้าถึงจากมือถือสะดวก |
| D04 | ดึงข้อมูลจาก ISBN และมีรีวิว | ลดกรอกมือและตรวจความถูกต้องได้ |
| D05 | เตรียม AI ช่วยเพิ่มหนังสือ | ใช้เมื่อข้อมูลขาดและลดงานลงของเก่า |
| D06 | วางเอกสารก่อน implementation | เก็บรากฐานให้ทำต่อในอนาคตได้ |

## ข้อเสนอในแผน ยังไม่ใช่การเลือกของผู้ใช้

| ID | ข้อเสนอ | ต้องยืนยันด้วยอะไร |
| --- | --- | --- |
| P01 | email magic link | UX บนอุปกรณ์จริง ค่าใช้จ่ายและการส่งอีเมล |
| P02 | เก็บ metadata ที่ผู้ใช้แก้เป็น private ก่อน | ความเรียบง่ายและการไม่กระทบข้อมูลคนอื่น |
| P03 | offline editing พร้อม outbox/revision | ต้นทุนพัฒนาและผลทดสอบ sync |
| P04 | Google Books เป็นแหล่งแรกในการทดลอง | coverage หนังสือไทยและเงื่อนไข API |
| P05 | AI แบบกดเรียกเอง พร้อมรีวิว | คุณภาพ ค่าใช้จ่าย และนโยบายข้อมูล |
| P06 | JSON เป็น backup หลัก CSV เป็นรูปอ่าน | round-trip ข้อมูลชุดและเซ็ต |

## คำถามที่ยังเปิด

ไม่ต้องถามทั้งหมดในคราวเดียว เลือกเฉพาะข้อที่บล็อกงานถัดไป งานร่างเอกสารและ fixture สมมติทำต่อได้โดยไม่ต้องรู้ทุกข้อ

| คำถาม | ปิดก่อน |
| --- | --- |
| ใช้ iPhone/Android และเบราว์เซอร์อะไรเป็นหลัก? | ยืนยัน UX และชุดทดสอบ PWA/กล้อง |
| ใช้คนเดียวก่อน หรือเปิดรับคนอื่นตั้งแต่แรก? | วาง onboarding, quota และค่าใช้จ่าย production; สิทธิ์แยกบัญชีต้องมีทุกกรณี |
| วิธีเข้าสู่ระบบที่สะดวก และงบรายเดือนที่รับได้? | เลือก auth/hosting/AI |
| มีหนังสือตัวอย่างที่อนุญาตให้ใช้ทดสอบ API/AI หรือไม่? | ส่งข้อมูลจริงออกบริการภายนอก |
| เลือก framework/backend/database ใด? | เริ่ม implementation และ migrations |
| แหล่งข้อมูลไหนใช้ได้ ครอบคลุมเพียงใด เก็บปกได้หรือไม่? | integration จริง |
| เก็บรูปต้นฉบับนานเท่าไร provider เก็บอะไรบ้าง? | เปิด AI และ production |
| backup, tombstone, operation และ local cache มีอายุเท่าไร? | production sync/restore |
| ต้องการแจ้งเตือนอะไรหรือไม่? | ระยะอนาคต ไม่เพิ่ม push notification เอง |

## ความเสี่ยงและวิธีลด

| ความเสี่ยง | วิธีลด |
| --- | --- |
| API ไม่มีหนังสือไทย/ข้อมูลผิด | ทดลองก่อน ใช้ adapters, review และ manual fallback |
| ISBN หรือ AI ไม่พอแยกฉบับ | เก็บ provenance ตรวจเลขเล่ม/ภาษา/ฉบับก่อนบันทึก |
| ข้อมูลส่วนตัวหลุดข้ามบัญชี | owner checks, private files, account-scoped cache และ negative tests |
| AI มีค่าใช้จ่ายหรือถูกเรียกซ้ำมาก | เรียกตามคำสั่ง โควตา dedup และ budget controls |
| ออฟไลน์แก้ชนกันหรือเพิ่มซ้ำ | revision, idempotency, conflict UI และ tombstones |
| browser ล้างข้อมูลก่อน sync | แสดงค้างส่ง แนะนำซิงก์ และไม่เรียก local save ว่า backup |
| ลง 200+ เล่มแล้วเหนื่อย | เพิ่มเป็นช่วง ถาดรอตรวจ เริ่มจากเรื่องที่ยังตาม |
| บ็อกซ์ทำให้ยอด/การเตือนผิด | explicit membership และ derived coverage พร้อมทดสอบ |
| scope ใหญ่จนไม่ได้ใช้จริง | ทำตาม phase เปิด trial ที่ระบบหลัก และไม่แทรก social/รีวิว |

## รูปแบบบันทึกการตัดสินใจในอนาคต

เพิ่มรายการพร้อมวันที่ สถานะ (เสนอ/เลือกแล้ว/แทนที่) บริบท ทางเลือก เหตุผล ผลต่อผู้ใช้ ค่าใช้จ่าย/ความเสี่ยง และลิงก์หลักฐาน หากเปลี่ยนข้อกำหนดให้อัปเดตเอกสารที่เกี่ยวข้องและตรวจ acceptance criteria ไม่ทิ้งข้อสรุปไว้เฉพาะในแชต

## ประวัติ

- 30 ตุลาคม 2026: ผู้ใช้ระบุ iPhone เป็นหลักและต้องรองรับ Android เลือกเส้นทางถ่ายภาพ/เลือกรูปแยกกัน และแพ็ก ZXing EAN-13 reader ในเว็บแทนการพึ่ง BarcodeDetector อ่านภาพในเครื่อง ไม่ใช้เครื่องยิง ไม่ส่งรูปภายนอก ไม่เพิ่มบริการ Docker และยังมี manual ISBN ไม่เพิ่ม live camera scanner ในรอบนี้
- เอกสารประกอบตัวอ่าน: [ZXing TypeScript](https://github.com/zxing-js/library), [ตัวอย่างอ่านภาพ](https://zxing-js.github.io/library/examples/barcode-image/), [MDN file capture](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture), [esbuild bundling](https://esbuild.github.io/api/#bundle)

- 30 ตุลาคม 2026: ผู้ใช้ขอเมนูหลักให้สะอาด ถอดแท็บ “ลองฟีเจอร์ใหม่” และหน้ารวม mockup ย้ายเพิ่มชุดไปหน้าชั้น บัญชีจำลองอยู่ในตั้งค่า ลบตัวนับถาดรอตรวจแต่คงจำนวนชั้นหนังสือ และใช้ไอคอน SVG ขนาด/ช่องเท่ากันเพื่อแก้แนวข้อความที่เยื้อง

- 30 ตุลาคม 2026: เพิ่มการแก้ไขข้อมูลหลังบันทึก แยกระดับเรื่อง/ฉบับกับ entry ไม่ใช้ flow เพิ่มเพื่อสร้างสำเนาใหม่ ยืนยันการเปลี่ยนรูปแบบทั้งฉบับ/สมาชิกบ็อกซ์ ตรวจ ISBN และเตือน duplicate โดยข้าม record ตัวเอง

- 30 ตุลาคม 2026: ผู้ใช้ขอ mockup ก่อนระบบจริง และเพิ่มการแนบรูป ทำหน้า “ลองฟีเจอร์ใหม่” พร้อม flow เพิ่มชุด/ที่เก็บ/แพลตฟอร์ม และหน้าบัญชีจำลอง ไม่มี auth หรือ SQLite จริงในรอบนี้ รูปผ่าน browser resize/re-encode แล้วเก็บในข้อมูลต้นแบบหลังยืนยัน ไม่เรียก AI และไม่ส่งรูปออกภายนอก

- 30 ตุลาคม 2026: ผู้ใช้ชี้ว่าชั้นหนังสือกับเช็กก่อนซื้อคล้ายกันเกินไป แยกบทบาทชัดเจน: ชั้นเป็น gallery สำหรับจัดคอลเลกชัน หน้าเช็กเริ่มว่างและตอบสถานะรายเล่ม/ISBN เป็นรายการสรุป รวมทุกสถานะและรูปแบบเพื่อไม่ซ่อนการซื้อซ้ำ รองรับบริบทบ็อกซ์และ draft

- 30 ตุลาคม 2026: ผู้ใช้ยืนยัน Docker เป็นทางหลัก ต้องการ image + Compose ที่อ่านง่าย ไม่ต้องมี reverse proxy เพิ่ม Dockerfile/Compose หนึ่ง service ไม่มี runtime npm dependencies หรือ volume หลอกที่แอพยังไม่ใช้ ยังไม่ได้ publish registry
- 30 ตุลาคม 2026: ผู้ใช้ขอหนังสือเล่ม/ebook เพิ่ม format ระดับฉบับใน prototype, filter/display/review/draft และ migration v1 -> v2 โดยคง key เดิมเพื่อไม่ทำข้อมูลเดิมหาย
- ปรับทิศทาง backend เป็น self-host หนึ่งแอพกับ data volume เสนอ SQLite และบัญชีในแอพเพื่อลดบริการประกอบ ยังไม่ถือว่าเลือก auth implementation หรือฐานข้อมูล production เสร็จแล้ว

- 30 ตุลาคม 2026: ผู้ใช้สั่งเริ่มทำต้นแบบตามคำแนะนำ เลือก buildless HTML/CSS/ES modules และ Node.js 24 HTTP server สำหรับ local prototype เพื่อทดลอง UI โดยไม่ต้องเลือก production stack ไม่มี runtime dependencies ใช้ Playwright เป็น dev dependency ทดสอบ desktop/mobile
- การเก็บต้นแบบใช้ localStorage schema v1 เป็นการทดลองเฉพาะ origin ไม่ใช่ระบบบัญชีหรือ sync ตามแผนจริง; ระบบจริงต้องใช้ฐานข้อมูล สิทธิ์เจ้าของและ migration ที่เหมาะสม
- เตรียม PWA shell/offline read, PNG icons และ Noto Sans Thai แบบ self-host พร้อม OFL; ต้องทดสอบการติดตั้งบนอุปกรณ์จริงต่อ
- ลอง Google Books live ด้วย ISBN สาธารณะสองเล่ม ได้ rate limit ทั้งคู่ จึงยังไม่เลือกเป็นแหล่ง production และไม่สรุป coverage หนังสือไทย รายละเอียดใน `08-prototype.md`
- เอกสารทางการที่ตรวจสำหรับ implementation: [Node HTTP v24](https://nodejs.org/docs/latest-v24.x/api/http.html), [Node test runner v24](https://nodejs.org/docs/latest-v24.x/api/test.html), [Google Books ISBN query](https://developers.google.com/books/docs/v1/using), [MDN Barcode Detection](https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API), [MDN Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

- 30 ตุลาคม 2026: จัดทำแผนตั้งต้นและคำแนะนำสำหรับผู้ช่วย ยังไม่ได้ทดสอบ provider หรือเลือก stack ยังไม่มี implementation

## 0.3.1 — แก้ ISBN lookup เมื่อ Google quota หมด (30 ตุลาคม 2026)

ตรวจจริง Google Books คืน 429 พร้อมเหตุผล Queries per day exceeded แม้ ISBN สาธารณะ; ไม่สรุปว่าเกิดจากจำนวนครั้งที่ผู้ใช้กด เพิ่ม Open Library Books API เป็น fallback เมื่อ Google ไม่พบ/ล่ม/จำกัดคำขอ ตรวจ ISBN-10/13 ของผลว่าตรงกันก่อนเสนอ ห้ามเดาภาษา/เลขเล่ม/ฉบับ และ UI เก็บ source ตาม provider จริง

Cache เฉพาะ public metadata ใน process สูงสุด 500 ISBN: found 1 ชั่วโมง, not_found 5 นาที, error 15 วินาที; dedup คำขอ ISBN เดียวกัน พัก provider 60 วินาทีเมื่อจำกัดคำขอ Open Library จำกัดหนึ่งคำขอทุก 1.1 วินาทีต่อ process และ bounded queue ไม่ทำ bulk scan/เปลี่ยน IP หนี quota ไม่มีข้อมูลชั้น/รูปส่วนตัวใน cache นี้

เพิ่ม GOOGLE_BOOKS_API_KEY เป็น optional server environment ผ่าน Compose ไม่ฝัง key ในเว็บ ไม่สร้าง key/บัญชี/บริการจ่ายเงินให้เอง การใส่ key ไม่รับประกันว่า quota หรือข้อมูลหนังสือไทยจะพอ

เอกสารทางการที่ตรวจ: [Google identification/API key](https://developers.google.com/books/docs/v1/using), [Open Library Books API](https://openlibrary.org/dev/docs/api/books), [rate limits/usage](https://openlibrary.org/developers/api)

Live control 9780306406157: Google 429, Open Library 200 และได้ exact ISBN metadata ส่วน ISBN ที่ผู้ใช้ส่งให้ตรวจ: Open Library 200 แต่ไม่มี record; ยังไม่อ้างว่าค้นพบหนังสือไทยอัตโนมัติได้จาก control อังกฤษ

## 0.4.0 — เลือกแหล่งข้อมูลในตั้งค่า (30 ตุลาคม 2026)

ผู้ใช้ขอให้เลือกว่าจะใช้แหล่งข้อมูลใดในหน้าตั้งค่า เพิ่ม checkbox เปิด/ปิดและปุ่มเลื่อนลำดับ NLT, Google Books, Open Library บันทึกต่อบัญชีผ่าน /api/settings (GET/PUT) พร้อม revision check ป้องกันค่าจากเครื่องเก่าทับเครื่องใหม่ ปิดทั้งหมดคือกรอกเอง/สแกนเช็กชั้นได้โดยไม่ส่ง ISBN ภายนอก การตั้งค่านี้บันทึกเมื่อออนไลน์ ไม่มี outbox ของ preferences และไม่แสดงว่าบันทึกแล้วเมื่อเครือข่ายล้ม

Default รักษา Google → Open Library; NLT ปิดไว้จนเลือกเอง มีป้ายทดลอง แยก cache key ตามลำดับที่เลือก ไม่ใช้ผลของแหล่งที่ปิด และใช้เฉพาะผลแรกที่พบ ISBN ตรงกัน ผู้ใช้ยังตรวจข้อมูลก่อนเข้าชั้น ไม่แก้หนังสือเดิมตามการเปลี่ยน settings

ทดสอบ curl/public browser พบ NLT Single Search เรียก /primaws/rest/pub/pnxs ได้โดยไม่ส่ง key/token/cookie และ ISBN ที่ผู้ใช้ให้ตรวจคืนระเบียนตรงกัน นำมาทำ adapter อ่าน JSON แบบจำกัดคำขอ/timeout ไม่รัน browser หรือ scrape HTML ใน production ไม่ดึงปก/เนื้อหาหนังสือ ใช้ข้อมูลภาษา/เลขเล่มเฉพาะเมื่อระเบียนระบุ ไม่เติม edition ที่ขาด

นี่เป็น endpoint ของหน้าเว็บ ไม่มีสัญญา API สาธารณะที่ยืนยันความคงที่หรือเงื่อนไข reuse แล้ว จึงระบุทดลองและ default-off ไม่อ้างว่า NLT อนุญาตการนำไปเผยแพร่เป็นบริการทั่วไปแล้ว ไม่มีการติดต่อหน่วยงานแทนผู้ใช้

SQLite migration v1 → v2 เพิ่ม preferences(owner FK, data JSON, revision) การลบบัญชี cascade ค่าเหล่านี้ Server backup/restore รวม settings และรับ backup v1/v2 ได้ JSON ส่งออกหนังสือยังไม่รวม preferences เพื่อไม่เปลี่ยนรูปแบบไฟล์หนังสือ API key รับจาก environment ฝั่งเซิร์ฟเวอร์เท่านั้น ไม่มีช่องเก็บ key ในบัญชีหรือ localStorage

หลักฐาน endpoint ที่ใช้: [NLT Single Search](https://nlt.primo.exlibrisgroup.com/nde/home?vid=66NLT_INST%3A66NLT&lang=th), [รูปแบบ Deep Links ของ Primo](https://developers.exlibrisgroup.com/primo/apis/deep-links-new-ui/)

## 0.5.0 — ปุ่มเพิ่มเดียวและ ISBN ข้อมูลตั้งต้นของชุด

ผู้ใช้ขอใช้ ISBN ของเล่มหนึ่งช่วยกรอกข้อมูลชุด และลดการเริ่มเพิ่มใหม่ รวมปุ่มบนหน้าชั้นเป็น “เพิ่มหนังสือ” ภายในสลับ ทีละเล่ม / หลายเล่มในชุด โดยรักษาข้อมูลร่วม รูป ที่เก็บ สถานะ และ ISBN ที่กรอกไว้ มี checkbox เพิ่มเล่มถัดไปต่อหลังบันทึก ใช้ series ID เดิม ล้าง ISBN/รูปเฉพาะเล่ม ไม่คัดปกเล่มก่อนเป็นปกเล่มใหม่ เลขเล่มถัดไปเสนอจากเลขที่เพิ่งเพิ่ม (กรณีเลขพิเศษให้กรอกเอง)

Batch ระบุ seed ISBN และ seed label ว่า ISBN นี้เป็นของเล่มไหน ใช้ข้อมูลร่วมจาก provider หรือข้อมูลฉบับที่บันทึกไว้ได้ ต้องรีวิวก่อนบันทึก ใส่ ISBN เฉพาะ entry ที่ label ตรงกันเมื่อเพิ่มเล่มนั้นด้วย เล่มอื่นว่าง ไม่เดาหรือสร้าง ISBN ของเล่มอื่น ถ้าเว้นเล่มต้นทาง/อยู่ในบ็อกซ์/มีแล้ว จะไม่สร้าง ownership ใหม่เพื่อเก็บ seed

เก็บ optional series.metadataSeed={isbn,label,source} ใน JSON payload/schemaVersion 2 เดิม ตรวจ ISBN และความยาวฝั่ง server ผ่าน validateState, รวมใน export/backup โดยไม่เพิ่ม schema ฐานข้อมูล ยังคง SQLite user_version 2 ไม่ถือว่า seed เป็น entry ไม่รวมยอด/การเช็กซ้ำของหนังสือที่มีแล้ว ใช้เป็น template ออฟไลน์ได้

ชื่อชุดแนะนำตัดเฉพาะท้าย “เล่ม N” เมื่อ N ตรงกับ label จาก provider อย่างชัดเจน ไม่ตัดตัวเลขในชื่ออื่นและไม่แปลชื่อ ไม่แก้ชื่อ/ผู้เขียน/ฉบับของชุดเดิมจากข้อมูลภายนอก แต่ใช้ข้อมูลต่อเล่ม/seed ที่ผู้ใช้ตรวจได้

ถ้า draft เป็นต้นทางแล้ว batch ไม่ได้เพิ่มเล่มต้นทาง จะเก็บ draft เดิมไว้ การยืนยัน batch ไม่เปลี่ยนเล่มที่เว้นเป็น owned และยังตรวจ duplicate ทั้ง label/box กับ ISBN ต้นทางก่อนเพิ่มอีกสำเนา

## 0.5.1 — แก้ UUID บน HTTP LAN และปุ่มเพิ่มในหน้าเช็ก

ผู้ใช้พบ crypto.randomUUID undefined เมื่อเปิดผ่าน HTTP/IP ในวง LAN ย้ายการสร้าง ID ฝั่งเว็บทั้งหมด (series/entry/draft/outbox/conflict operations) ไป public/ids.js ใช้ native randomUUID เมื่อมี และสร้าง UUID v4 ด้วย crypto.getRandomValues เมื่อไม่มี ไม่ใช้ Math.random/เวลาแทน randomness

เพิ่มปุ่มเพิ่มหนังสือบน heading หน้าเช็กก่อนซื้อ ให้เปิดฟอร์มเดียวกับหน้าชั้น/ถาด ไม่เพิ่มเมนูหรือ flow ใหม่ ไม่เปลี่ยน ownership ของ metadataSeed

ตรวจเอกสารทางการ: [randomUUID ต้อง secure context](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID), [getRandomValues ใช้ได้ใน insecure context](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues) การแก้นี้ช่วยให้ CRUD ผ่าน HTTP LAN ได้ ไม่ได้ทำให้ PWA/service worker ใช้ HTTP บนมือถือได้เอง


## 0.5.2 — ปกผลค้นและแตะทั้งการ์ด (30 ตุลาคม 2026)

ผู้ใช้ต้องการเห็นปกขณะเช็กและเปิดรายละเอียดง่ายขึ้น ใช้รูปที่บัญชีบันทึกไว้ เลือกรูป entry ตรง ISBN/เลขเล่มก่อน จากนั้นภาพชุด/entry อื่นเป็นภาพแทนชุดพร้อมคำกำกับ ไม่อ้างว่าเป็นปกของเล่มที่ไม่มีรูป ไม่เพิ่ม provider หรือเก็บภาพจากภายนอก

ใช้ native button type=button บนชื่อเรื่อง พร้อม CSS pseudo-element ขยายพื้นที่ไปทั้งการ์ดและ focus indicator เดียว การ์ดไม่มีปุ่มอื่นซ้อน ทดสอบแตะและ Enter/Space ผ่านแล้ว ตรวจเอกสาร [MDN button](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button) เรื่องการเปิด dialog ด้วยปุ่มและการใช้งานผ่าน touch/keyboard


## 0.5.3 — ย้ายแบนเนอร์ไปถาดรอตรวจ

ผู้ใช้ขอพื้นที่หนังสือบนชั้นมากขึ้น ย้าย hero เดิมไปหน้า drafts ตามคำขอ เปลี่ยนข้อความให้สอดคล้องกับการตรวจข้อมูลและถอดปุ่มเปิดถาดที่กลายเป็นการเปิดหน้าเดิม ไม่เปลี่ยน flow รีวิวหรือ ownership ใช้ HTML section และ CSS responsive เดิม ไม่เพิ่มเทคโนโลยีหรือ dependency


## 0.5.4 — เรียงชั้นหนังสือและจำค่าที่เลือก

ผู้ใช้สั่งทำการเรียงและจำค่าหลังเสนอเพิ่มล่าสุด/เก่าสุด/ชื่อขึ้นลง/ผู้เขียน/แก้ไขล่าสุด ทำเฉพาะส่วนนี้ ยังไม่ทำมุมมองรายการย่อ ตัวเลือกอยู่ข้างตัวกรองรูปแบบ ใช้ default เพิ่มล่าสุด จำใน localStorage แยก owner เฉพาะเบราว์เซอร์นี้ ไม่ซิงก์ข้ามเครื่องหรือรวม JSON export

ใช้ [Intl.Collator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator) locale th, numeric=true สำหรับภาษาไทย (รวมสระนำ) และเลข 1,2,10 กำหนดกลุ่มไทยก่อน Latin ก่อนตัวเลขและภาษาอื่น เรียงย้อนกลับกลับทั้งลำดับ ผู้เขียนว่างอยู่ท้าย ชื่อ/ฉบับ/ID ใช้ตัดสินลำดับเมื่อค่าเท่ากัน ไม่เปลี่ยน array ข้อมูลจริง

เก็บ optional createdAt/updatedAt ใน JSON record เดิม ไม่เปลี่ยน schema SQLite วันที่เพิ่มเรื่องใช้ createdAt หรือวันที่ createdAt/reviewedAt แรกของ entries เดิม หากไม่ทราบอยู่ท้ายทั้งเพิ่มล่าสุดและเก่าสุด ไม่เดาย้อนหลัง วันที่แก้ล่าสุดรวม entry ที่ยังอยู่ การสร้างใหม่เก็บวันที่ การแก้ entry ไม่แก้ series record ที่ไม่เกี่ยวข้องเพื่อรักษา independent conflict merge; ลบ entry อัปเดตวันที่ series ส่วนการเรียงไม่สร้าง outbox ไม่เปลี่ยน ownership หรือจำนวนหนังสือ วันที่จากอุปกรณ์เป็นข้อมูลช่วยเรียง ไม่ใช่นาฬิกากลางที่ยืนยันได้


## 0.6.0 — จัดชั้นและ CSV ครบ 5 ข้อที่ผู้ใช้อนุมัติ

ผู้ใช้สั่ง “ทำทั้งหมด” หลังเสนอรายการย่อ ชุดยังเก็บไม่ครบ แก้หลายรายการ ที่เก็บ/แท็ก และ CSV จึงทำทั้งหมดในเว็บเดิม ดูสัญญาพฤติกรรมและข้อจำกัดใน [11-shelf-management.md](11-shelf-management.md) ยังคง 4 nav / หนึ่ง app image / SQLite schema v2 / private photos เดิม ไม่มี AI/provider ใหม่หรือ public deployment

แท็กเป็น optional series.tags และอาจอยู่ใน draft ก่อนสร้างฉบับ ตรวจจำนวน/ความยาวที่ server ใช้ JSON record เดิมเพื่อให้ outbox/owner checks/export/backup เดิมครอบคลุม มุมมองเป็น local preference ต่อ owner ส่วนแท็กเป็นข้อมูลบัญชีที่ซิงก์ ไม่ย้าย metadata ส่วนตัวเข้าฐานข้อมูลร่วม

Bulk แสดง checkbox ราย entry และ before/after preview ใช้ operation เดียวและ bases ตั้งแต่เปิด flow แท็กระดับฉบับมีป้ายกำกับ บ็อกซ์เปลี่ยนทั้ง record ไม่แยก owned ย่อยเอง CSV อ่านใน browser ขนาดจำกัด ใช้ parser ที่ทดสอบ quoting/linebreak ตาม RFC 4180 ไม่มี runtime dependencies เพิ่ม ไม่มีการดึง ISBN อัตโนมัติจากไฟล์ จับคู่เฉพาะฉบับชัดเจนและข้าม duplicate แทนการเขียนทับ ฟอร์มให้ตรวจแก้และเลือกแถวก่อนยืนยัน

ตรวจเอกสาร: [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180), [HTML checkbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/checkbox) ส่วนแนวทางผลิตภัณฑ์จาก [Libib Library](https://support.libib.com/libib/website/library.html), [Batch Edit](https://support.libib.com/libib/website/library/batch-edit.html), [LibraryThing overview](https://www.librarything.com/quickstart.php) ไม่ถือว่าเงื่อนไขฐานข้อมูลหรือ coverage ISBN ของผู้ให้บริการเหล่านั้นใช้กับเว็บนี้ได้


ชุด browser test ขยายเป็น 110 scenarios พบว่าการรันบน scratch DB เดียวต่อเนื่องสะสม auth-ip limit (120 ครั้ง) จึงแยก webServer/ฐานชั่วคราวของ desktop ที่ 4187 และ mobile ที่ 4188 ตาม [Playwright multiple web servers](https://playwright.dev/docs/test-webserver#multiple-web-servers) ไม่ปิด/เพิ่ม auth limit ใน production การรัน TEST_BASE_URL ภายนอกให้แยกรอบต่อ DB สด


## 0.7.0 — สถานะการอ่านแยกจากการครอบครอง

ผู้ใช้ขออ่านแล้ว/ยังไม่อ่าน/คิดจะอ่าน จึงเพิ่ม unread/planned/reading/read เป็น optional entry.readingStatus และ readingByMember สำหรับสมาชิก box ใช้ unknown เมื่อข้อมูลเดิมไม่ระบุ ไม่เดาย้อนหลัง ไม่เปลี่ยน owned/ordered/wishlist/ISBN/quantity หรือความครบชุดเพราะสถานะอ่าน รองรับเพิ่ม/ถาด/แก้/quick edit/bulk/filter/CSV/export/offline โดยใช้ mutation และ owner checks เดิม ไม่มี schema SQLite ใหม่

Box รองรับรายเล่มโดยไม่สร้างเล่ม owned ซ้ำ การตั้งสถานะทั้งบ็อกซ์ล้างรายเล่มแบบชัดเจนใน label/preview อัปเดต metadata ทั่วไปเก็บ reading map ไว้ ดู 12-reading-status.md ใช้ native labelled select ตาม [MDN select](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/select) เพื่อใช้งาน keyboard/touch ตามแพลตฟอร์ม ไม่เพิ่ม dependency หรือบริการ Docker


## 0.7.1 — ปุ่มการอ่านทั้งชุดและ default ยังไม่อ่าน (31 ตุลาคม 2026)

ผู้ใช้ขอปุ่มอ่าน/ไม่อ่าน/อยากอ่านในหน้าชุดและระบุ “Default เป็นยังไม่อ่านเลย” จึงแทนที่นโยบาย unknown ของ 0.7.0: ค่าว่าง/ไม่มี readingStatus และ override ว่างอ่านเป็น unread ตอนแสดงผล/กรอง โดยไม่ rewrite ชั้นจริงขณะเปิดดู สถานะที่ระบุ read/planned/reading คงเดิม เปลี่ยนชื่อ planned เป็นอยากอ่าน และคง CSV alias ตั้งใจจะอ่าน เพื่ออ่านไฟล์เก่าได้ ไม่เปลี่ยน enum หรือ SQLite schema

ปุ่มทั้งชุดใช้เฉพาะ entries ที่บันทึกใน series ปัจจุบัน รวมสมาชิกบ็อกซ์และสำเนาของ entry ที่เลือกทั้งชุด ไม่สร้างเล่มตาม target/metadataSeed ไม่กระทบฉบับอื่น/ownership ตัวปุ่มใช้ native button + aria-pressed มีคำกำกับทุกเล่มในฉบับนี้และสรุปจำนวนปัจจุบัน ไม่เพิ่ม confirmation step ที่ผู้ใช้ไม่ได้ขอ ใช้ modal revision bases เดิมและ outbox/conflict เดิม [MDN button](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button)


## 0.8.0 — รื้อการจัดหน้าชั้นหนังสือ (31 ตุลาคม 2026)

ผู้ใช้ต้องการหน้าชั้นที่สวยและลดความรก จึงจัดลำดับใหม่ให้หนังสือเด่น: ยุบสถิติเป็นบรรทัดเดียว รวมตัวกรองใน disclosure เดียว แยกสถานะที่ใช้บ่อยไว้ และย้ายเลือกหลายรายการไปเมนู ••• การ์ดลดข้อความซ้ำแต่คงข้อมูลเต็มในรายการย่อ/รายละเอียด ไม่ลบความสามารถกรอง/เรียง/แก้หลายรายการหรือเปลี่ยนข้อมูลส่วนตัว

ใช้ native [details/summary](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details) พร้อม Escape/focus handling ของแอพ และ [aspect-ratio](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/aspect-ratio) จัดพื้นที่ปกตามเอกสารที่ตรวจรอบนี้ ไม่มี dependency หรือบริการใหม่ แยก shelf-view.js/shelf.css เพื่อลดการสะสม template/style ในหน้าอื่น ดูขอบเขตและภาพก่อนหลังใน 13-shelf-redesign.md


## 0.8.1 — การ์ดรายเล่มในรายละเอียดฉบับ (31 ตุลาคม 2026)

ผู้ใช้ขอปรับหน้ารายละเอียดโดยเน้นแถวรายเล่มที่แน่นและไม่สวย จัดเป็นการ์ดที่แยกข้อมูลเล่ม การครอบครอง การอ่าน และเมนูการจัดการ; คงการอ่านเป็นตัวเลือกตรงการ์ดเพื่อไม่เพิ่มขั้นตอนในงานประจำ ปุ่มรองแก้/รูป/ลบย้ายเข้าเมนูต่อ entry ลบยังยืนยันตามเดิม ย่อ overview และวางเพิ่มเล่มใกล้หัวข้อ ชื่อ dialog/ปิดติดบนเมื่อเลื่อน และเปลี่ยน ownership แล้วไม่กระโดดกลับต้นชุด

ใช้ [details/summary](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details) ตามเอกสารทางการที่ตรวจในรอบนี้ โดยไม่ใส่ role=menu ที่จะต้องทำ keyboard interaction อีกชุด ช่องสถานะยังเป็น [labelled select](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/select) ของแพลตฟอร์ม ไม่รวมการอ่านกับ ownership ไม่เพิ่ม dependency หรือเปลี่ยน schema แยก presentation ใน detail-view.js/detail.css รายละเอียดสัญญาและภาพอยู่ใน 14-book-details.md

การปิด dialog เดิมเรียก render ทั้งหน้าทุกครั้ง พบ race ใน mobile test ที่การกรอกคำค้นต่อทันทีใช้ input ที่ถูกถอดออก จึงติดตาม content update ที่รอแสดงระหว่างเปิด modal และ refresh หลังปิดเฉพาะเมื่อจำเป็น ใช้ renderPreservingFocus เมื่อต้อง refresh การแก้ข้อมูลเดิมที่ render ไว้แล้วไม่วาดซ้ำ ไม่เปลี่ยน outbox หรือ conflict policy เพิ่ม regression การคืน focus และการรับข้อมูลข้ามเครื่องระหว่างเปิดรายละเอียด


## 0.8.2 — ลดพื้นที่กรอบรอบปกบนชั้น (31 ตุลาคม 2026)

ผู้ใช้เห็นว่าปกอยู่ในกรอบใหญ่และเหลือพื้นที่มาก จึงลดเฉพาะพื้นหลังปกของ gallery ให้กว้างไม่เกิน 188px หรือ 88% ของคอลัมน์ และให้ความสูงตามปกพร้อมขอบว่าง 8px บนมือถือ/10px บนคอม ปกขยายเต็มพื้นที่ด้านในแทนจำกัด 70%/145px เดิม ยังมีพื้นหลังโทนเดิม ไม่ใช้การ crop รูปเพื่อเติมกรอบ คง [object-fit: contain](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit) ตามเอกสารที่ตรวจรอบนี้ เพื่อเห็นภาพครบและไม่เปลี่ยนไฟล์ส่วนตัว

มุมมองรายการย่อคง thumbnail เดิม และย้ายป้ายข้อมูลตัวอย่างเหนือกรอบเพื่อไม่ซ้อนข้อความบนปก ไม่เปลี่ยนการ์ด/คำค้น/reading/ownership หรือข้อมูลในบัญชี ไม่มี dependency ใหม่ service worker shell-v22 แจ้งอัปเดตตาม flow เดิม


## 0.8.3 — คืนกรอบเดิมและขยายเฉพาะปก (31 ตุลาคม 2026)

ผู้ใช้แก้ความเข้าใจชัดเจน: ต้องการกรอบกว้างเต็มคอลัมน์และตรงแนวข้อความแบบเดิม ขยายรูปข้างใน การย่อกรอบใน 0.8.2 เป็นการตีความผิดของผู้ช่วย ไม่ใช่ข้อกำหนดที่ผู้ใช้ยืนยัน จึงคืน width 100% และ aspect ratio 1/1.12 บนคอม / 1/1.22 บนมือถือ เท่า 0.8.1 ยกเลิก max-width 188px และ margin กลาง

ขยายเฉพาะ cover ให้สูงเต็มพื้นที่ด้านใน ลด padding เป็น 12px บนคอม/8px บนมือถือ ความกว้างตามสัดส่วนปก 2:3 และ object-fit contain เดิม ไม่ยืดหรือตัดภาพ รายการย่อและหน้ารายละเอียดคงเดิม เพิ่ม geometry checks ใน preview utility ว่ากรอบซ้าย/กว้างตรงการ์ด อัตราส่วนเดิม และปกใช้ความสูงมากกว่า 88% ของกรอบ เพื่อพิสูจน์ตรงคำขอ ไม่เพิ่ม dependency หรือเปลี่ยนข้อมูล shell-v23


## 0.8.4 — ตัวกรองการอ่านตรงแถวสถานะ (31 ตุลาคม 2026)

ผู้ใช้อนุมัติช่อง “การอ่าน: ทั้งหมด” ในพื้นที่ด้านขวาของแถวมีแล้ว/รอส่ง/อยากซื้อ แทนเพิ่มปุ่มหลายอัน จึงย้าย select เดิมออกจากแผงกรองมาแสดงตลอด มีทั้งหมด + unread/planned/reading/read ครบ ไม่ซ้ำสองตำแหน่ง บนมือถือแยกอีกบรรทัดชิดขวา ไม่เบียดแท็บ ownership ใช้ [native select พร้อม label](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/select) ตามเอกสารทางการที่ตรวจรอบนี้ ตัวอักษร 16px/touch target 44px บนมือถือ

ใช้ readingFilter/filterShelf เดิม สถานะที่เลือกคือการกรอง ไม่ใช่การเปลี่ยนสถานะหนังสือ ชุดผสมพบได้ทั้งอ่านแล้ว/ยังไม่อ่านตามสถานะ entry/member จริง ไม่เปลี่ยนความหมายเป็นอ่านครบทั้งชุด มี reading summary เดิมบนการ์ด แยกจาก ownership และใช้พร้อม tag/location/search/sort ได้ ล้างการอ่านอย่างเดียวไม่ล้างตัวกรองอื่น ป้ายตัวกรองและจำนวนเงื่อนไขที่ใช้อยู่รวมการอ่านด้วย ยังคง unread default และ box reading map ไม่มีข้อมูล/API/schema ใหม่ shell-v24


## 0.8.5 — แถวเครื่องมือที่กลมกลืนทั้งมือถือและคอม (31 ตุลาคม 2026)

ผู้ใช้ระบุว่า UI มือถือรับไม่ได้และคอมก็ไม่สวย ต้องปรับด้านความงามและความกลมกลืน ไม่ใช่เพียงวาง control ให้ครบ จึงจัดการอ่านและเรียงเป็นกลุ่มเดียวกัน โดยเลือกแบบสองช่องเท่ากันบนมือถือที่ตรงแนวหนังสือ แล้วค่อยแสดงผลลัพธ์/มุมมอง/จัดการ บนคอมเป็นหนึ่งบรรทัดแบบเรียบไม่มีกรอบสีขาวโดด ยกเลิกการจัดวาง 0.8.4 แต่คงความสามารถเลือกอ่านโดยตรงและ 4 reading states/ทั้งหมด

ใช้ [CSS grid-template-areas](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/grid-template-areas) ตามเอกสารทางการที่ตรวจในรอบนี้ ปรับเฉพาะ presentation ใน shelf-view.js/shelf.css หนึ่ง native select กับ listener เดิม ไม่มีตัวกรองสำเนา/resize handler, dependency, schema หรือ API ใหม่ ตรวจภาพจริงหลายความกว้าง ทั้งก่อนเลือกและหลังกรอง/เรียง ปุ่มและตัวอักษร native มือถือยัง 44px/16px ไม่ลดขนาดให้พอดีด้วยการทำให้กดยาก รายละเอียดภาพและเกณฑ์อยู่ใน 13-shelf-redesign.md shell-v25 คง flow แจ้งอัปเดตเดิม


## 0.8.6 — คืนหน้าชั้นก่อนเพิ่มช่องการอ่าน ตามคำขอผู้ใช้ (31 ตุลาคม 2026)

ผู้ใช้ส่งภาพ Safari/iPhone เปรียบเทียบและระบุชัดว่าชอบหน้าตาก่อนเพิ่มการอ่าน จึงคืน shelf.css/shelf-view.js จาก image khanwai:0.8.3 โดยตรง ไม่ออกแบบแถวเครื่องมือใหม่อีก เอา quick filter ของ 0.8.4 และ paired toolbar ของ 0.8.5 ออกทั้งมือถือ/คอม สถานะการอ่านทั้ง 4 และทั้งหมดกลับไปเลือกในปุ่มกรองโดยใช้ native select/listener เดิมตามเอกสาร select ที่ตรวจไว้ ไม่มีเทคโนโลยีหรือ dependency ใหม่

เป็นการคืน presentation เท่านั้น ใช้ app.js ล่าสุดโดยถอดเฉพาะ update ของ quick select ที่ยกเลิก คง close-focus fix/รายละเอียดรายเล่ม/box/offline/ownership/ข้อมูลบัญชี ไม่มีการ restore DB หรือลบสถานะอ่าน เปลี่ยน cache เป็น shell-v26 ผ่าน flow แจ้งอัปเดตเดิม ปรับ regression ให้ตรวจ toolbar แบบเดิมและการอ่านในแผงกรองแทนดีไซน์ที่ผู้ใช้ปฏิเสธ


## ตัวอย่างค่าติดตั้งสำหรับเซิร์ฟเวอร์ (31 ตุลาคม 2026)

ผู้ใช้พบว่า clone repository แล้วไม่มี .env.example จึงเพิ่มไฟล์ตัวอย่างที่มีครบทุกตัวแปร interpolation ของ Compose: image, bind address, port, container data directory, origin, registration, secure cookies และ Google Books key แบบว่างทั้งหมดที่เป็นความลับ ค่าเริ่มต้นตรง Compose เดิม โดย bind 127.0.0.1 พร้อมคำอธิบายการเปลี่ยนเป็น 0.0.0.0 เมื่อต้องการเข้าจากเครื่องอื่น ไม่คัดค่าจาก .env จริง

README และคู่มือ Docker เริ่มด้วย `test -e .env || cp .env.example .env` เพื่อสร้างไฟล์เมื่อยังไม่มีและเก็บค่าเดิมเมื่อมีอยู่แล้ว .env.example เข้า Git ได้ตาม exception เดิม ส่วน .env จริงยัง ignored ตรวจเอกสาร [Compose interpolation และ env-file](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/) แล้ว validate ด้วย compose config ทั้งค่าเริ่มต้นและตัวอย่าง server/HTTPS จากไฟล์ชั่วคราว ไม่เปิด/recreate container และไม่ต้องเปลี่ยน version image เพราะไม่มี runtime change


## ช่องกรอกบนมือถือและการซูม Safari (31 ตุลาคม 2026)

ผู้ใช้พบว่า iPhone ซูมเมื่อแตะพิมพ์ จึงเพิ่ม mobile-inputs.css เป็น stylesheet สุดท้าย ให้ช่องพิมพ์ select และ textarea ใช้ 16px เมื่อ viewport ไม่เกิน 800px หรือเป็นอุปกรณ์สัมผัสหลักแบบ pointer coarse/hover none รวมมือถือแนวนอน ไม่เปลี่ยนกรอบปกหรือแถวเครื่องมือ ไม่ปรับ checkbox/radio/file และปุ่มส่งฟอร์ม

ใช้ baseline !important เฉพาะ font-size เพื่อครอบคลุมกฎ compact form เดิมที่เฉพาะเจาะจงกว่า คง viewport เดิมและ pinch zoom ตาม [คำแนะนำ MDN เรื่อง viewport และ accessibility](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport) ไม่ใช้ user-scalable=no หรือ maximum-scale จำกัดผู้ใช้ เปลี่ยน shell cache เป็น v27 เพื่อโหลด stylesheet ออฟไลน์ได้ผ่าน flow อัปเดตเดิม

ตรวจ Chromium mobile emulation ผ่าน mobile-inputs.spec.js: ขนาด computed font หน้าล็อกอิน ค้นหา และเพิ่มหนังสืออย่างน้อย 16px ที่ 390px/320px ไม่มีหน้าล้น และ viewport ไม่ปิดซูม การตรวจนี้ยืนยัน CSS/geometry ยังต้องลองพฤติกรรมคีย์บอร์ดและ auto zoom บน Safari/iPhone จริงหลังอัปเดตเซิร์ฟเวอร์


## 0.9.0 — หมวดหมู่ต่อบัญชี (31 ตุลาคม 2026)

ผู้ใช้ขอคงหมวดเริ่มต้นแต่เพิ่ม/ลดได้ เช่น การ์ตูนวาย จึงเพิ่มการจัดการในตั้งค่า รวมการเปลี่ยนชื่อและย้ายหนังสือ/รอตรวจก่อนลบหมวดที่ใช้อยู่ ใช้ optional state.categories และ catalog:categories ผ่าน mutation/outbox/conflict เดิม ไม่สร้าง API หรือบริการแยก หมวดระดับเรื่อง/ฉบับคงแยกจากรูปแบบและสถานะ

ตรวจ [SQLite user_version](https://www.sqlite.org/pragma.html#pragma_user_version) และ [service worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) แล้ว ใช้ migration เพิ่ม catalogs owner-scoped ที่ DB v3 (JSON ยังคง v2), รับ restore DB v1/v2/v3, guard รุ่นใหม่กว่าเดิม และ shell-v27 รวม asset ใหม่ คง flow อัปเดต PWA เดิมไม่บังคับ reload กลางฟอร์ม

ชื่อหมวดบน series/draft ยังเป็น string เพื่อคงข้อมูลเดิม รายการแสดงรวม configured + referenced names จึงไม่ซ่อนหนังสือจาก late offline write/การเลือก conflict ที่นำชื่อเก่ากลับมา การเปลี่ยนชื่อ/ลบปกติย้ายทั้ง series/draft ใน operation เดียว ไม่เปลี่ยน entry/photo/reading/ownership ชื่อเก่าที่กลับมาจะแสดงให้จัดการอีกครั้ง รายละเอียดและเกณฑ์อยู่ใน 15-categories.md
