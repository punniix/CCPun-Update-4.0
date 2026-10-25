import type { Metadata } from "next";
import { PlanningHouseholdsPage } from "@/features/admin/financial-planning/PlanningPages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "วางแผนการเงิน" };

export default function Page() {
  return <PlanningHouseholdsPage />;
}
