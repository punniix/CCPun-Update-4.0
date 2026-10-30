import V5LicenceFlip, { type V5CardVerification } from "./V5LicenceFlip";
import { V5_AFPT_CARD, V5_CREDENTIAL_FLIP_HINT, V5_LICENCE_FLIP_HINT, V5_LICENCE_NUMBER_LABEL, V5_LICENCE_VERIFY_PLACEHOLDER } from "./licence-flip-copy";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";

type Cell = { term: string; detail: string };

/**
 * v5 motion round (owner-approved idea #4, UAT): the credential cards shared by the homepage hero and
 * the About page. The owner-approved AFPT™ card leads, a non-AFPT CMS qualification keeps a plain cell,
 * and each licence flips to its number (plus the UAT-only verification placeholder on review builds).
 */
export default function V5CredentialCards({ className, qualification, licenceCards, verification }: { className?: string; qualification: Cell | null; licenceCards: readonly Cell[]; verification?: Partial<Record<"afpt" | "life" | "investment" | "nonLife", V5CardVerification>> }) {
  const licenceVerifyNote = IS_REVIEW_ENVIRONMENT ? V5_LICENCE_VERIFY_PLACEHOLDER : null;
  return (
    <ul className={className} role="list">
      {qualification ? <li><dl><div><dt>{qualification.term}</dt>{qualification.detail ? <dd>{qualification.detail}</dd> : null}</div></dl></li> : null}
      <li><V5LicenceFlip term={V5_AFPT_CARD.term} detail={V5_AFPT_CARD.detail} hint={V5_CREDENTIAL_FLIP_HINT} back={V5_AFPT_CARD.back} verification={verification?.afpt} /></li>
      {licenceCards.map((item) => {
        const target = /วินาศภัย/.test(item.term) ? verification?.nonLife : /ประกันชีวิต/.test(item.term) ? verification?.life : /การลงทุน/.test(item.term) ? verification?.investment : undefined;
        return <li key={item.term + item.detail}><V5LicenceFlip term={item.term} detail={item.detail} hint={V5_LICENCE_FLIP_HINT} back={!target && item.detail ? [{ label: V5_LICENCE_NUMBER_LABEL, value: item.detail, repeatsFront: true }] : []} note={target ? null : licenceVerifyNote} verification={target} /></li>;
      })}
    </ul>
  );
}
