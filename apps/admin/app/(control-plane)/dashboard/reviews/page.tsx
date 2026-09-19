import type { Metadata } from "next";
import Link from "next/link";
import ApproveSuggestionButton from "@/features/admin/components/ApproveSuggestionButton";
import ApplySuggestionButton from "@/features/admin/components/ApplySuggestionButton";
import ReviewDecisionControls from "@/features/admin/components/ReviewDecisionControls";
import { connectionLabel, proposalStatusLabel, proposalTypeLabel, riskLabel } from "@/lib/admin/presentation";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { listSeoSuggestions } from "@/lib/admin/sanity-control";
import { getApplyableFieldPath, isStaleSuggestionRevision } from "@/lib/admin/suggestion-lifecycle";
import { isStudioDataPlaneAllowed } from "@/lib/admin/environment";

export const metadata: Metadata = { title: "ข้อเสนอที่รอตรวจ" };

function percent(value: number | null | undefined) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

export default async function AdminReviewsPage() {
  const identity = await requireAdminPermission("reviews:read");
  const result = await listSeoSuggestions();
  const studioReady = isStudioDataPlaneAllowed(result.status.dataset ?? undefined);

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">คุณเป็นผู้ตัดสินใจ</p>
          <h1 className="mt-2 text-3xl font-semibold">ข้อเสนอที่รอตรวจ</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
            ระบบสร้างได้เพียงข้อเสนอ คุณต้องตรวจและอนุมัติด้วยตัวเอง การอนุมัติยังไม่แก้ฉบับร่าง และไม่มีขั้นตอนไหนเผยแพร่บทความให้เอง
          </p>
        </div>
        <Link href="/content/articles/" className="w-fit rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5 hover:text-white">
          กลับไปเลือกบทความ
        </Link>
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-white/60">ชุดข้อมูล</div>
          <div className="mt-2 text-lg font-semibold">{result.status.dataset ?? "—"}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-white/60">ข้อเสนอที่รอตรวจ</div>
          <div className="mt-2 text-lg font-semibold">{result.rows.filter((row) => row.status === "needs-human-review" && !isStaleSuggestionRevision(row.targetRevision, row.targetCurrentRevision)).length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-white/60">การบันทึกฉบับร่าง</div>
          <div className="mt-2 text-lg font-semibold">{connectionLabel(result.status.writeReady, "write", result.status.environment)}</div>
        </div>
      </section>

      {result.error ? (
        <section className="mt-6 rounded-3xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm leading-6 text-amber-50">
          <h2 className="font-semibold">ยังอ่านข้อเสนอไม่ได้</h2>
          <p className="mt-2 text-amber-50/80">
            ระบบหยุดการอ่านและบันทึกไว้เพื่อความปลอดภัย และจะไม่สลับโครงการหรือชุดข้อมูลให้เอง
          </p>
        </section>
      ) : null}

      {!result.error && result.rows.length === 0 ? (
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-7 text-center">
          <h2 className="text-lg font-semibold">ยังไม่มีข้อเสนอที่รอตรวจ</h2>
          <p className="mt-2 text-sm text-white/65">เมื่อตรวจ SEO และสร้างข้อเสนอแล้ว รายการจะปรากฏที่หน้านี้</p>
        </section>
      ) : null}

      <section className="mt-6 space-y-4">
        {result.rows.map((item) => {
          const usesFrozenApproval = item.status === "approved" || item.status === "applied";
          const effectiveRiskLevel = usesFrozenApproval ? item.approvedRiskLevel : item.riskLevel;
          const effectiveType = usesFrozenApproval ? item.approvedType : item.type;
          const effectiveAfter = usesFrozenApproval ? item.approvedAfter : item.after;
          const isPendingStale = item.status === "needs-human-review" && isStaleSuggestionRevision(item.targetRevision, item.targetCurrentRevision);
          const isApprovedStale = item.status === "approved" && isStaleSuggestionRevision(item.approvedTargetRevision, item.targetCurrentRevision);
          const isStale = isPendingStale || isApprovedStale;
          const articleId = (usesFrozenApproval ? item.approvedTargetId : item.articleId)?.replace(/^drafts\./, "");
          const seoHref = articleId ? `/seo/audits/${encodeURIComponent(articleId)}/` : "/seo/";
          const canApprove = hasAdminPermission(identity.role, "reviews:approve") && result.status.writeReady && item.status === "needs-human-review" && !isStale;
          const canEdit = hasAdminPermission(identity.role, "reviews:edit") && result.status.writeReady && item.status === "needs-human-review" && !isStale;
          const canReject = hasAdminPermission(identity.role, "reviews:reject") && result.status.writeReady && item.status === "needs-human-review" && !isStale;
          const canApply = hasAdminPermission(identity.role, "draft:apply") && result.status.writeReady && item.status === "approved" && !isApprovedStale && Boolean(effectiveType && getApplyableFieldPath(effectiveType)) && effectiveRiskLevel !== "high" && effectiveRiskLevel !== "critical";
          const approveDisabledReason = isStale
            ? "ข้อเสนอนี้อ้างอิงฉบับร่างรุ่นเก่า กรุณาสร้างข้อเสนอใหม่จากหน้า ตรวจ SEO"
              : !hasAdminPermission(identity.role, "reviews:approve")
              ? "บัญชีนี้ไม่มีสิทธิ์อนุมัติข้อเสนอ"
              : !result.status.writeReady
                ? "การบันทึกฉบับร่างยังไม่พร้อม"
                : null;
          const applyDisabledReason = effectiveRiskLevel === "high" || effectiveRiskLevel === "critical"
            ? "ความเสี่ยงระดับนี้ต้องตรวจและแก้ด้วยตนเองใน Studio"
            : !effectiveType || !getApplyableFieldPath(effectiveType)
              ? "ข้อเสนอประเภทนี้ต้องตรวจและแก้ด้วยตนเองใน Studio"
            : !hasAdminPermission(identity.role, "draft:apply")
              ? "บัญชีนี้ไม่มีสิทธิ์นำข้อเสนอไปใช้กับฉบับร่าง"
              : !result.status.writeReady
                ? "การบันทึกฉบับร่างยังไม่พร้อม"
                : null;
          const studioPreviewHref = articleId ? `/studio/structure/article;${encodeURIComponent(articleId)}` : null;
          return (
            <article key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-white/70">{isApprovedStale ? "อนุมัติแล้ว — ต้องสร้างใหม่" : isStale ? "ข้อเสนอเก่า — ใช้ไม่ได้" : proposalStatusLabel(item.status)}</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-white/70">ความเสี่ยง: {riskLabel(effectiveRiskLevel)}</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-white/70">ความมั่นใจของระบบ: {percent(item.confidence)}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-white/90">{item.articleTitle || "ข้อเสนอสำหรับบทความ"}</h2>
                  <p className="mt-1 text-sm text-[#e0c985]">{proposalTypeLabel(effectiveType)}</p>
                </div>
                <div className="flex gap-2">
                  {item.status === "approved" ? (
                    <div className="max-w-sm text-right">
                      {isApprovedStale ? (
                        <>
                          <Link href={seoHref} className="inline-flex min-h-11 items-center rounded-xl border border-[#e0c985]/30 bg-[#e0c985]/10 px-3.5 py-2 text-sm font-semibold text-[#f4df9b] transition hover:bg-[#e0c985]/15">
                            ตรวจ SEO และสร้างข้อเสนอใหม่
                          </Link>
                          <p className="mt-2 text-sm leading-6 text-white/65">ฉบับร่างเปลี่ยนหลังจากอนุมัติ ระบบจึงไม่ใช้ข้อเสนอเดิมซ้ำ</p>
                        </>
                      ) : (
                        <>
                          <ApplySuggestionButton id={item.id} articleId={articleId} disabled={!canApply} />
                          {applyDisabledReason ? <p className="mt-2 text-sm leading-6 text-white/65">{applyDisabledReason}</p> : null}
                        </>
                      )}
                      {(effectiveRiskLevel === "high" || effectiveRiskLevel === "critical" || !effectiveType || !getApplyableFieldPath(effectiveType)) && studioPreviewHref && studioReady ? (
                        <Link href={studioPreviewHref} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-[#f4df9b] underline underline-offset-4">
                          เปิดตรวจด้วยตนเองใน Studio<span className="sr-only"> (เปิดแท็บใหม่)</span>
                        </Link>
                      ) : null}
                    </div>
                  ) : item.status === "needs-human-review" ? (
                    <div className="max-w-sm text-right">
                      <ApproveSuggestionButton id={item.id} disabled={!canApprove} />
                      <ReviewDecisionControls
                        id={item.id}
                        initialAfter={item.after ?? ""}
                        initialReason={item.reason ?? ""}
                        canEdit={canEdit}
                        canReject={canReject}
                      />
                      {approveDisabledReason ? <p className="mt-2 text-sm leading-6 text-white/65">{approveDisabledReason}</p> : null}
                    </div>
                  ) : item.status === "applied" && studioPreviewHref && studioReady ? (
                    <div className="max-w-xs text-right">
                      <Link
                        href={studioPreviewHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-xl border border-[#e0c985]/30 bg-[#e0c985]/10 px-3.5 py-2 text-xs font-semibold text-[#f4df9b] transition hover:bg-[#e0c985]/15"
                      >
                        เปิดตัวอย่างฉบับร่างใน Studio<span className="sr-only"> (เปิดแท็บใหม่)</span>
                      </Link>
                      <p className="mt-2 text-sm leading-6 text-white/65">
                        ขั้นต่อไปคือตรวจตัวอย่างด้วยตัวคุณเอง รายการนี้ยังไม่ได้เผยแพร่
                      </p>
                    </div>
                  ) : (
                    <span className="text-sm text-white/60">สถานะนี้ไม่มีรายการที่ต้องทำต่อ</span>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="text-sm text-white/60">ก่อนเปลี่ยน</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/55">{item.before || "—"}</p>
                </div>
                <div className="rounded-2xl border border-[#e0c985]/15 bg-[#e0c985]/[0.05] p-4">
                  <div className="text-sm text-[#e0c985]">ข้อเสนอหลังเปลี่ยน</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/75">{effectiveAfter || "—"}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white/[0.025] p-4">
                <div className="text-sm text-white/60">เหตุผลที่ระบบเสนอ</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/55">{item.reason || "—"}</p>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
