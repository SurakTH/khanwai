# สถานะระบบและการตรวจรับ

## 0.10.3: หมวดหมู่แทนฉบับใต้ปก

การ์ดชั้นทั้ง gallery/list แสดงรูปแบบ · หมวดหมู่ · ภาษา แทนบรรทัดฉบับ โดยไม่แก้ edition ในข้อมูล/รายละเอียด ตรวจด้วย browser แยกฐานที่ 1440/390/320px หมวดส่วนตัวแสดงตรง ไม่มีหน้าล้น และ API state ไม่เปลี่ยน instance khanwai:0.10.3 healthy แล้ว app/sw ตรง source สำรอง pre-0103-shelf-category รวม 2 รูปก่อนอัปเดต shell-v33 ไม่เปลี่ยน schema/backend


## 0.10.2: รูปปกไม่ดันข้อมูล ISBN ลงไป

ฟอร์ม single/draft แสดงข้อมูลหนังสือต่อจากผล ISBN แล้วค่อยแสดงรูปปกหลัง form-grid ส่วนช่อง paste textarea พับไว้ก่อนใน editor ร่วม ปุ่มเลือกรูป/ถ่ายรูป/วางยังอยู่ เมื่อเลือก candidate มีข้อความสีเขียว role=status ยืนยันว่าใส่ข้อมูลแล้ว ไม่ใช่การบันทึกเข้าบัญชี shell-v32

Browser ที่กระทบ 17 ผ่าน/1 skipped และภาพ scratch หลัง fetch/เลือก candidate ที่ 320/390/1440px ไม่ล้น ตรวจตำแหน่งและข้อความบนภาพจริง ทั้งคลิปบอร์ด/file/offline และข้อมูลสลับโหมดคงเดิม ไม่มี backend/schema change สำรอง /data/backups/pre-0102-compact-cover รวม 2 รูปแล้ว instance khanwai:0.10.2 healthy และ app/photos/workshop/sw ตรง source


## 0.10.1: วางรูปปกที่คัดลอกไว้

ส่วนรูปปกมีปุ่มวางรูปและ textarea สำหรับ ⌘V/Ctrl+V/native paste ใช้ร่วมกับเพิ่มทีละเล่ม รอตรวจ เพิ่มเป็นชุด และเปลี่ยนปกฉบับ/รายเล่ม ผ่านตัวเตรียมรูปและขั้นยืนยันเดิม รูปเก่าคงอยู่เมื่อวางไม่ได้ คำสั่ง async ถูกยกเลิกด้านผลลัพธ์เมื่อเอารูปออกหรือปิด editor ไม่ดัก paste ช่องหนังสืออื่น ไม่โหลดรูปจากลิงก์ clipboard และไม่อ่านคลิปบอร์ดอัตโนมัติ ดู [docs/reference/cover-paste.md](../../reference/cover-paste.md)

ตรวจ unit 66 ผ่าน และ browser ที่เกี่ยวข้อง 20 ผ่าน/2 skipped พร้อม native Chromium clipboard จริง ภาพ scratch UI 320/390/1440px ไม่ล้น ยังต้องลอง Safari/iPhone และ Android จริงสำหรับเมนู paste/permission ของเครื่องนั้น shell-v31 ไม่มี DB/schema/backend change สำรอง /data/backups/pre-0101-cover-paste รวม 2 รูปไว้ก่อนอัปเดต instance khanwai:0.10.1 healthy แล้ว asset photos/workshop/sw ตรง source และ API library ตอบ 401 เมื่อไม่ล็อกอิน


## 0.10.0: สุ่มเรื่องยังไม่อ่านและกู้คืนจากถังขยะ

ชั้น → ••• มีสุ่มเรื่องที่ยังไม่อ่านและถังขยะ ไม่เพิ่มเมนูหลัก/แถว toolbar สุ่ม owned unread ตามตัวกรอง รวมสมาชิกบ็อกซ์และสำเนา ไม่แก้สถานะการอ่าน ถังขยะรองรับ entry/ทั้งฉบับ/draft ตรวจซ้ำก่อนคืนพร้อมข้อมูลและรูปเดิม เก็บจนกู้คืน ไม่มีลบอัตโนมัติ รายละเอียด [docs/reference/trash-and-picker.md](../../reference/trash-and-picker.md)

ใช้ trashedAt บน record เดิมและ activeLibrary เฉพาะการแสดงผล คงข้อมูลเต็มใน AccountStore/export/backup DB v3/JSON v2 ไม่เพิ่มบริการ shell-v30 คง flow อัปเดต PWA เดิม ควรอัปเดตทุกเครื่องก่อนแก้ข้อมูลต่อ เพราะ client เก่าไม่รู้สถานะถังขยะ

ตรวจ npm test 66 ผ่าน, browser เต็ม 169 ผ่าน/1 skipped และชื่อยาว 320px อีก 2 ผ่าน ภาพ scratch DB 320/390/1440px ไม่ล้น Docker อัปเกรด 0.9.0 → 0.10.0/backup/restore/rollback ผ่าน พร้อมสถานะ box/member และรูป ไม่ใช้ข้อมูลจริงในการทดสอบ สำรอง instance เดิมก่อนอัปเดตที่ /data/backups/pre-0100-trash รวม 2 รูป ตรวจ instance khanwai:0.10.0 healthy แล้ว asset ใหม่ตรง source และ API library ตอบ 401 เมื่อไม่ล็อกอิน ไม่อัปเดตเซิร์ฟเวอร์ของผู้ใช้โดยอัตโนมัติ


## 0.9.0: หมวดหมู่ของแต่ละบัญชี

ตั้งค่า → จัดการหมวดหมู่ เพิ่ม เปลี่ยนชื่อ และลบพร้อมย้ายหนังสือ/รายการรอตรวจได้ ค่าเริ่มต้นเดิม ทุกแบบฟอร์ม ตัวกรอง และ CSV ใช้รายการเดียวกัน หมวดว่างซิงก์/ส่งออกได้ ออฟไลน์และ conflict ใช้ outbox/revision เดิม รายละเอียด [docs/reference/categories.md](../../reference/categories.md) พร้อมแก้ตัวอักษรช่องกรอกมือถือเป็น 16px โดยไม่ปิด pinch zoom

ตรวจ npm test 61 ผ่าน, browser เต็ม 149 ผ่าน/1 skipped, ทดสอบหมวดรอบสุดท้าย 8 ผ่าน และ Docker อัปเกรด 0.8.6 → 0.9.0/backup/restore/rollback ผ่าน ภาพจัดการหมวดคอม/มือถือจาก scratch DB ตรวจ 320/390/1440px ไม่ล้น ยังไม่อ้าง Safari hardware test หรือการอัปเดตเซิร์ฟเวอร์ของผู้ใช้

instance ทดสอบเดิมอัปเดตเป็น khanwai:0.9.0 healthy แล้ว สำรอง /data/backups/pre-090-categories รวม 2 รูปก่อน migration; ตรวจ DB v3, healthz, API library 401 เมื่อไม่ล็อกอิน และ asset categories/category-ui/mobile-inputs/app/sw/index ตรงซอร์ส ไม่มีการสร้างบัญชีทดสอบบน volume จริง


## 0.8.6: คืนหน้าชั้นแบบเดิมตามผู้ใช้

ผู้ใช้ส่งภาพ iPhone และขอคืนแบบก่อนเพิ่มช่องการอ่าน จึงคืน shelf.css/shelf-view.js จาก image khanwai:0.8.3 โดยตรง ตรวจเทียบทุก byte กับ source และ asset ที่ LAN ให้บริการตรงกัน เอา quick filter/คู่ช่องอ่าน-เรียงภายนอกของ 0.8.4–0.8.5 ออกทั้งคอมและมือถือ ตัวกรองการอ่านอยู่ในปุ่มกรอง ใช้ 4 reading states/ทั้งหมดตามเดิม ไม่คืน DB หรือย้อนข้อมูล/ฟีเจอร์อื่น

Browser ส่วนที่กระทบ 26 กรณีผ่าน รวม reading default/box/offline/draft/bulk/CSV และ shelf filters/list/selection/toolbar แถวเดียวกับการอ่านในแผงกรอง ตรวจภาพ/ไม่ล้นที่ 320/375/390/430/768/820/1024/1440px ภาพ shelf-after-mobile.png/shelf-after-desktop.png คือแบบที่คืนแล้ว ปกแรกบนมือถือ 390px กลับ y=359 จาก y=413 ใน 0.8.5 ตรวจใน Chromium emulation ไม่อ้างว่าเป็น Safari hardware test

อัปเดต instance เดิม khanwai:0.8.6 healthy สำรอง /data/backups/pre-086-restore-original-shelf รวม 2 รูป ตรวจ healthz, /api/library ตอบ 401 เมื่อไม่ล็อกอิน และ asset ตรง source ไม่สร้างหรือแก้บัญชีทดสอบบนข้อมูลจริง สถานะอ่าน/ข้อมูล/รูปยังใช้ volume เดิม shell-v26 คง flow แจ้งอัปเดต PWA เดิม

## 0.8.5: แถวเครื่องมือที่กลมกลืนบนมือถือและคอม

แทนที่การวางช่องการอ่านลอยเดี่ยวของ 0.8.4 ด้วยกลุ่มเครื่องมือเดียว บนมือถือ/พื้นที่แคบใช้สองช่องโทนอ่อนกว้างเท่ากันสำหรับการอ่านกับเรียง ด้านล่างเป็นจำนวนผลลัพธ์/มุมมอง/จัดการ บนคอมเป็นบรรทัดเดียวเรียบ ๆ ไม่มีกล่องฟอร์มสีขาวแยกจากส่วนอื่น ใช้ native controls เดิมครบทุกสถานะ ไม่มีการเปลี่ยน filter semantics หรือข้อมูล กรอบปกเต็มคอลัมน์และสัดส่วนเดิมตาม 0.8.3

ตรวจภาพจริงก่อน/หลังที่ screenshots/reading-filter-before-mobile.png, reading-filter-before-desktop.png, shelf-after-mobile.png และ shelf-after-desktop.png พร้อมภาพ 320/375/430/1024px และภาพเลือกอ่านแล้ว+เรียงชื่อใน reading-toolbar-selected-mobile.png ข้อมูลตัวอย่างมีชุดที่อ่านผสมเพื่อให้เห็น summary จริง ไม่ใช้บัญชีหรือรูปผู้ใช้

Browser ส่วนที่กระทบ 48 กรณีผ่าน รายงาน last-run=passed ไม่มี failedTests ครอบคลุม reading/box/default/offline/conflict, shelf management/CSV, filter/search/view/selection และเกณฑ์ใหม่ตำแหน่ง/แนว/สัดส่วนเครื่องมือที่ 320/375/390/430/768/820/900/901/1024/1440px: ช่องอ่านและเรียงกว้างเท่ากันเมื่อแบ่งสองแถว, ตรงแนวการ์ดสองคอลัมน์มือถือ, ไม่ทับกัน/ไม่ล้นแนวนอน, select มือถือสูง 44px และข้อมูลในชั้นไม่เปลี่ยน Desktop toolbar สูงไม่เกิน 48px และ compact toolbar ไม่เกิน 100px ตรวจ preview ของกรอบปกและภาพจริงผ่านด้วย ไม่อ้างว่าได้รันทั้งระบบใหม่หรือทดลอง Safari/iPhone hardware

อัปเดต instance เดิมเป็น khanwai:0.8.5 healthy สำรอง /data/backups/pre-085-toolbar-design รวม 2 รูป ตรวจ LAN healthz, /api/library ตอบ 401 เมื่อไม่ล็อกอิน, หน้า login ไม่มี page error และ shelf-view.js/shelf.css/sw.js ที่ให้บริการตรง source ทุก byte ไม่สร้างหรือแก้บัญชีทดสอบบน volume จริง ไม่มี migration/API/dependency ใหม่ shell-v25 คง flow แจ้งอัปเดต PWA เดิม

## 0.8.4: เลือกกรองการอ่านได้ทันที

ย้าย #shelf-reading จากแผงกรองมาอยู่ด้านขวาของแถวสถานะตามผู้ใช้อนุมัติ เลือกทั้งหมด / ยังไม่อ่าน / อยากอ่าน / กำลังอ่าน / อ่านแล้ว บนมือถือแยกอีกบรรทัดและใช้ native select 16px สูง 44px ไม่มี select ซ้ำในแผงกรอง ใช้ readingFilter เดิมกับตัวกรองอื่น ป้ายตัวกรองและการล้างยังทำงาน ไม่เปลี่ยนสถานะหนังสือ ชุดที่อ่านผสมปรากฏตาม entry/member ที่ตรงและแสดงสรุปการอ่านเดิม

Browser เฉพาะส่วนที่กระทบ 46 กรณีผ่าน รายงาน last-run=passed ไม่มี failedTests ครอบคลุม reading, box/default, offline/conflict, shelf management/CSV, gallery/list/selection และกรณีใหม่ quick filter ครบ 4 สถานะ/ไม่เปิดแผง/ไม่มีช่องซ้ำ/ล้างเฉพาะการอ่านคงแท็ก/จอ 320px/ไม่เขียนข้อมูลบัญชี ไม่อ้างว่าได้รันทั้งระบบใหม่ ภาพ shelf-after-desktop.png และ shelf-after-mobile.png จาก source นี้ preview geometry ของกรอบยังผ่าน 320/390/1440px

อัปเดต instance เดิมเป็น khanwai:0.8.4 healthy สำรอง /data/backups/pre-084-reading-filter รวม 2 รูป ตรวจ LAN healthz และ shelf-view.js/app.js/shelf.css/sw.js ที่ให้บริการตรง source ทุก byte ไม่สร้างบัญชีทดสอบบนข้อมูลจริง ไม่มี schema/API/dependency ใหม่ shell-v24 คงการแจ้งอัปเดตเดิม

## 0.8.3: คืนกรอบขนาดเดิม ขยายเฉพาะภาพ

แก้การตีความผิดใน 0.8.2 ตามผู้ใช้ชี้ชัด: กรอบ gallery กลับมากว้างเต็มคอลัมน์ตรงแนวข้อความและมีอัตราส่วนเดิม 1/1.12 บนคอม, 1/1.22 บนมือถือ ขยายเฉพาะปกด้านในให้สูงเต็มพื้นที่ที่เหลือหลัง padding 12/8px คงสัดส่วนและ contain ไม่ crop รูป รายการย่อและข้อมูลหนังสือคงเดิม

ตรวจ geometry จากหน้า render ผ่านที่ 320/390/1440px: กรอบซ้าย/ความกว้างเท่าการ์ด อัตราส่วนเท่าเดิม ปกกินความสูงมากกว่า 88% และไม่ล้นกรอบ browser เฉพาะส่วนที่กระทบ 12 กรณีผ่าน (gallery/list/filter/selection/private image/หน้าเช็กเปิดรายละเอียด) ภาพ shelf-after-mobile.png และ shelf-after-desktop.png เป็น source นี้

อัปเดต instance เดิม khanwai:0.8.3 healthy สำรอง /data/backups/pre-083-cover-size-correction รวม 2 รูป ตรวจ LAN healthz และ shelf.css/sw.js ที่ให้บริการตรง source ทุก byte ไม่สร้างบัญชีทดสอบบนข้อมูลจริง shell-v23 ใช้ flow แจ้งอัปเดต PWA เดิม

## 0.8.2: กรอบปกกระชับขึ้น

ลดพื้นหลังรอบปกบน gallery ตามภาพผู้ใช้ ให้กรอบโอบปกด้วยขอบว่าง 8–10px และขยายปกเต็มพื้นที่ด้านใน คงภาพเต็มด้วย contain ไม่แก้ไฟล์รูป ไม่เปลี่ยนข้อมูลหรือมุมมองรายการย่อ ย้ายป้ายข้อมูลตัวอย่างเหนือกรอบ ภาพ shelf-after-mobile.png และ shelf-after-desktop.png สร้างใหม่จาก source นี้

ตรวจ browser เฉพาะส่วนที่กระทบ 12 กรณีผ่าน (desktop/mobile: gallery/search/filter/selection/list/private cover/long metadata/ภาพและการเปิดรายละเอียดในหน้าเช็ก) พร้อม preview ไม่ล้นที่ 320/390/1440px ไม่เพิ่ม unit test สำหรับการปรับระยะ CSS และไม่อ้างว่าได้รัน regression ทั้งระบบใหม่

อัปเดต instance เดิมเป็น khanwai:0.8.2 healthy สำรอง /data/backups/pre-082-cover-frame รวม 2 รูปก่อนเปลี่ยน container ตรวจ LAN healthz และ shelf.css/sw.js ที่ให้บริการตรง source ทุก byte ไม่สร้างหรือแก้บัญชีทดสอบใน volume จริง shell-v22 คง flow อัปเดต PWA เดิม

## 0.8.1: รายละเอียดฉบับและการ์ดรายเล่ม

อัปเดต instance เดิมเป็น khanwai:0.8.1 healthy แล้ว สำรอง /data/backups/pre-081-book-details รวม 2 รูปก่อนเปลี่ยน container ตรวจ LAN healthz, /api/library ตอบ 401 เมื่อไม่ล็อกอิน, หน้า login ไม่มี page error และ index/app/detail.css/detail-view.js/sw.js ที่ให้บริการตรง source ปัจจุบันทุก byte ไม่สร้างหรือแก้บัญชีทดสอบใน volume จริง ใช้ app image และ volume เดิม ไม่มี migration หรือบริการเพิ่ม

ปรับตามภาพและคำขอผู้ใช้ให้รายเล่มเป็นการ์ด มีเลขเล่ม/รูป ข้อมูลสำเนา/ที่เก็บ/ISBN และช่องการครอบครอง/การอ่านที่มี label ชัดเจน ปุ่มแก้ข้อมูล/รูปปก/ลบอยู่เมนู ••• ของแต่ละ entry ลบยังยืนยันตามเดิม เพิ่มเล่มใกล้หัวข้อ ย่อภาพรวมเลขเล่มและการอ่านทั้งชุด ชื่อ dialog กับปุ่มปิดติดด้านบนเมื่อเลื่อน เปลี่ยนสถานะแล้วคงตำแหน่ง/focus และ box expansion ไม่มี schema/API/dependency เพิ่ม ดู docs/reference/book-details.md

ผลตรวจสุดท้าย unit/API 58 ผ่าน และ browser ทั้งชุด 142 ผ่านสะอาดบน source สุดท้าย (desktop Chromium 71 + mobile viewport 71) รวมการ์ด/menu keyboard/Escape/ลบเฉพาะ entry/scroll-focus/box expansion/close-search focus/ข้อมูลอีกเครื่องระหว่างเปิด modal และ regression บัญชี รูป ISBN CSV/offline/retry/conflict/PWA เดิม รอบก่อนพบ mobile cover test กรอกคำค้นต่อทันทีหลังปิด dialog แล้ว input ถูก render ทับ แก้ให้ refresh หลังปิดเฉพาะเมื่อมี content update รออยู่ พร้อม regression แล้วจึงรันทั้งชุดใหม่ผ่าน 142 ไม่ได้แก้ด้วยการเพิ่ม timeout

ภาพจากฐาน/บัญชีชั่วคราวแยกข้อมูลใน screenshots/detail-after-desktop.png, detail-after-mobile.png, detail-volumes-desktop.png และ detail-volumes-mobile.png สคริปต์ tests/preview-detail.mjs ตรวจ dialog ไม่ล้นแนวนอนที่ 320/390/1440px ภาพใช้ข้อมูลสมมติ ไม่คัดรูปส่วนตัวจากบัญชีจริง ไม่อ้างว่าเป็นการลอง Safari/iPhone หรือ Android hardware

## 0.8.0: ชั้นหนังสือใหม่

อัปเดต instance เดิมเป็น khanwai:0.8.0 healthy แล้ว สำรอง /data/backups/pre-080-shelf-redesign รวม 2 รูปก่อนเปลี่ยน container ตรวจ LAN healthz, /api/library ตอบ 401 เมื่อไม่ล็อกอิน, หน้า login ไม่มี page error และ index/app/shelf.css/shelf-view.js/sw.js ที่ให้บริการตรง source ปัจจุบันทุก byte ไม่สร้างหรือแก้บัญชีทดสอบบนข้อมูลจริง

Docker smoke แยก project ผ่านการ upgrade 0.7.1 → 0.8.0, recreate คงข้อมูล, SQLite+รูป backup/restore, login/export/settings และ rollback ไป 0.7.1 พร้อมหนังสือและรูปเดิม ลบเฉพาะ scratch project/volume ที่สคริปต์สร้าง ไม่เพิ่ม reverse proxy หรือบริการถาวร

จัดหน้าชั้นใหม่ตามคำขอให้ลดความรกและสวยขึ้น ยุบสถิติเป็นบรรทัดเดียว รวมตัวกรองไว้ในปุ่มกรอง แสดงตัวกรองที่ใช้อยู่เป็นป้ายเอาออกได้ ย้ายเลือกหลายรายการไว้ ••• การ์ดเน้นปก ชื่อ และสถานะ ส่วนรายละเอียดการอ่าน/ที่เก็บ/แท็กอยู่ในรายการย่อและรายละเอียดฉบับ ฟังก์ชันเดิมยังอยู่ ไม่มี schema/API หรือบริการ Docker ใหม่ ดู docs/development/history/shelf-redesign.md

หลักฐานภาพจากบัญชีทดสอบแยกข้อมูล: screenshots/shelf-before-mobile.png, shelf-after-mobile.png, shelf-before-desktop.png, shelf-after-desktop.png, shelf-after-filters-mobile.png และ shelf-after-list-mobile.png ปกแรกบนจอ 390px ขึ้นจาก y=644 เป็น y=359 เห็นปกและชื่อสองเรื่องในจอแรก ตรวจไม่ล้นแนวนอนที่ 320/390/1440px

ผลตรวจ unit/API 58 ผ่าน; browser ครอบคลุมทั้งชุด 134 scenarios: รอบเต็ม 132 ผ่าน อีก 2 กรณีรอชื่อปุ่มรอส่งเดิมที่ตอนนี้มีจำนวนต่อท้าย แก้ selector ให้ระบุเฉพาะกลุ่มสถานะและตรวจซ้ำ desktop/mobile 2 ผ่าน รวม coverage ผ่านครบ 134 กรณี ไม่อ้างว่ารอบเต็มผ่านสะอาดครั้งเดียว รอบเริ่มต้นพบชื่อปุ่มล้างคำค้นชนกับล้างคำค้นและตัวกรอง จึงระบุ exact name และเปลี่ยนปุ่มออกโหมดเลือกเป็นเลิกเลือกให้ชัดจากยกเลิกในฟอร์ม

รวม regression ของบัญชี/owner isolation, รูปส่วนตัว, offline reload/retry/conflict, PWA update ขณะมีงานค้าง, อ่านทั้งชุด/default/box members, ISBN/ชุด/duplicates/แก้ entry/CSV และ tests/browser/shelf-redesign.spec.js ใหม่ 8 กรณีสำหรับเครื่องมือแบบยุบ/ป้ายตัวกรอง/whole-card selection/รายการย่อจอแคบ/รูปและชื่อยาว ตรวจภาพด้วย Chromium ไม่แทน Safari/iPhone หรือ Android hardware

## 0.7.1: ปุ่มการอ่านในหน้าชุดและ default ยังไม่อ่าน

อัปเดต instance เดิมเป็น khanwai:0.7.1 healthy สำรองก่อนอัปเดต /data/backups/pre-071-series-reading รวม 2 รูป ตรวจ healthz หน้า login และ source ปุ่มใหม่ผ่าน LAN ไม่มี page error และไม่สร้าง/แก้บัญชีทดสอบบน instance จริง Docker upgrade 0.7.0 → 0.7.1, persistence, backup/restore และ rollback ผ่าน พร้อมหนังสือ รูป แท็ก การอ่านและ settings

เพิ่ม อ่านแล้ว / ยังไม่อ่าน / อยากอ่าน ในรายละเอียด series ใช้กับทุก entry ที่บันทึกในฉบับนี้ รวม box members มีข้อความระบุขอบเขตและ aria-pressed เมื่อทุกเล่มเหมือนกัน ไม่สร้าง entry ตาม target/metadataSeed ไม่กระทบรูปแบบหรือฉบับอื่น และไม่เปลี่ยน ownership/ISBN/quantity/member labels

ตามคำขอล่าสุดแทนที่ unknown default ของ 0.7.0: readingStatus ว่างหรือไม่มีใช้ unread ขณะอ่านค่า ไม่เขียนชั้นทั้งหมดใหม่เมื่อเปิดดู คง read/planned/reading ที่เลือกไว้ ชื่อ planned เปลี่ยนเป็นอยากอ่าน แต่ CSV ตั้งใจจะอ่าน จากรุ่นเก่ายังใช้ได้ ไม่มี DB migration

ผลตรวจสุดท้าย unit/API 58 ผ่าน และ browser regression ทั้งชุด 126 ผ่านสะอาดบน source เดียวกับ image (desktop Chromium 63 + Pixel 7 viewport 63) รวมปุ่มทั้งชุด/default ไม่สร้าง mutation/view/offline reload/sync/เลือกฉบับเดียว/box members และฟีเจอร์เดิมทั้งหมด ภาพจริง screenshots/series-reading-mobile.png พร้อมตรวจความกว้าง 320px และ touch targets สูงอย่างน้อย 44px ไม่อ้างว่าเป็น Safari/iPhone hardware test

## 0.7.0: สถานะการอ่าน

อัปเดต instance หลักเป็น khanwai:0.7.0 healthy แล้ว สำรองก่อนอัปเดต /data/backups/pre-070-reading-status รวม 2 รูป ตรวจ healthz หน้า login และ reading.js ผ่าน LAN ไม่มี page error ไม่สร้างบัญชีทดสอบใน instance จริง Docker 0.6.0 → 0.7.0 upgrade/recreate/backup/restore/rollback ผ่าน รวม readingStatus และ readingByMember ของ box พร้อมรูปและ settings

เพิ่มยังไม่อ่าน / ตั้งใจจะอ่าน / กำลังอ่าน / อ่านแล้ว และยังไม่ระบุสำหรับข้อมูลเดิม เก็บแยกจาก owned/ordered/wishlist รองรับรายสมาชิกใน box ไม่สร้างเล่มเดี่ยวซ้ำ ช่องภาพรวมบ็อกซ์ที่อ่านต่างกันแสดง “ต่างกันแต่ละเล่ม” แก้ metadata ไม่เปลี่ยนฐานการอ่านหรือทำให้สมาชิกที่เพิ่งเพิ่มกลายเป็นอ่านแล้ว เพิ่ม/ถาด/โหมดหลายเล่ม/แก้/quick edit/bulk/filter/CSV ใช้ metadata เดิมต่อ owner ไม่มี migration SQLite รายละเอียด docs/reference/reading-status.md

ผลตรวจ: unit/API 56 ผ่าน รวม reading enum, box members, copies, unknown legacy, ownership independence, filter+location, CSV, server validation, owner isolation และ SQLite backup/restore; browser รอบเต็ม 120 กรณี: 118 ผ่าน สองกรณีใหม่ล้มเพราะ fixture ไม่เปลี่ยนจากหน้าชั้นไปถาดและกลับชั้น แก้ navigation ใน fixture แล้วตรวจซ้ำ 16 กรณีผ่านทั้ง desktop/mobile รวมสองกรณีเดิม การแก้ box metadata/เพิ่มสมาชิกเมื่อเล่มเดิมอ่านครบ การค้นและแก้ entry เดิม ไม่อ้างว่ารอบเต็มผ่านสะอาดในครั้งเดียว รวม coverage 122 browser scenarios เมื่อเพิ่ม regression สมาชิกใหม่

Browser ใช้ Chromium desktop และ Pixel 7 emulation มี offline reload/sync, draft/batch review, reading filter, read+wishlist แยกกัน, box members, metadata preservation และ export ตรวจภาพจริงและ overflow 320px ใน screenshots/reading-box-mobile.png เป็นบัญชีสมมติ ยังไม่ใช่ Safari/iPhone hardware test

## 0.6.0: จัดชั้นและ CSV ทั้ง 5 ข้อ

เผยแพร่ใน instance เดิมของผู้ใช้เป็น khanwai:0.6.0 healthy แล้ว (self-host LAN เดิม ไม่ใช่ public hosting) สำรองก่อนอัปเดต /data/backups/pre-060-shelf-management รวม 2 รูป ตรวจ healthz, หน้า login และ ES modules ใหม่ทั้ง 4 ผ่าน LAN ด้วย Chromium ไม่มี page error และไม่สร้าง/แก้บัญชีทดสอบใน instance จริง ลบเฉพาะ scratch project/volume ทดสอบแล้ว

ทำรายการย่อและจำมุมมองแยกบัญชี ตัวกรองชุดไม่ครบ/ไม่มีปก/ไม่มีที่เก็บ พร้อมกรองที่เก็บและแท็ก แก้หลาย entry พร้อม before/after review และ CSV UTF-8 พร้อม column mapping, row edit/exclusion, duplicate/error checks และ explicit commit ใช้ account/outbox/conflict เดิม ไม่มี schema migration หรือบริการ Docker เพิ่ม คู่มือ docs/reference/shelf-management.md

หลักฐานปัจจุบัน: unit/API 49 ผ่าน (รวม server validation ของแท็ก/owner isolation/export/SQLite backup และกฎ CSV/box/target); Docker 0.5.4 → 0.6.0 → rollback smoke ผ่าน พร้อม recreate/SQLite+รูป/แท็ก/settings/export หลัง restore

Browser รอบสุดท้ายผ่านทั้งชุด 110 กรณีบน source เดียวกับ image สุดท้าย (desktop Chromium 55 + Pixel 7 viewport 55) ใช้ webServer/DB ชั่วคราวแยก project ที่ 4187/4188 เพื่อไม่สะสม auth limit จากบัญชีทดสอบ ไม่มีการลด production auth limit รวมกับ unit/API 49 = 159 กรณีผ่าน รอบ Docker ตรวจฟีเจอร์ใหม่ desktop/mobile 14 กรณี และหลัง guard/ยุบ toolbar desktop 12 กรณีผ่านด้วย ครอบคลุม conflict จริงที่ server ปฏิเสธ stale entry และ CSV ที่ชั้นเปลี่ยนระหว่าง review รอบสุดท้ายไม่มี test ค้างหรือ fail

ตรวจภาพจริงที่ 390px และ overflow ที่ 320px ทั้งรายการ/ตัวกรอง/CSV screenshots/shelf-list-mobile.png, shelf-list-desktop.png, csv-review-mobile.png เป็นข้อมูลสมมติ การยุบ toolbar ทำให้ปกและรายการขึ้นมาสูงกว่าร่างแรก ไม่เพิ่ม hero บนชั้น ยังไม่ได้ลอง Safari หรือ hardware จริง

## 0.5.4: เรียงชั้นหนังสือ

อัปเดต instance หลักเป็น khanwai:0.5.4 healthy สำรองก่อนอัปเดตที่ /data/backups/pre-054-shelf-sort ตรวจ healthz หน้า login และโมดูลใหม่ผ่าน LAN ด้วย Chromium ไม่มี page error ไม่แก้ข้อมูลบัญชีจริง

เพิ่ม 6 ตัวเลือก: เพิ่มล่าสุด (default), เพิ่มเก่าสุด, ชื่อเรื่อง ก–ฮ/A–Z, ชื่อย้อนกลับ, แก้ไขล่าสุด, ผู้เขียน ใช้ร่วมกับค้นหา/กรองสถานะ/รูปแบบ/ประเภท จำแยกบัญชีใน localStorage ของเบราว์เซอร์นี้ ไม่ซิงก์การตั้งค่านี้ข้ามเครื่อง ใช้ Intl.Collator ภาษาไทยและ natural numeric; unknown date/ผู้เขียนว่างอยู่ท้ายรายการ เก็บวันที่สร้างและแก้ไขใน record JSON เดิมพร้อมรักษา independent edits ของ entry ไม่เปลี่ยน SQLite schema

ผลตรวจ: unit/API 38 ผ่าน รวม 4 tests ใหม่เรื่องภาษา/ตัวเลข/วันที่ขาด/ไม่แก้ข้อมูลต้นฉบับ/timestamps ไม่สร้าง conflict ใน record ที่ไม่เกี่ยวข้อง Browser 90 scenarios ตรวจครบ desktop Chromium และ Pixel 7 viewport: รอบแรก 85 ผ่าน พบ label ของ select ไม่ชัดและ fixture บัญชีที่สมมติว่าเรื่องเป้าหมายอยู่การ์ดแรกเสมอ แก้ aria-label และให้ fixture เลือก series ID ตรง ไม่ผูกลำดับ UI มี PWA activation timing ล้มครั้งหนึ่งด้วย หลังแก้เฉพาะจุดตรวจซ้ำ 6 กรณีผ่านทั้งหมด (sort/บัญชี/อัปเดต PWA ทั้งสอง viewport) ไม่อ้างว่าเป็น full clean run ครั้งเดียว

กรณีใหม่ยืนยันเพิ่มล่าสุด/เก่าสุด/ชื่อขึ้นลง/แก้ไขล่าสุด ค้นหาหลังเรียง จำหลังเปลี่ยนหน้าและ reload และบัญชีใหม่ใช้ค่า default แยกกัน ไม่มีแนวนอนล้น ยังไม่ได้ลอง Safari หรืออุปกรณ์จริงในรอบนี้

## 0.5.3: ย้ายแบนเนอร์จากชั้นไปถาดรอตรวจ

อัปเดต instance หลักเป็น khanwai:0.5.3 healthy และตรวจ healthz LAN ผ่าน สำรองข้อมูลก่อนอัปเดตที่ /data/backups/pre-053-layout

ย้าย hero ไปหน้า drafts ปรับคำอธิบายการตรวจทานและถอดปุ่มเปิดหน้าเดิม ชั้นหนังสือเริ่มจากสถิติ/ค้นหา/รายการ ใช้ CSS responsive เดิม ทดสอบ browser เดิมเฉพาะ search/filter/detail และ draft review 4 กรณีผ่านบน Docker 0.5.3 (desktop/mobile) พร้อม layout smoke ทั้งสอง viewport: shelf ไม่มี hero, drafts มี hero ไม่มีปุ่มวนหน้าเดิม และไม่ล้นแนวนอน ไม่ได้รัน regression ทั้งชุดซ้ำ

## 0.5.2: ปกและการเปิดผลค้น

อัปเดต instance หลักเป็น khanwai:0.5.2 healthy แล้ว สำรองก่อนอัปเดตที่ /data/backups/pre-052-check-covers ตรวจหน้า LAN และ asset ใหม่ด้วย Chromium แบบอ่านอย่างเดียว ไม่มี page error ไม่แก้ข้อมูลบัญชีจริง

หน้าเช็กก่อนซื้อใช้รูปปกส่วนตัวที่บันทึกไว้ โดยเลือก entry ที่ตรง ISBN/เลขเล่มก่อน ถ้าไม่มีใช้ภาพแทนชุดพร้อมคำกำกับ และแสดง placeholder เมื่อไม่มีรูป ไม่เพิ่มการดึงภาพภายนอก ผลค้นแตะได้ทั้งการ์ดผ่าน native button ของชื่อเรื่องที่ขยายพื้นที่คลิก ใช้ Enter/Space และ focus indicator ได้ ปิดรายละเอียดแล้วคำค้นยังอยู่

ตรวจเฉพาะส่วนด้วย Playwright บน Docker 0.5.2: 10 กรณีผ่าน (desktop Chromium และ Pixel 7 viewport) ครอบคลุมรูป entry/ภาพแทนชุด/ไม่มีรูป แตะปกและส่วนเนื้อหาการ์ด คีย์บอร์ด สถานะเช็กซ้ำเดิม และปุ่มเพิ่มหน้าเช็กบน HTTP LAN ไม่อ้างว่าได้ทดสอบ Safari หรือมือถือจริงแล้ว ไม่เปลี่ยน schema SQLite

## 0.5.1: UUID fallback และปุ่มเพิ่มหน้าเช็ก

ผลตรวจ: unit/API 34 ผ่าน, browser regression 84 ผ่านบน Docker 0.5.1 รวมกรณีปิด randomUUID แล้วเพิ่มชุด/เล่มและส่งเข้าฐานข้อมูล ทดสอบ HTTP LAN จริงแยกโดยไม่ override API เพื่อยืนยัน insecure-context path

public/ids.js สร้าง ID แบบ native หรือ getRandomValues UUID v4 สำหรับ HTTP LAN ทุกจุดในเว็บและ outbox/conflict ใช้ helper เดียวกัน เพิ่มปุ่มเพิ่มหนังสือบน heading หน้าเช็ก ใช้โหมดทีละเล่ม/หลายเล่มเดิม ทดสอบ fallback เมื่อปิด randomUUID รวมการสร้างชุด/เล่มและการส่งเข้าบัญชีจริงใน instance ทดสอบ ไม่แก้ schema SQLite


## 0.5.0: เพิ่มหนังสือจากปุ่มเดียวและ ISBN ต้นทางชุด

ผลตรวจรอบนี้: unit/API 33 ผ่าน; browser regression 82 ผ่านบน Docker 0.5.0 ครอบคลุมปุ่มเดียว/seed label/seed นอกช่วง/เพิ่มต่อ/สลับโหมด/ใช้ template ออฟไลน์ และ flow เดิมทั้งหมด Live NLT บน iPhone viewport เพิ่มชุด 1–10 ได้ ISBN เฉพาะเล่ม 10 แล้วเปิดฟอร์มเล่ม 11 ที่ ISBN/ปกว่าง ภาพ screenshots/batch-isbn-review-mobile.png เป็นบัญชีทดสอบ

Docker backup/restore smoke ผ่าน รวม optional metadataSeed, รูป และ settings หลังปรับ scroll กลับหัวขั้นรีวิวตรวจ flow เพิ่มใหม่ซ้ำบน image สุดท้าย

เพิ่มหนังสือ → ทีละเล่ม / หลายเล่มในชุด ใช้ ISBN ของเล่มหนึ่งช่วยกรอกข้อมูลร่วม แล้วระบุ “ISBN นี้เป็นของเล่ม” ก่อน preview ผูกเฉพาะเล่มนั้นถ้าเลือกเพิ่ม เล่มอื่นว่าง; seed อยู่นอกช่วง/เล่มที่เว้นไม่สร้าง ownership ใช้ template ที่เคยบันทึกออฟไลน์ได้ มีเพิ่มเล่มถัดไปต่อหลังบันทึกโดยรักษาฉบับ/สถานะ/ที่เก็บและล้างข้อมูลเฉพาะเล่ม

Optional series.metadataSeed ผ่าน validation และ round-trip export/SQLite backup/restore แล้ว ไม่เปลี่ยน SQLite schema (ยัง v2) รายละเอียด decision log ข้างล่างเป็นผลตรวจเวอร์ชันก่อนหน้า


## 0.4.0: ตั้งค่าแหล่งข้อมูล

Docker smoke ผ่านทั้งอัปเกรด 0.3.1 → 0.4.0, backup/restore settings+รูป และ rollback ด้วย CLI/image เก่า เปิด container หลัก khanwai:0.4.0 healthy บน LAN:4173, schema v2 แล้ว สำรองก่อนย้ายที่ /data/backups/pre-040-settings ไม่เปลี่ยนแหล่งค้นที่เลือกให้บัญชีผู้ใช้เอง

Live UI smoke บัญชีทดสอบบน iPhone viewport: เลือก NLT อย่างเดียวแล้วค้น ISBN ที่ผู้ใช้ให้ตรวจ ได้ title/ISBN/label=10/language=ไทย/source=NLT ใน review โดยไม่เข้าชั้นอัตโนมัติ ภาพ provider-settings-mobile.png และ nlt-review-mobile.png อยู่ใน screenshots/ ไม่มีบัญชีจริงของผู้ใช้ในภาพ

เลือกเปิด/ปิด/เรียง Google Books, Open Library, NLT ได้ใน settings บันทึกต่อบัญชีบนเซิร์ฟเวอร์ ใช้กับการค้นครั้งถัดไปและเปิดจากอีกเครื่องได้ ปิดทั้งหมดเป็น manual-only; default คง Google/Open Library และ NLT ต้องเลือกเปิดเอง

SQLite user_version=2 เพิ่ม preferences พร้อม owner/revision; ทดสอบย้ายข้อมูล v1, กู้ backup v1/v2, settings isolation/conflict/restart, NLT exact ISBN และ cache แยกตามแหล่งแล้ว unit/API 32 ผ่าน; browser 72 scenarios ตรวจครบ (regression 71 ผ่าน และแก้ fixture สังเกต activation ของ SW ก่อน app ลงทะเบียน URL เดิมซ้ำ แล้วกรณี PWA ทั้งสอง viewport ผ่าน) การตั้งค่าต้องออนไลน์และยังไม่รวมใน JSON หนังสือ; operator SQLite backup รวมให้


## Patch 0.3.1: ISBN lookup

เพิ่ม Open Library fallback, exact ISBN check, public-metadata cache/dedup/throttling และ Google API key แบบ optional ฝั่งเซิร์ฟเวอร์ UI แสดงแหล่งข้อมูลจริงและแยก quota หมดจากแหล่งสำรองที่ไม่มีรายการ ไม่เดาภาษา/ฉบับ/เลขเล่ม ผล unit/API รอบแก้นี้ 28 ผ่าน browser เฉพาะ lookup 6 cases ผ่านบน Docker 0.3.1 (desktop/mobile) รวม fallback source/unknown fields และข้อมูลกรอกไม่หายเมื่อ quota หมด ส่วนด้านล่างเป็นหลักฐานรอบบัญชี 0.3.0


อัปเดต 30 ตุลาคม 2026: จากต้นแบบ localStorage 0.2.0 เป็นระบบบัญชีจริง 0.3.0 แล้ว รายละเอียดโครงสร้างใน [docs/development/history/implementation-notes.md](implementation-notes.md) และวิธีรัน/สำรองใน [docs/deployment.md](../../deployment.md)

## ทำได้จริง

- สมัคร/เข้าใช้/ออกจากระบบ เปลี่ยนรหัสผ่าน ลบบัญชี cookie session ฝั่งเซิร์ฟเวอร์ ชั้นบัญชีใหม่ว่าง ข้อมูลส่วนตัวแยก owner ทุก API/export/photo
- SQLite และรูปอยู่ data volume เดียว เปิดด้วยบัญชีเดิมเห็นข้อมูลที่ซิงก์แล้วจากเบราว์เซอร์อีกเครื่อง
- ค้นชื่อ/ผู้เขียน/ชื่อย่อ/ISBN, ชั้น gallery และหน้าเช็กก่อนซื้อคนละบทบาท มี owned/ordered/wishlist และบ็อกซ์ coverage
- เพิ่ม/แก้ข้อมูลเรื่อง/ฉบับและแต่ละเล่ม ID เดิม กรอกเองได้เสมอ เพิ่มช่วงเล่มโดยรีวิวและเว้นเล่ม ข้ามของที่มีแล้วรวมบ็อกซ์
- รูปปกต่อชุด/เล่ม/draft พร้อมพรีวิว ย่อเป็น JPEG สูงสุด 720px ก่อนส่ง รูปไม่เกิน 450,000 อักขระ data URI (ไฟล์ต้นทางไม่เกิน 12MB) เปลี่ยน/ลบได้
- physical/ebook เป็นรูปแบบฉบับ แยกจากสถานะ ไม่บังคับ ISBN สำหรับ ebook หรือกรอกมือ
- เมนูหลักสี่รายการ ตัวเลขมีเฉพาะชั้นหนังสือ ไม่มีหน้าโชว์ทดลอง
- ZXing reader แพ็กในเว็บ อ่าน EAN-13 จากไฟล์ภาพในเครื่อง ถ่าย/เลือกรูปแยกกัน ไม่พึ่ง BarcodeDetector และไม่มี live scanner ภาพสแกนไม่ถูกส่งไปเก็บเป็นปกเอง
- ISBN-10/13 checksum และ normalization, Google Books metadata ผ่านเซิร์ฟเวอร์ มี review/fallback พบ/ไม่พบ/ล่ม/429 ไม่ commit อัตโนมัติ
- IndexedDB แยกบัญชี PWA shell/private photo cache, offline read/edit/outbox, delta sync/idempotency/tombstones, conflict UI และป้องกันแท็บเก่าทับงานที่ยังไม่ส่ง
- JSON export รวมรูป/import preview แบบรวมข้ามซ้ำหรือแทนที่หลังยืนยัน legacy v1/v2 ไม่ auto-import และไม่ลบต้นฉบับใน localStorage
- CLI backup/restore SQLite + รูป + checksum และรีเซ็ตรหัสผ่านโดยผู้ดูแล

## ขอบเขตการตรวจรับ

คำสั่ง `npm test` ครอบคลุม ISBN/validation/box/format/batch/import, auth/session/origin, owner isolation, revision/idempotency/dependencies, tombstones, password/delete, backup integrity/restore และรูป ผลรอบล่าสุด 22 tests ผ่าน

Browser tests ใน `tests/browser/` ใช้บัญชีสมมติและ SQLite ของ instance ทดสอบ แยกจากข้อมูลผู้ใช้ desktop Chromium 1440×1000 และ Pixel 7 emulation:

- ผลสุดท้าย browser 64 cases ผ่านกับ Docker 0.3.0: flow เดิม 38 และบัญชี/ซิงก์ 26 (รัน regression 62 ผ่าน แล้วเพิ่ม PWA update อีก 2 ผ่าน; ตรวจ ordered→owned ข้ามเครื่องและ session ระหว่างเปิดฟอร์มซ้ำ 4 ผ่าน)
- ครอบคลุมบัญชีข้าม browser contexts, offline mutation/reload/retry, lost acknowledgement, conflict UI, expired session, stale tab, cache รูป/logout, สมัครจริง, ส่งออกก่อนละทิ้งคิว, cursor หลัง restore อ่าน cache เมื่อเซิร์ฟเวอร์ 503, แตะยืนยันซ้ำ และ PWA update ขณะมีฟอร์ม/outbox
- ภาพ auth layout ใน screenshots/account-mobile.png (iPhone viewport บน Chromium) และ account-desktop.png ไม่ใช่หลักฐาน Safari หรือกล้องเครื่องจริง

`node tests/docker-smoke.mjs` ผ่าน: recreate container แล้ว export ตรงเดิม, CLI backup/restore ไป data directory ใหม่, เข้าสู่ระบบใหม่และอ่านรูปได้ byte-identical ลบเฉพาะ scratch project/volume ที่สร้างไว้ใน test

## วิธีทดสอบ

```sh
npm ci
npm test
npx playwright install chromium
npm run test:e2e
node tests/docker-smoke.mjs
```

Linux ที่ขาด dependencies ให้เตรียม Chromium dependencies ก่อน เช่น `npx playwright install-deps chromium` เมื่อผู้ดูแลอนุญาต บนเครื่องนี้เคยใช้ไลบรารี/fontconfig ชั่วคราวจาก /tmp/book-browser-deps ไม่ผูก path นี้ใน config โปรเจกต์

ค่าเริ่มต้น browser tests ใช้ test server และฐานข้อมูล temp ของตัวเอง พอร์ต 4187 กำหนด TEST_BASE_URL เพื่อชี้ instance Docker ที่แยกข้อมูลทดสอบแล้วได้ test สร้างหลายบัญชี จึงห้ามชี้ข้อมูล production

Barcode fixtures สร้างอิสระใน tests/fixtures ใช้ ISBN สาธารณะ 9780306406157 และ retail EAN 4006381333931 มีภาพหมุน ทดสอบปิด BarcodeDetector และออฟไลน์ ไม่ใช่การทดสอบกล้องฮาร์ดแวร์ หากแก้ decoder ให้ `npm run build:barcode` ก่อนสร้าง image ไฟล์ bundle/license เก็บใน public/vendor ไม่มี CDN/WASM/service เพิ่ม

## สิ่งที่ยังไม่ยืนยัน

- ยังไม่ได้ทดสอบ Safari/iPhone/Android เครื่องจริงหรือ OS install PWA; emulation พิสูจน์ layout/flow ใน Chromium เท่านั้น
- HEIC อ่านได้เมื่อเบราว์เซอร์เปิดภาพได้ ไม่มี converter หากเปิดไม่ได้ให้ JPG/PNG หรือพิมพ์ ISBN
- Google Books live control สอง ISBN เคยได้ 429 ทั้งคู่ ผลพบข้อมูลใน browser tests ใช้ mock ไม่ใช่หลักฐาน coverage หนังสือไทย
- ยังไม่มี AI extraction/provider, CSV export, UI สร้างบ็อกซ์, metadata provenance ราย field หรือ email recovery
- ยังไม่ได้ publish image registry, production hosting, HTTPS endpoint ภายนอก หรือ ARM64 image validation
- เรื่องกับฉบับยังอยู่ใน series record เดียว แตกต่างจาก entity เป้าหมายใน docs/03 มีการแยกแถว entries/owner/revision ใน SQLite จริงแล้ว

ข้อมูลตัวอย่างเป็นชื่อเรื่อง/ผู้เขียนสมมติ ใช้ปุ่มโหลดตัวอย่างจาก settings โดยตั้งใจเท่านั้น ไม่ใส่เข้าบัญชีใหม่อัตโนมัติ ไม่ส่งหนังสือหรือรูปส่วนตัวไป provider เพื่อทดสอบ

## ตรวจรับรอบบัญชีและข้อมูลจริง

รอบนี้เสร็จที่บัญชีจริง → ชั้นส่วนตัวใน SQLite → รูปใน volume → เปิดอีกเครื่อง → แก้ออฟไลน์/retry/conflict → ย้ายข้อมูลเดิม → สำรอง/กู้คืน โดยคง flow หนังสือเดิม หลักฐานคือ unit/API 22, browser 64, Docker persistence/restore และ read-only smoke ของ container หลัก

เปิด `book-app-1` ด้วย khanwai:0.3.0 แล้ว: healthy, user=node, mount /data, หน้า login render ไม่มี JavaScript error และ /api/library คืน 401 เมื่อไม่ล็อกอิน สำรองก่อนอัปเดตไว้ /data/backups/pre-030-final ไม่สร้างบัญชีตัวอย่างใน volume จริง ปิดและลบเฉพาะ Compose projects/volumes ที่ใช้ทดสอบแล้ว ข้อมูล localStorage ต้นแบบไม่ถูกลบ

สิ่งที่ยังเปิดในแผนรวม (AI, CSV, UI สร้างบ็อกซ์, hardware camera/install และ public hosting) ไม่ได้อ้างว่าเสร็จในรอบบัญชีนี้ ดูข้อจำกัดด้านบนก่อนนำไปใช้เป็น production

## 0.11.0 — ปรับหน้าตาแอพ

ปรับหน้าชั้น เมนู ฟอร์มเพิ่มหนังสือ หน้ารายละเอียด และหน้าตั้งค่าให้ใช้รูปแบบเดียวกันทั้งคอมและมือถือ ภาพใน README แสดงหน้าตารุ่นนี้ ดูขั้นตอนอัปเกรดใน [คู่มือเซิร์ฟเวอร์](../../deployment.md)
