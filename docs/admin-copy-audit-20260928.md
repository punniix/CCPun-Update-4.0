# Admin copy audit · 28 กันยายน 2569

ฐานที่ตรวจ: `v4-production` ณ commit `7012dc6107c74ef4f2187333e8d3b0e94874e76d` (หลัง PR #279; ไม่มีการเปลี่ยนไฟล์หน้า Admin จากฐาน PR #278)

วิธีตรวจ: ตรวจไฟล์หน้า `page.tsx` ทั้ง 41 เส้นทางของศูนย์จัดการ และสแกน JSX text ใน `features/admin` เพื่อหาอักษรอังกฤษ รหัสสถานะ ข้อความ UAT/SQL/runtime และคำที่ไม่เหมาะกับเจ้าของระบบ จากนั้นแก้ข้อความที่ยืนยันที่มาและความหมายได้ โดยไม่เปลี่ยนตัวเลข ตัวกรอง สิทธิ์ หรือข้อมูลต้นทาง การตรวจโค้ดไม่ยืนยันข้อความที่บริการภายนอกหรือ AI ส่งมาในอนาคต

| หน้า | ไฟล์หน้า | ผลตรวจข้อความคงที่ | ตรวจภาพ |
|---|---|---|---|
| `/analytics/[section]/` | `apps/admin/app/(control-plane)/analytics/[section]/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/analytics/conversions/` | `apps/admin/app/(control-plane)/analytics/conversions/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/analytics/exports/` | `apps/admin/app/(control-plane)/analytics/exports/page.tsx` | แก้ข้อความในหน้านี้หรือส่วนประกอบที่ใช้ร่วมกัน | ยังไม่ได้ยืนยันด้วยภาพ |
| `/analytics/` | `apps/admin/app/(control-plane)/analytics/page.tsx` | แก้ข้อความในหน้านี้หรือส่วนประกอบที่ใช้ร่วมกัน | ยังไม่ได้ยืนยันด้วยภาพ |
| `/analytics/performance/` | `apps/admin/app/(control-plane)/analytics/performance/page.tsx` | แก้ข้อความในหน้านี้หรือส่วนประกอบที่ใช้ร่วมกัน | ยังไม่ได้ยืนยันด้วยภาพ |
| `/analytics/search/` | `apps/admin/app/(control-plane)/analytics/search/page.tsx` | แก้ข้อความในหน้านี้หรือส่วนประกอบที่ใช้ร่วมกัน | ยังไม่ได้ยืนยันด้วยภาพ |
| `/analytics/social/` | `apps/admin/app/(control-plane)/analytics/social/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/analytics/social/post-live/` | `apps/admin/app/(control-plane)/analytics/social/post-live/page.tsx` | แก้ข้อความในหน้านี้หรือส่วนประกอบที่ใช้ร่วมกัน | ยังไม่ได้ยืนยันด้วยภาพ |
| `/content/articles/[id]/` | `apps/admin/app/(control-plane)/content/articles/[id]/page.tsx` | แก้ข้อความในหน้านี้หรือส่วนประกอบที่ใช้ร่วมกัน | ยังไม่ได้ยืนยันด้วยภาพ |
| `/content/articles/` | `apps/admin/app/(control-plane)/content/articles/page.tsx` | แก้ข้อความในหน้านี้หรือส่วนประกอบที่ใช้ร่วมกัน | ยังไม่ได้ยืนยันด้วยภาพ |
| `/content/calendar/` | `apps/admin/app/(control-plane)/content/calendar/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/content/` | `apps/admin/app/(control-plane)/content/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/content/research/` | `apps/admin/app/(control-plane)/content/research/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/dashboard/campaigns/` | `apps/admin/app/(control-plane)/dashboard/campaigns/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/dashboard/inbox/[leadId]/evidence/` | `apps/admin/app/(control-plane)/dashboard/inbox/[leadId]/evidence/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/dashboard/inbox/[leadId]/` | `apps/admin/app/(control-plane)/dashboard/inbox/[leadId]/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/dashboard/inbox/` | `apps/admin/app/(control-plane)/dashboard/inbox/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/dashboard/` | `apps/admin/app/(control-plane)/dashboard/page.tsx` | แก้ข้อความในหน้านี้หรือส่วนประกอบที่ใช้ร่วมกัน | ยังไม่ได้ยืนยันด้วยภาพ |
| `/dashboard/reviews/` | `apps/admin/app/(control-plane)/dashboard/reviews/page.tsx` | แก้ข้อความในหน้านี้หรือส่วนประกอบที่ใช้ร่วมกัน | ยังไม่ได้ยืนยันด้วยภาพ |
| `/operations/[section]/` | `apps/admin/app/(control-plane)/operations/[section]/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/operations/audit-log/` | `apps/admin/app/(control-plane)/operations/audit-log/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/operations/health/` | `apps/admin/app/(control-plane)/operations/health/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/operations/jobs/[jobId]/` | `apps/admin/app/(control-plane)/operations/jobs/[jobId]/page.tsx` | แก้ข้อความในหน้านี้หรือส่วนประกอบที่ใช้ร่วมกัน | ยังไม่ได้ยืนยันด้วยภาพ |
| `/operations/` | `apps/admin/app/(control-plane)/operations/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/operations/privacy/` | `apps/admin/app/(control-plane)/operations/privacy/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/seo/[section]/` | `apps/admin/app/(control-plane)/seo/[section]/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/seo/audits/[id]/` | `apps/admin/app/(control-plane)/seo/audits/[id]/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/seo/audits/` | `apps/admin/app/(control-plane)/seo/audits/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/seo/opportunities/` | `apps/admin/app/(control-plane)/seo/opportunities/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/seo/` | `apps/admin/app/(control-plane)/seo/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/settings/[section]/` | `apps/admin/app/(control-plane)/settings/[section]/page.tsx` | แก้ข้อความในหน้านี้หรือส่วนประกอบที่ใช้ร่วมกัน | ยังไม่ได้ยืนยันด้วยภาพ |
| `/settings/` | `apps/admin/app/(control-plane)/settings/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/social/[section]/` | `apps/admin/app/(control-plane)/social/[section]/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/social/accounts/meta/` | `apps/admin/app/(control-plane)/social/accounts/meta/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/social/accounts/` | `apps/admin/app/(control-plane)/social/accounts/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/social/accounts/tiktok/` | `apps/admin/app/(control-plane)/social/accounts/tiktok/page.tsx` | แก้ข้อความในหน้านี้หรือส่วนประกอบที่ใช้ร่วมกัน | ยังไม่ได้ยืนยันด้วยภาพ |
| `/social/accounts/youtube/` | `apps/admin/app/(control-plane)/social/accounts/youtube/page.tsx` | แก้ข้อความในหน้านี้หรือส่วนประกอบที่ใช้ร่วมกัน | ยังไม่ได้ยืนยันด้วยภาพ |
| `/social/calendar/` | `apps/admin/app/(control-plane)/social/calendar/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/social/` | `apps/admin/app/(control-plane)/social/page.tsx` | แก้ข้อความในหน้านี้หรือส่วนประกอบที่ใช้ร่วมกัน | ยังไม่ได้ยืนยันด้วยภาพ |
| `/social/posts/[id]/` | `apps/admin/app/(control-plane)/social/posts/[id]/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |
| `/social/posts/` | `apps/admin/app/(control-plane)/social/posts/page.tsx` | ตรวจข้อความคงที่ ไม่พบคำผิดที่ยืนยันได้ในรอบนี้ | ยังไม่ได้ยืนยันด้วยภาพ |

## จุดที่แก้

- ผลการตลาด: แปลง `see_source_health` และรหัสอ้างอิง `content:search_clicks:...` เป็นคำอธิบายภาษาไทย; แปลสถานะ หน่วย อันดับ ข้อจำกัดจาก SQL และรายการงาน โดยไม่เปลี่ยนหลักฐานหรือลำดับจริง
- ภาพรวม/ส่งออก/AI รายวัน: ลดคำอย่าง `Prompt`, `raw data`, `SQL`, `Workspace`, `Action Plan`; ข้อมูลตรวจย้อนหลังยังเปิดได้ในส่วนรายละเอียด
- งานอัตโนมัติ/การเชื่อมต่อ: เปลี่ยนคำ `runtime`, `execution`, `workflow`, `UAT` ที่เป็นข้อความหลัก; รหัสสำหรับทีมดูแลอยู่ในส่วนที่ต้องกดเปิด
- หน้าเนื้อหา/SEO/ภาพรวม: แสดงชุดข้อมูล `production` และ `uat` เป็น “ข้อมูลจริง” และ “ข้อมูลทดสอบ”
- หน้าทดลองโซเชียลและ Ubersuggest: แทนคำย่อทางเทคนิคในคำอธิบาย โดยรักษาข้อจำกัดว่าพื้นที่ทดลองไม่ใช่ระบบจริง

## ขอบเขตหลักฐาน

การสแกนนี้เป็น static source review ครบทุกเส้นทาง ไม่ใช่ visual QA ครบทุกหน้า และไม่รับรองการสะกดของข้อความจากผู้ใช้ ต้นทางข้อมูล หรือ AI ที่อาจเปลี่ยนภายหลัง ข้อความเทคนิคในส่วน “ข้อมูลสำหรับทีมดูแลระบบ” ยังมีไว้สำหรับตรวจเหตุขัดข้องและย้อนกลับหลักฐาน

Preview ของ PR #281 ขึ้นสถานะ Ready แต่เมื่อเปิด `/analytics/performance/` จะกลับไปหน้าเข้าสู่ระบบซึ่งแจ้งว่า Google Login/รายชื่อผู้ใช้ของพื้นที่ Preview ยังไม่ตั้งค่า จึงไม่ได้ตรวจภาพของหน้า Admin ที่ต้องเข้าสู่ระบบบน Preview และไม่ถือว่า Preview Ready เป็นหลักฐานว่าข้อความแสดงถูกต้องในหน้าจริง หลัง merge ต้องตรวจ Production ด้วยบัญชี Admin ที่มีสิทธิ์ โดยเริ่มจากหน้า Performance Marketing, ส่งออกไฟล์, งานอัตโนมัติ, การเชื่อมต่อ และหน้าเนื้อหา

## ผลตรวจ Production หลัง PR #281

การตรวจด้วยบัญชี Admin บน `/analytics/performance/` พบข้อมูลจริงบางชนิดยังแสดงรหัสตัวชี้วัด เช่น `search_average_position`, `search_ctr`, `social_reach`, `social_interactions`, `social_shares`, `social_saves` รวมถึงชื่อรายงาน `gsc-daily-query-page` และข้อจำกัดจาก Google เป็นภาษาอังกฤษ จึงเพิ่มคำไทยในชั้นแสดงผลสำหรับตัวชี้วัด ชื่อรายงาน โอกาส และข้อจำกัดที่ระบบเก็บจริง รหัสและข้อความต้นฉบับยังเปิดดูได้ใน “รายละเอียดข้อมูลต้นทาง” เพื่อให้ตรวจย้อนหลังได้ การทดสอบหน้าที่ใช้ข้อมูลจำลองรูปแบบเดียวกับ Production ตรวจว่าเนื้อหาหลักไม่แสดงรหัสเหล่านี้และข้อมูลตรวจย้อนหลังยังอยู่
