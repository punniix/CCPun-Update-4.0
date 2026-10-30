import { getPublicCopy } from "@/lib/content/public-copy";
import type { PublicCopyValues } from "@/lib/content/public-copy-registry";
import { resolvePageSeoMetadata } from "@/lib/seo/page-seo";
import type { Metadata, ResolvingMetadata } from "next";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import V5Privacy from "@/features/legal/v5/V5Privacy";

const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว | CCPun ที่ปรึกษาทางการเงิน",
  description: "CCPun ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ อ่านนโยบายความเป็นส่วนตัวของเราเพื่อทำความเข้าใจว่าเราเก็บและใช้ข้อมูลอย่างไร",
  robots: IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },
  alternates: { canonical: "https://ccpun.com/privacy/" },
  openGraph: {
    title: "นโยบายความเป็นส่วนตัว | CCPun ที่ปรึกษาทางการเงิน",
    description: "CCPun ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ อ่านนโยบายความเป็นส่วนตัวของเราเพื่อทำความเข้าใจว่าเราเก็บและใช้ข้อมูลอย่างไร",
    url: "https://ccpun.com/privacy/",
  },
  twitter: {
    title: "นโยบายความเป็นส่วนตัว | CCPun ที่ปรึกษาทางการเงิน",
    description: "CCPun ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ อ่านนโยบายความเป็นส่วนตัวของเราเพื่อทำความเข้าใจว่าเราเก็บและใช้ข้อมูลอย่างไร",
  },
};

// Website v5 (UAT prototype): the existing render owner now renders the v5 legal page
// (FigCraft 10/11) with the same copy scope; metadata below is unchanged.
export async function renderPrivacyPage(copyOverride?: PublicCopyValues, siteCopyOverride?: PublicCopyValues) {
  return <V5Privacy copy={copyOverride ?? await getPublicCopy("privacy")} siteCopy={siteCopyOverride} />;
}

export function generateMetadata(props: unknown, parent: ResolvingMetadata) {
  void props;
  return resolvePageSeoMetadata("/privacy/", metadata, parent);
}

export default function PrivacyPage() { return renderPrivacyPage(); }
