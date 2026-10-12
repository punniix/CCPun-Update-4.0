import { ControlPlaneNotFoundView } from "@/features/admin/components/AdminNotFoundView";

export default function ControlPlaneNotFound() {
  return <ControlPlaneNotFoundView eyebrow="404 · CCPun Control Plane" title="ไม่พบหน้าหลังบ้านนี้" actionLabel="กลับ Dashboard" />;
}
