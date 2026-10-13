import Link from "next/link";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export async function SettingsPage({ items, eyebrow, title }: { items: readonly (readonly [string, string, string])[]; eyebrow: string; title: string }) {
  await requireAdminPermission("settings:read");
  return <div><p className="text-xs font-semibold tracking-[0.12em] text-gold-500">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold">{title}</h1><div className="mt-6 grid gap-3 md:grid-cols-3">{items.map(([href, title, description]) => <Link key={href} href={href} className="glass-card min-h-40 p-5"><h2 className="text-lg font-semibold text-gold-400">{title}</h2><p className="mt-2 text-sm leading-6 text-white/70">{description}</p></Link>)}</div></div>;
}
