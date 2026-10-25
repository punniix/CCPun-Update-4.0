# Supabase สำหรับบันทึกงาน n8n (data split, 25 ต.ค. 2026)

สถานะ: โค้ดฝั่ง Admin และ SQL migration พร้อมแล้ว แต่ยังไม่ได้สร้างโปรเจกต์ Supabase ยังไม่ได้ตั้งค่า env และยังไม่ได้แก้ n8n ระหว่างที่ยังไม่ได้เชื่อม Admin จะแสดง "ยังไม่ได้เชื่อม Supabase" และทำงานต่อได้ตามปกติ

## ข้อมูลอะไรไปอยู่ที่ไหน

| เก็บที่ | ข้อมูล | เหตุผล |
| --- | --- | --- |
| Supabase (ใหม่, Singapore) | บันทึกการรันของ workflow (`ops_workflow_runs` เก็บ 90 วัน, `ops_workflow_run_daily` เก็บตลอด), ข้อมูลดิบรายวัน GA4/GSC/โซเชียล (`ops_raw_daily_pulls`), สถานะรอบ 06:00 (`ops_daily_job_status`) | n8n เขียนถี่ ถ้าเขียนลง Neon จะปลุก compute ทุกครั้งและเพิ่มค่าใช้จ่าย |
| Neon (เดิม) | กล่องข้อความ LINE (เข้ารหัส), แคมเปญ, audit, สรุป analytics รายวันและ report manifest, ห้องวางแผน FA, งาน Local AI, Agent Runtime job ของการส่งออก | เป็นข้อมูลของ Admin หรือข้อมูลอ่อนไหว |

ห้ามเขียนชื่อลูกค้า เบอร์โทร อีเมล LINE ID ข้อความแชต หรือคำตอบเรื่องสุขภาพ/การเงินลง Supabase

หลักความปลอดภัยที่ migration ตั้งให้:

- เปิด RLS ทุกตาราง และมี policy ปฏิเสธ `anon` กับ `authenticated` อย่างชัดเจน
- ถอนสิทธิ์ตารางและ sequence จาก `anon`/`authenticated` ทั้งหมด ใช้ได้เฉพาะ `service_role`
- ฟังก์ชันลบข้อมูลเก่า `ops_apply_run_log_retention()` เรียกได้เฉพาะ `service_role` และ migration ไม่ได้รันหรือตั้งเวลาให้
- ตาราง `ops_lane_identity` ระบุว่าโปรเจกต์นี้เป็นของ UAT หรือ Production ถ้าไม่ตรงกับ Admin ที่เรียก ระบบจะหยุดอ่าน (fail closed)

## ขั้นที่ 1: สร้างโปรเจกต์ Supabase

สร้าง 2 โปรเจกต์ (แผน Free ได้ทั้งคู่) เพื่อแยก UAT กับ Production เหมือน Sanity และ Neon:

1. เข้า supabase.com → New project
2. ชื่อ `ccpun-ops-uat` (สำหรับ admin-test.ccpun.com) และ `ccpun-ops-production` (สำหรับ admin.ccpun.com)
3. Region: **Southeast Asia (Singapore)**
4. ตั้งรหัสผ่านฐานข้อมูลที่สุ่มยาว เก็บในตัวจัดการรหัสผ่าน ไม่ต้องส่งให้ใคร
5. ใน Project Settings → Data API ไม่ต้องเพิ่ม schema อื่น (ตารางอยู่ใน `public`)

## ขั้นที่ 2: รัน migration (ทำในแต่ละโปรเจกต์)

เปิด SQL Editor ของโปรเจกต์ แล้วรันไฟล์ตามลำดับนี้ทีละไฟล์:

1. `db/supabase/migrations/20261025000100_ops_telemetry_foundation.sql`
2. `db/supabase/migrations/20261025000200_ops_run_log_retention.sql`
3. ไฟล์ lane **ไฟล์เดียว** ให้ตรงกับโปรเจกต์:
   - โปรเจกต์ UAT: `db/supabase/lane/admin-uat.sql`
   - โปรเจกต์ Production: `db/supabase/lane/production-admin.sql`
4. ตรวจผลด้วย `db/supabase/readback/ops_telemetry_readback.sql`: ทุกตารางต้องเป็น `rls_enabled = true`, `client_role_grants = 0`, `deny_policies = 1`, `anon`/`authenticated` ต้อง `can_execute = false` และ lane ต้องตรงกับโปรเจกต์

ไฟล์ migration รันซ้ำได้โดยไม่เสียหาย ถ้ารันไฟล์ lane ผิดโปรเจกต์ จะ error (`division by zero`) และไม่เปลี่ยนค่า lane เดิม

ถ้าใช้ Supabase CLI แทน SQL Editor ให้ใช้เฉพาะโฟลเดอร์ `db/supabase/migrations/` แล้วรันไฟล์ lane แยกเอง

## ขั้นที่ 3: ตั้งค่า env ของ Admin บน Hostinger

ดูค่าใน Project Settings → API ของแต่ละโปรเจกต์: **Project URL** และ **service_role key** (ห้ามใช้ anon key)

| แอป Hostinger | ตัวแปร | ค่า |
| --- | --- | --- |
| admin-test.ccpun.com | `CCPUN_SUPABASE_URL` | Project URL ของ `ccpun-ops-uat` เช่น `https://xxxx.supabase.co` |
| admin-test.ccpun.com | `CCPUN_SUPABASE_SERVICE_ROLE_KEY` | service_role key ของ `ccpun-ops-uat` |
| admin.ccpun.com | `CCPUN_SUPABASE_URL` | Project URL ของ `ccpun-ops-production` |
| admin.ccpun.com | `CCPUN_SUPABASE_SERVICE_ROLE_KEY` | service_role key ของ `ccpun-ops-production` |

ข้อควรระวัง:

- เพิ่มผ่าน hPanel → Node.js app → Environment variables ทีละตัว อย่าลบตัวแปรเดิม (การแทนที่ทั้งชุดผ่าน API จะลบตัวแปรอื่นด้วย)
- ห้ามตั้งชื่อขึ้นต้นด้วย `NEXT_PUBLIC_` และห้าม commit ลง Git
- URL ต้องเป็น `https://` และไม่มี path ต่อท้าย ถ้าไม่ถูกต้อง Admin จะถือว่ายังไม่ได้เชื่อม
- หลังเพิ่มให้ build/restart แอปใหม่ แล้วเปิด **สถานะระบบ** → การ์ด "บันทึกงาน n8n และรอบ 06:00" ต้องขึ้น "เชื่อม Supabase แล้ว" และหน้า **ภาพรวม** การ์ด "รอบเก็บข้อมูล 06:00" ต้องไม่ขึ้น "ยังไม่ได้เชื่อม Supabase"
- ถ้าขึ้น "Supabase ไม่ตรงกับระบบนี้" แปลว่าใส่ key ของอีก lane หรือรันไฟล์ lane ผิด

## ขั้นที่ 4 (ไม่บังคับ): อีเมลแจ้งเมื่อรอบ 06:00 ไม่สำเร็จ

ใน repo ยังไม่มีผู้ให้บริการอีเมล (ไม่มี Resend, SendGrid, SMTP, nodemailer หรือ mail relay ของ n8n ที่ Admin เรียกได้) ระบบจึงสร้างตัวแจ้งเตือนกลางที่ **ปิดอีเมลไว้เป็นค่าเริ่มต้น** ป้ายเตือนใน Admin ใช้ได้ทันทีโดยไม่ต้องตั้งค่า

เปิดอีเมลได้ด้วย webhook relay ที่ปั้นสร้างเองใน n8n:

1. สร้าง workflow ใหม่ใน n8n: Webhook (POST) → Code ตรวจลายเซ็น → Gmail หรือ Send Email (SMTP)
   - ลายเซ็น: `X-CCPun-Signature = "sha256=" + HMAC_SHA256(secret, X-CCPun-Timestamp + "." + rawBody)` ให้ปฏิเสธถ้าไม่ตรงหรือ timestamp เก่ากว่า 5 นาที
   - body มี `to`, `subject`, `text`, `kind`, `reference` (ใช้ `reference` กันส่งซ้ำ)
2. ตั้ง env ใน Admin ของ lane นั้น:
   - `CCPUN_ALERT_EMAIL_PROVIDER=webhook`
   - `CCPUN_ALERT_EMAIL_WEBHOOK_URL=https://…/webhook/…` (ต้องเป็น https)
   - `CCPUN_ALERT_EMAIL_WEBHOOK_SECRET=<สุ่มอย่างน้อย 32 ตัวอักษร ใช้ค่าเดียวกับใน n8n>`
   - `CCPUN_ALERT_EMAIL_TO=<อีเมลของปั้น>`
3. อีเมลต้องใช้ Supabase ด้วย เพราะระบบจองสิทธิ์ส่งครั้งเดียวต่อหนึ่งรอบไว้ที่ `ops_daily_job_status.alert_sent_at` ถ้าส่งไม่สำเร็จจะคืนสิทธิ์ให้ลองใหม่

ข้อจำกัดที่ต้องรู้: Admin ส่งอีเมลเมื่อมีการเปิดหน้าใดก็ได้ใน Admin ครั้งแรกหลังรอบล้มเหลว (ไม่มี timer ใน Admin ตามนโยบาย Cloud Admin) ถ้าต้องการอีเมลทันทีโดยไม่ต้องเปิด Admin ให้ทำเป็นงานแยก: เพิ่ม internal endpoint ที่ n8n เรียกได้ (ต้องแก้ allowlist ใน `lib/admin/host-routing.ts` ซึ่งถูก seal ไว้และต้องผ่านการรีวิวแยก) หรือให้ n8n ส่งอีเมลจาก error branch เอง

## ขั้นที่ 5: เพิ่ม credential ใน n8n

สร้าง credential ประเภท **Supabase API** สองตัว (หรือหนึ่งตัวต่อ lane ที่ n8n นั้นใช้):

- ชื่อ `CCPun Ops Supabase (Production)` → Host = Project URL ของ `ccpun-ops-production`, Service Role Secret = service_role key
- ชื่อ `CCPun Ops Supabase (UAT)` → ของ `ccpun-ops-uat`

ถ้าจะใช้ Postgres node แทน ให้ใช้ connection string แบบ Session pooler (port 5432, SSL required) ของโปรเจกต์นั้น และใช้ user ที่ Supabase ให้ ไม่ต้องสร้าง role ใหม่

ตอนนี้ n8n ไม่ได้เชื่อม Neon โดยตรง ทุกการเขียนลง Neon ผ่าน Admin internal API ดังนั้น "ย้ายการเขียน" หมายถึงให้ n8n เขียนข้อมูลถี่ลง Supabase เอง แทนที่จะส่งให้ Admin เก็บใน Neon

## ขั้นที่ 6: workflow ที่ต้องเปลี่ยนการเขียน

รายการนี้มาจาก `lib/admin/n8n-integration-registry.ts` และ snapshot ใน `workers/local-ai/n8n/` สถานะ ณ 25 ต.ค. 2026 ห้ามแก้ n8n จาก repo นี้ ให้ปั้นหรือผู้ได้รับอนุญาตทำใน n8n UI บน UAT ก่อน

### ต้องเปลี่ยน

| Workflow (ID) | Node ที่เกี่ยวข้อง | วันนี้เขียนไปที่ | เปลี่ยนเป็น |
| --- | --- | --- | --- |
| CCPun — Owner Export to Google Sheets (`XOQHPkio5WzZIz0l`) ราก "Daily · เก็บข้อมูล 06:00" และ "Daily · รันทันที (กดเอง)" | เพิ่ม Supabase node ต่อจาก trigger ทั้งสอง | ไม่มีตารางสถานะรอบ (Admin อนุมานจาก `ccpun_admin.analytics_daily_batch` ใน Neon ทีละแหล่ง) | **Insert** `ops_daily_job_status`: `job_key='daily-0600'`, `run_date`=วันที่เวลาไทย, `execution_id={{$execution.id}}`, `trigger`=`schedule` หรือ `manual`, `status='running'` |
| เดียวกัน | ต่อจาก "Daily · ตรวจผลครบทุกต้นทาง" | ไม่มี | **Update** แถวเดิม (match `job_key`+`execution_id`): `status`=`succeeded`/`partial`/`failed`, `failed_steps` เช่น `{gsc,meta}`, `error_category`, `finished_at`, `updated_at` และต่อ error branch ของทุก node ใน Daily ให้ตั้ง `failed` ด้วย |
| เดียวกัน | "Daily · GSC", "Daily · GA4", "Daily · META", "Daily · UBERSUGGEST", "Daily · ประเมินด้วย VPS AI", "Marketing Daily · …", "Marketing AI Weekly/Monthly · …" | บันทึกรายขั้นอยู่แค่ใน execution history ของ n8n | **Insert** `ops_workflow_runs` หนึ่งแถวต่อขั้น (`workflow_id`, `workflow_name`, `execution_id`, `step`, `status`, `started_at`, `finished_at`, `duration_ms`, `error_category`) ห้ามใส่ข้อมูลลูกค้าใน `detail` |
| เดียวกัน | "Daily · META", "Daily · UBERSUGGEST" | Admin เก็บข้อมูลดิบจากผู้ให้บริการลง Neon `ccpun_admin.analytics_raw_page` | **Insert** `ops_raw_daily_pulls` (`source`, `report`, `pull_date`, `execution_id`, `page`, `payload`, `row_count`, `payload_sha256`) |
| CCPun — Google read-only relay (`pcDVd2P6ipg8b6p4`, เรียกจาก workflow ข้างบน) | ต่อจาก "Relay · รวมคำตอบ" | คำตอบดิบ GSC/GA4 ถูกส่งต่อให้ Admin เก็บลง Neon `analytics_raw_page` | **Insert** `ops_raw_daily_pulls` (`source`=`gsc` หรือ `ga4`) |

หมายเหตุ: Admin ยังเก็บสรุป analytics รายวันและ report manifest ใน Neon ตามเดิม การหยุดเก็บข้อมูลดิบซ้ำใน Neon `analytics_raw_page` ต้องทำเป็น PR แยกหลังจากเห็นว่า Supabase ได้ข้อมูลครบอย่างน้อย 7 วัน

### ไม่บังคับ (เพิ่มบันทึกการรันได้ แต่ไม่ได้ย้ายออกจาก Neon)

| Workflow (ID) | หมายเหตุ |
| --- | --- |
| CCPun — Local AI — Operations Monitor (`meJeEg1WOdY7aEPx`) | อ่านจาก Admin เท่านั้น เพิ่มแถว `ops_workflow_runs` ต่อรอบได้ |
| CCPun — Local AI — LINE Card Copy (`NeHFrMsfXcdnVxjU`) | ผลการรันอยู่ใน n8n Data Table "CCPun LINE Copy Runs" ซึ่งใช้กัน replay อย่าย้าย ถ้าต้องการให้เพิ่มแถว `ops_workflow_runs` แบบไม่มีข้อความ LINE |

### ห้ามย้ายมา Supabase

| Workflow (ID) | เหตุผล |
| --- | --- |
| CCPun — Private Chat Screenshot OCR (`IBgbhEGfzCcvGFy2`) | ข้อความแชตลูกค้า ต้องอยู่ใน Neon แบบเข้ารหัส |
| CCPun — Contact Form to Sheets + Email (`F1SCT95FfMwLBD43`), FHC Lead Capture — CCPun (`IyJfaqUVF6KbnYfy`) | ข้อมูลผู้ติดต่อ (lead) |
| ราก "Admin · Export Google Sheet" ใน `XOQHPkio5WzZIz0l` (Runtime · เริ่มงาน/เสร็จแล้ว) | Agent Runtime job เป็นบันทึกงานที่ปั้นสั่งจาก Admin อยู่ใน Neon ต่อ |

## การลบบันทึกการรันเก่า (A5)

`public.ops_apply_run_log_retention(p_now, p_keep_days default 90)` สรุปรายวันลง `ops_workflow_run_daily` (เก็บตลอด) แล้วลบแถวรายละเอียดที่เก่ากว่า 90 วัน รันซ้ำได้ผลเท่าเดิม ไม่ยอมให้ตั้งต่ำกว่า 90 วัน ตอนนี้ **ยังไม่ได้ตั้งเวลาและห้ามรันบน Production** จนกว่าจะอนุมัติแยก ทางเลือกเมื่ออนุมัติ: ให้ n8n เรียก RPC วันละครั้ง หรือเปิด pg_cron ในโปรเจกต์นั้น

ข้อมูลดิบ (`ops_raw_daily_pulls`) ยังไม่มีนโยบายลบ แผน Free มีพื้นที่ 500 MB ควรตัดสินใจระยะเก็บภายใน 1–2 เดือนหลังเริ่มใช้

## ย้อนกลับ

- ลบ env `CCPUN_SUPABASE_*` ออกจาก Hostinger แล้ว restart: Admin กลับไปแสดง "ยังไม่ได้เชื่อม Supabase" และป้ายรอบ 06:00 บนรายงานเช้าใช้สถานะจาก Neon แทน
- ปิด Supabase node ใน n8n: การเก็บข้อมูลผ่าน Admin → Neon ยังทำงานเหมือนเดิม เพราะขั้นนี้เป็นการเขียนเพิ่ม ไม่ได้ตัดเส้นทางเดิม
