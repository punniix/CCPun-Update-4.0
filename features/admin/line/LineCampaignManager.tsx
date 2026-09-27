"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { lineCampaignStatusLabel, lineJourneyLabel } from "@/lib/admin/line/presentation";

type Campaign = {
  campaignId: string;
  campaignCode: string;
  title: string;
  status: string;
  copyText: string;
  recipientCount: number;
  queuedCount: number;
  sentCount: number;
  failedCount: number;
  reconciliationCount: number;
  segment: Record<string, unknown>;
};

const JOURNEY_OPTIONS = [
  ["", "ลูกค้าทุกกลุ่ม"],
  ["motor_quote_review", "ประกันรถ"],
  ["life_health_policy_review", "ประกันชีวิต / สุขภาพ"],
  ["investment_before_you_act", "การลงทุน"],
] as const;

export function LineCampaignManager({
  campaigns,
  providerSendEnabled,
}: {
  campaigns: Campaign[];
  providerSendEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function post(path: string, body?: unknown) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({})) as { queuedCount?: number };
      if (!response.ok) throw new Error("request_failed");

      setMessage(
        payload.queuedCount != null
          ? "เตรียมรายชื่อผู้รับแล้ว " + payload.queuedCount.toLocaleString("th-TH") + " คน · ยังไม่ได้ส่ง"
          : "บันทึกแล้ว",
      );
      router.refresh();
    } catch {
      setMessage("ยังดำเนินการไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-lg font-semibold">เตรียมข้อความใหม่</h2>
        <p className="mt-1 text-xs leading-5 text-white/50">
          เลือกกลุ่มลูกค้า เขียนข้อความ แล้วบันทึกไว้ตรวจอีกครั้งก่อนส่ง
        </p>

        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const journey = String(form.get("journey") ?? "").trim();
            const recency = String(form.get("recency_bucket") ?? "").trim();
            const segment: Record<string, unknown> = {};
            if (journey) segment.journey = journey;
            if (recency) segment.recency_bucket = recency;

            void post("/api/admin/line/campaigns/", {
              campaignCode: "campaign_" + Date.now(),
              title: String(form.get("title") ?? "").trim(),
              journey: journey || undefined,
              copyText: String(form.get("copy") ?? "").trim(),
              segment,
            });
          }}
        >
          <label className="text-xs text-white/55">
            ชื่อรายการ
            <input
              required
              name="title"
              maxLength={160}
              placeholder="เช่น เตือนต่อประกันรถเดือนหน้า"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white"
            />
          </label>

          <label className="text-xs text-white/55">
            ส่งให้ลูกค้ากลุ่มไหน
            <select
              name="journey"
              defaultValue=""
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white"
            >
              {JOURNEY_OPTIONS.map(([value, label]) => (
                <option key={value || "all"} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="text-xs text-white/55">
            ลูกค้าที่คุยกันล่าสุดเมื่อไร
            <select
              name="recency_bucket"
              defaultValue=""
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white"
            >
              <option value="">ไม่จำกัดช่วงเวลา</option>
              <option value="day">ภายใน 1 วัน</option>
              <option value="week">ภายใน 7 วัน</option>
              <option value="month">ภายใน 30 วัน</option>
            </select>
          </label>

          <label className="md:col-span-2 text-xs text-white/55">
            ข้อความที่จะส่ง
            <textarea
              required
              name="copy"
              maxLength={2000}
              rows={4}
              placeholder="เขียนข้อความที่ต้องการให้ลูกค้าเห็น"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white"
            />
          </label>

          <button
            disabled={busy}
            className="min-h-11 rounded-xl bg-white px-4 text-sm font-medium text-black disabled:opacity-40"
          >
            {busy ? "กำลังบันทึก…" : "บันทึกไว้ก่อน"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {campaigns.length === 0 ? (
          <div className="rounded-2xl border border-white/10 p-5 text-sm text-white/55">
            ยังไม่มีข้อความที่เตรียมไว้
          </div>
        ) : (
          campaigns.map((campaign) => {
            const journey = typeof campaign.segment.journey === "string" ? campaign.segment.journey : null;
            return (
              <article
                key={campaign.campaignId}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-[#e0c985]">
                      {lineCampaignStatusLabel(campaign.status)}
                      {journey ? " · " + lineJourneyLabel(journey) : " · ลูกค้าทุกกลุ่ม"}
                    </p>
                    <h3 className="mt-1 font-semibold">{campaign.title}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">
                      {campaign.copyText}
                    </p>
                  </div>

                  <div className="shrink-0 text-xs leading-5 text-white/55 md:text-right">
                    <p>ผู้รับ {campaign.recipientCount.toLocaleString("th-TH")} คน</p>
                    <p>
                      เตรียมไว้ {campaign.queuedCount.toLocaleString("th-TH")} · ส่งแล้ว{" "}
                      {campaign.sentCount.toLocaleString("th-TH")}
                    </p>
                    {campaign.failedCount > 0 ? (
                      <p className="text-amber-200">
                        ส่งยังไม่สำเร็จ {campaign.failedCount.toLocaleString("th-TH")}
                      </p>
                    ) : null}
                    {campaign.reconciliationCount > 0 ? (
                      <p className="text-amber-200">
                        ต้องเช็กสถานะ {campaign.reconciliationCount.toLocaleString("th-TH")}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {campaign.status === "draft" ? (
                    <button
                      disabled={busy}
                      onClick={() => void post(
                        "/api/admin/line/campaigns/" + campaign.campaignId + "/approve/",
                      )}
                      className="min-h-10 rounded-xl border border-white/10 px-3 text-sm text-white/75"
                    >
                      ตรวจแล้ว ใช้ข้อความนี้
                    </button>
                  ) : null}

                  {campaign.status === "approved" ? (
                    <button
                      disabled={busy}
                      onClick={() => void post(
                        "/api/admin/line/campaigns/" + campaign.campaignId + "/enqueue/",
                      )}
                      className="min-h-10 rounded-xl border border-[#e0c985]/25 bg-[#e0c985]/10 px-3 text-sm text-[#f4df9b]"
                    >
                      เตรียมรายชื่อผู้รับ
                    </button>
                  ) : null}
                </div>

                <details className="mt-4 text-xs text-white/35">
                  <summary className="cursor-pointer">รายละเอียดระบบ</summary>
                  <p className="mt-2">รหัสภายใน: {campaign.campaignCode}</p>
                </details>
              </article>
            );
          })
        )}
      </section>

      <section className="rounded-2xl border border-sky-200/15 bg-sky-200/[0.05] p-4 text-sm text-sky-100/80">
        <strong>
          การส่งข้อความจริง: {providerSendEnabled ? "พร้อมใช้งาน" : "ยังปิดอยู่"}
        </strong>
        <p className="mt-1 text-xs leading-5">
          การบันทึก ตรวจข้อความ หรือเตรียมรายชื่อผู้รับ ยังไม่ใช่การส่งข้อความจริง
        </p>
      </section>

      {message ? <p role="status" className="text-sm text-white/60">{message}</p> : null}
    </div>
  );
}
