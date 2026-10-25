import type { Metadata } from "next";
import { PlanningHouseholdPage } from "@/features/admin/financial-planning/PlanningPages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สถานะการเงิน" };

export default async function Page({ params }: { params: Promise<{ householdId: string }> }) {
  return <PlanningHouseholdPage householdId={(await params).householdId} />;
}
