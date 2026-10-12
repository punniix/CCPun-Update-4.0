import StudioUnavailableView from "@/features/admin/components/StudioUnavailableView";
import { notFound } from "next/navigation";
import { metadata as studioMetadata, viewport } from "next-sanity/studio";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import { getAdminEnvironment, isStudioDataPlaneAllowed } from "@/lib/admin/environment";
import StudioClient from "./studio-client";

export const dynamic = "force-dynamic";
export const metadata = {
  ...studioMetadata,
  other: { "darkreader-lock": "true" },
};
export { viewport };

export default async function StudioPage() {
  const environment = getAdminEnvironment();
  const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_STUDIO_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET;
  if (!IS_REVIEW_ENVIRONMENT) notFound();
  if (!isStudioDataPlaneAllowed(dataset, environment, undefined, undefined, projectId)) notFound();
  if (!projectId || !dataset) {
    return <StudioUnavailableView title="ยังเปิด Sanity Studio ไม่ได้" description="กรุณาให้ผู้ดูแลตั้งค่าโครงการและชุดข้อมูล Sanity สำหรับพื้นที่ทดสอบ UAT ให้ครบ" />;
  }

  return <StudioClient />;
}
