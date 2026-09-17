"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadSocialWorkspace } from "./social-workspace-client";

type Workspace = Awaited<ReturnType<typeof loadSocialWorkspace>>;

export default function SocialReviewAttention() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void loadSocialWorkspace(controller.signal)
      .then((value) => {
        setWorkspace(value);
        setError(Boolean(value.draftError));
      })
      .catch(() => setError(true));
    return () => controller.abort();
  }, []);

  const needsReview = useMemo(
    () => workspace?.drafts.filter((item) => item.reviewStatus !== "approved").length ?? 0,
    [workspace],
  );

  return (
    <Link
      href="/social/posts/"
      className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition motion-reduce:transition-none hover:border-[#e0c985]/35 hover:bg-white/[0.045] focus:outline-none focus:ring-2 focus:ring-[#e0c985]"
      aria-label={error ? "เปิด Posts เพื่อตรวจ Draft; สรุป Draft โหลดไม่สำเร็จ" : `เปิด Posts; มี ${needsReview} รายการที่ต้อง Review`}
    >
      <div className="text-xs text-white/45">Needs review</div>
      <div className="mt-2 text-2xl font-semibold text-white">{workspace ? needsReview.toLocaleString("th-TH") : error ? "!" : "…"}</div>
      <p className="mt-2 text-xs leading-5 text-white/55">{error ? "เปิด Posts เพื่อตรวจสถานะ Draft โดยตรง" : "Content / Fact / Compliance / COO review ที่ยังไม่ Approved"}</p>
      <span className="mt-3 inline-flex text-xs font-medium text-[#f4df9b] group-hover:underline">Review posts →</span>
    </Link>
  );
}
