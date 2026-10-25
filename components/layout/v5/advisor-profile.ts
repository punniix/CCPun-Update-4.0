import type { StaticImageData } from "next/image";
import type { ArticleAuthorProfile } from "@/lib/content/types";
import type { PublicCopyKey } from "@/lib/content/public-copy-registry";
import { getPublicAuthorName } from "@/lib/content/author-identity";
import phillipLogo from "../../../public/assets/phillip-logo.svg";

type Text = (key: PublicCopyKey) => string;

/**
 * The advisor identity and credential list shown on the homepage and the About page. Reads the
 * published Sanity author profile; the licence fallbacks are the approved home copy keys.
 */
export function v5AdvisorProfile(authorProfile: ArticleAuthorProfile | null, text: Text) {
  const qualifications = authorProfile?.professionalQualifications ?? [];
  const primary = qualifications[0];
  const suffix = qualifications.map((item) => item.shortName.trim()).filter(Boolean).join(", ");
  const name = getPublicAuthorName(authorProfile);
  const role = authorProfile?.profileRole?.trim() || text("home.advisor.defaultRole");
  const displayName = suffix ? `${name}, ${suffix}` : name;
  const licenses = authorProfile?.professionalLicenses?.length
    ? authorProfile.professionalLicenses.map(({ name: label, identifier }) => `${label.trim()} ${identifier.trim()}`)
    : [text("home.licenseLabelsText"), text("home.licenseLabelsText2"), text("home.licenseLabelsText3")];
  const primaryCell = primary ? { term: primary.shortName, detail: `${text("home.advisor.qualificationPrefix").replace(/^\s*·\s*/, "")}${primary.identifier ?? ""}`.trim() } : null;
  const licenceCards = licenses.map((label) => {
    const match = label.match(/^(.*?)\s+([0-9A-Z-]{5,})$/);
    return match ? { term: match[1], detail: match[2] } : { term: label, detail: "" };
  });
  const credentials = [...(primaryCell ? [primaryCell] : []), ...licenceCards];
  // v5 motion round: the owner-approved AFPT™ flip card leads the credential cards, so a CMS AFPT
  // qualification is not repeated; a different CMS qualification keeps its plain cell.
  const qualification = primaryCell && !/AFPT/i.test(primaryCell.term) ? primaryCell : null;
  return { qualifications, primary, displayName, role, credentials, qualification, licenceCards };
}

/** The six partners and platforms CCPun works with (names and roles from the approved home copy). */
export function v5Partners(text: Text): Array<{ src: string | StaticImageData; width: number; height: number; name: string; role: string }> {
  return [
    { src: "/assets/aia-logo.webp", width: 512, height: 341, name: text("home.website43Homealt2"), role: text("home.span4") },
    { src: "/assets/website-43/fairdee-logo.png", width: 512, height: 512, name: text("home.website43Homealt3"), role: text("home.span5") },
    { src: "/assets/maybank-logo.webp", width: 512, height: 512, name: text("home.website43Homealt4"), role: text("home.span6") },
    { src: phillipLogo, width: 1000, height: 400, name: text("home.website43Homealt5"), role: text("home.span6") },
    { src: "/assets/website-43/webull-logo.png", width: 736, height: 736, name: text("home.website43Homealt6"), role: text("home.span7") },
    { src: "/assets/finnomena-logo.webp", width: 200, height: 200, name: text("home.website43Homealt7"), role: text("home.span6") },
  ];
}
