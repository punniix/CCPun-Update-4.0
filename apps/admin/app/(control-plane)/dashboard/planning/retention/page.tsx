import type { Metadata } from "next";
import { PlanningRetentionPage } from "@/features/admin/financial-planning/PlanningPages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ข้อมูลที่ครบกำหนดตรวจ" };

export default function Page() {
  return <PlanningRetentionPage />;
}
