import { SettingsPage as SettingsPageOwner } from "@/features/admin/components/SettingsIndexPage";

const ITEMS = [
  ["/settings/integrations/", "Integrations", "ตรวจสถานะ provider และ data lane"],
  ["/settings/access/", "Access", "ตรวจบทบาทและขอบเขตสิทธิ์"],
  ["/settings/system/", "System", "เปิด System Health และ environment guard"],
] as const;

export default async function SettingsPage() {
  return SettingsPageOwner({ items: ITEMS, eyebrow: "CONTROL PLANE", title: "Settings" });
}
