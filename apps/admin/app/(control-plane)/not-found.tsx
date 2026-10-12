import { ControlPlaneNotFoundView } from "@/features/admin/components/AdminNotFoundView";

export default function ControlPlaneNotFound() {
  return <ControlPlaneNotFoundView eyebrow="ไม่พบหน้านี้" title="หน้าที่ต้องการอาจย้ายไปแล้วหรือยังไม่เปิดให้ใช้" actionLabel="กลับหน้าภาพรวม" />;
}
