import { redirect } from "next/navigation";

// Owner decision A4 (2026-10-25): the manual GSC/GA4 pull page is now the
// "ดึงใหม่ตอนนี้" button on the morning report. Old bookmarks and the Google
// connect return link (?googleConnect=...) land on the report directly.
export default async function SeoOpportunitiesRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const googleConnect = (await searchParams)?.googleConnect;
  if (typeof googleConnect === "string" && /^[a-z-]{1,40}$/.test(googleConnect)) redirect(`/analytics/?googleConnect=${googleConnect}`);
  redirect("/analytics/");
}
