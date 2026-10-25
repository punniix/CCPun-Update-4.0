import Link from "next/link";
import { notFound } from "next/navigation";
import { getFinancialPlanningStatus } from "../../../lib/admin/financial-planning/config";
import { FA_DATABASE_ENV_KEY } from "../../../lib/admin/financial-planning/config";
import { FA_CRYPTO_ENV_KEYS } from "../../../lib/admin/financial-planning/crypto";
import { householdIdSchema } from "../../../lib/admin/financial-planning/contracts";
import { requireFinancialPlanningOwner } from "../../../lib/admin/financial-planning/require-owner";
import { bangkokToday, FA_RETENTION_YEARS_AFTER_CLIENT } from "../../../lib/admin/financial-planning/retention";
import {
  FaStoreError,
  listCrmNotes,
  listHouseholds,
  listPurgeCandidates,
  readHouseholdPlan,
  type FaCrmNoteRecord,
  type FaHouseholdListItem,
  type FaHouseholdPlan,
} from "../../../lib/admin/financial-planning/store";
import { ClientStatusControl } from "./ClientStatusControl";
import { CrmNotesPanel } from "./CrmNotesPanel";
import { FinancialPositionEditor } from "./FinancialPositionEditor";
import { formatThaiDate } from "./format";
import styles from "./FinancialPlanning.module.css";
import { HouseholdCreateForm } from "./HouseholdCreateForm";
import { FA_CLIENT_STATUS_LABELS } from "./presentation";

function PageHeading({ title, lead }: { title: string; lead: string }) {
  return (
    <>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ห้องวางแผนการเงิน · เห็นเฉพาะเจ้าของระบบ</p>
      <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">{lead}</p>
    </>
  );
}

function NotConfigured() {
  const status = getFinancialPlanningStatus();
  return (
    <section className="mt-6 rounded-2xl border border-amber-200/15 bg-amber-200/[0.05] p-5 text-sm leading-6 text-amber-50/80">
      <h2 className="font-semibold text-amber-50">ห้องวางแผนยังไม่พร้อมใช้งาน</h2>
      <p className="mt-1">ต้องตั้งค่าฐานข้อมูลแยกและกุญแจเข้ารหัสก่อน หน้านี้ไม่แสดงค่าใดๆ ของตัวแปรเหล่านี้</p>
      <ul className="mt-2 list-disc pl-5">
        <li>{FA_DATABASE_ENV_KEY}: {status.database === "ready" ? "พร้อม" : status.database === "shared-with-admin" ? "ห้ามใช้ฐานข้อมูลเดียวกับ Admin หลัก" : "ยังไม่พร้อม"}</li>
        <li>{FA_CRYPTO_ENV_KEYS.join(", ")}: {status.cryptoReady ? "พร้อม" : "ยังไม่พร้อม"}</li>
      </ul>
    </section>
  );
}

function StoreUnavailable() {
  return (
    <p role="alert" className={`${styles.alertBanner} mt-6 rounded-2xl p-4 text-sm`}>
      ตอนนี้ยังเปิดข้อมูลห้องวางแผนไม่ได้ ลองโหลดหน้าใหม่อีกครั้ง
    </p>
  );
}

function HouseholdTable({ households, emptyText }: { households: FaHouseholdListItem[]; emptyText: string }) {
  if (!households.length) return <p className="mt-4 text-sm text-white/45">{emptyText}</p>;
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-white/[0.04] text-xs text-white/55">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">ครอบครัว</th>
            <th scope="col" className="px-4 py-3 font-medium">สถานะ</th>
            <th scope="col" className="px-4 py-3 font-medium">เก็บข้อมูลถึง</th>
            <th scope="col" className="px-4 py-3 font-medium">แก้ไขล่าสุด</th>
          </tr>
        </thead>
        <tbody>
          {households.map((household) => (
            <tr key={household.id} className="border-t border-white/10">
              <td className="px-4 py-3">
                <Link href={`/dashboard/planning/${household.id}/`} className="inline-flex min-h-11 items-center font-medium text-white underline decoration-white/25 underline-offset-4 hover:text-[#f4df9b]">
                  {household.displayName ?? "ถอดรหัสชื่อไม่ได้"}
                </Link>
              </td>
              <td className="px-4 py-3 text-white/70">{FA_CLIENT_STATUS_LABELS[household.clientStatus]}</td>
              <td className="px-4 py-3 text-white/70">{household.retentionUntil ? formatThaiDate(household.retentionUntil) : "ตลอดที่เป็นลูกค้า"}</td>
              <td className="px-4 py-3 text-white/70">{formatThaiDate(household.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function PlanningHouseholdsPage() {
  await requireFinancialPlanningOwner();
  const ready = getFinancialPlanningStatus().ready;
  let households: FaHouseholdListItem[] | null = null;
  let purgeCount = 0;
  if (ready) {
    try {
      const today = bangkokToday();
      [households, purgeCount] = await Promise.all([
        listHouseholds(),
        listPurgeCandidates(today).then((rows) => rows.length),
      ]);
    } catch {
      households = null;
    }
  }

  return (
    <div>
      <PageHeading
        title="วางแผนการเงิน"
        lead="กรอกรายได้ รายจ่าย สินทรัพย์ และหนี้สินของลูกค้า แล้วดูความมั่งคั่งสุทธิกับอัตราส่วนการเงินทันที ข้อมูลทุกช่องเข้ารหัสก่อนบันทึก และไม่ส่งไปที่ระบบวิเคราะห์หรือ AI ภายนอก"
      />
      {!ready ? <NotConfigured /> : households === null ? <StoreUnavailable /> : (
        <>
          <div className="mt-7"><HouseholdCreateForm /></div>
          <section className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">ครอบครัวลูกค้า</h2>
              <Link href="/dashboard/planning/retention/" className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm text-white/80 hover:bg-white/[0.05]">
                ข้อมูลที่ครบกำหนดตรวจ ({purgeCount.toLocaleString("th-TH")})
              </Link>
            </div>
            <HouseholdTable households={households} emptyText="ยังไม่มีครอบครัวในห้องวางแผน" />
          </section>
        </>
      )}
    </div>
  );
}

export async function PlanningHouseholdPage({ householdId }: { householdId: string }) {
  await requireFinancialPlanningOwner();
  const parsedId = householdIdSchema.safeParse(householdId);
  if (!parsedId.success) notFound();
  if (!getFinancialPlanningStatus().ready) {
    return <div><PageHeading title="สถานะการเงิน" lead="ห้องวางแผนยังไม่พร้อมใช้งาน" /><NotConfigured /></div>;
  }

  let plan: FaHouseholdPlan;
  let notes: FaCrmNoteRecord[];
  try {
    [plan, notes] = await Promise.all([readHouseholdPlan(parsedId.data), listCrmNotes(parsedId.data)]);
  } catch (error) {
    if (error instanceof FaStoreError && error.code === "FA_NOT_FOUND") notFound();
    return <div><PageHeading title="สถานะการเงิน" lead="ตอนนี้ยังเปิดข้อมูลครอบครัวนี้ไม่ได้" /><StoreUnavailable /></div>;
  }

  return (
    <div>
      <Link href="/dashboard/planning/" className="inline-flex min-h-11 items-center text-sm text-white/60 hover:text-white">← ครอบครัวลูกค้าทั้งหมด</Link>
      <PageHeading
        title={`สถานะการเงิน · ${plan.profile.displayName}`}
        lead="กรอกเป็นยอดต่อเดือนหรือต่อปี ใส่ตัวเลขมีจุลภาคได้ ช่องที่เว้นว่างจะไม่ถูกนับเป็นศูนย์ ตัวเลขด้านขวาคำนวณให้ทันทีและยังไม่ใช่คำแนะนำจนกว่าปั้นจะตรวจทาน"
      />
      <div className="mt-6">
        <FinancialPositionEditor
          householdId={plan.id}
          initialRevision={plan.revision}
          initialProfile={plan.profile}
          initialPosition={plan.position}
          unreadableItems={plan.unreadableItems}
          notes={<CrmNotesPanel householdId={plan.id} notes={notes} />}
        />
      </div>
      <div className="mt-6 max-w-3xl">
        <ClientStatusControl
          householdId={plan.id}
          clientStatus={plan.clientStatus}
          relationshipEndedOn={plan.relationshipEndedOn}
          retentionUntil={plan.retentionUntil}
          today={bangkokToday()}
        />
      </div>
    </div>
  );
}

export async function PlanningRetentionPage() {
  await requireFinancialPlanningOwner();
  const ready = getFinancialPlanningStatus().ready;
  let candidates: FaHouseholdListItem[] | null = null;
  if (ready) {
    try { candidates = await listPurgeCandidates(bangkokToday()); } catch { candidates = null; }
  }
  return (
    <div>
      <Link href="/dashboard/planning/" className="inline-flex min-h-11 items-center text-sm text-white/60 hover:text-white">← ครอบครัวลูกค้าทั้งหมด</Link>
      <PageHeading
        title="ข้อมูลที่ครบกำหนดตรวจ"
        lead={`รายการครอบครัวที่เลิกเป็นลูกค้าเกิน ${FA_RETENTION_YEARS_AFTER_CLIENT} ปีแล้ว ใช้ตัดสินใจว่าจะลบหรือเก็บต่อ ระบบไม่ลบข้อมูลเองและหน้านี้ไม่มีปุ่มลบ`}
      />
      {!ready ? <NotConfigured /> : candidates === null ? <StoreUnavailable /> : (
        <HouseholdTable households={candidates} emptyText="ยังไม่มีครอบครัวที่ครบกำหนดตรวจ" />
      )}
    </div>
  );
}
