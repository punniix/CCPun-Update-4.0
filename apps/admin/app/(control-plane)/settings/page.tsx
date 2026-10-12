import { SettingsPage as SettingsPageOwner } from "@/features/admin/components/SettingsIndexPage";

const ITEMS = [
  ["/settings/integrations/", "การเชื่อมต่อ", "ตรวจบริการและแหล่งข้อมูลที่ระบบกำลังใช้งาน"],
  ["/settings/access/", "สิทธิ์ผู้ใช้", "ตรวจบทบาทและขอบเขตสิทธิ์ของบัญชี"],
  ["/settings/system/", "ข้อมูลระบบ", "ดูสภาพแวดล้อมและเวอร์ชันที่กำลังใช้งาน"],
] as const;

export default async function SettingsPage() {
  return SettingsPageOwner({ items: ITEMS, eyebrow: "ดูแลระบบ", title: "ตั้งค่า" });
}
