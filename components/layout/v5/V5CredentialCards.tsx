import V5LicenceFlip from "./V5LicenceFlip";
import { V5_AFPT_CARD, V5_CREDENTIAL_FLIP_HINT, V5_LICENCE_FLIP_HINT, V5_LICENCE_NUMBER_LABEL } from "./licence-flip-copy";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import styles from "./V5LicenceFlip.module.css";

type Cell = { term: string; detail: string };
type RegistryLink = { href: string; label: string };
type Verification = Partial<Record<"afpt" | "life" | "investment" | "nonLife", RegistryLink>>;

/** Review credentials are static. The unchanged non-review renderer awaits separate Production approval. */
export default function V5CredentialCards({ className, qualification, licenceCards, verification, compact = false }: { className?: string; qualification: Cell | null; licenceCards: readonly Cell[]; verification?: Verification; compact?: boolean }) {
  if (!IS_REVIEW_ENVIRONMENT) return (
    <ul className={className} role="list">
      {qualification ? <li><dl><div><dt>{qualification.term}</dt>{qualification.detail ? <dd>{qualification.detail}</dd> : null}</div></dl></li> : null}
      <li><V5LicenceFlip term={V5_AFPT_CARD.term} detail={V5_AFPT_CARD.detail} hint={V5_CREDENTIAL_FLIP_HINT} back={V5_AFPT_CARD.back} /></li>
      {licenceCards.map((item) => <li key={item.term + item.detail}><V5LicenceFlip term={item.term} detail={item.detail} hint={V5_LICENCE_FLIP_HINT} back={item.detail ? [{ label: V5_LICENCE_NUMBER_LABEL, value: item.detail, repeatsFront: true }] : []} note={null} /></li>)}
    </ul>
  );
  const registry = (href: string): RegistryLink => ({ href, label: V5_LICENCE_FLIP_HINT });
  const tfpa = verification?.afpt ?? registry("https://www.tfpa.or.th/");
  const oic = registry("https://oiceservice.oic.or.th/licenseagency/license.php");
  const sec = registry("https://market.sec.or.th/LicenseCheck/Search");
  const certificate = V5_AFPT_CARD.back.find(line => line.label === "เลขที่ใบรับรอง")!.value;
  const cards = [
    { term: V5_AFPT_CARD.term, number: `คุณวุฒิ ${certificate}`, detail: V5_AFPT_CARD.detail, facts: V5_AFPT_CARD.back.filter(line => line.label !== "เลขที่ใบรับรอง"), link: tfpa },
    ...licenceCards.map(item => ({ term: item.term, number: item.detail, detail: "", facts: [], link: /วินาศภัย/.test(item.term) ? verification?.nonLife ?? oic : /ประกันชีวิต/.test(item.term) ? verification?.life ?? oic : /การลงทุน/.test(item.term) ? verification?.investment ?? sec : undefined })),
  ];
  const words = (value: string) => value.split(/(เครื่องมือ|การลงทุน|การเงิน|รับผิดชอบ|เตรียมตัว|วางแผน)/g).map((part, i) => i % 2 ? <span className={styles.keep} key={i}>{part}</span> : part);
  return <ul className={className} role="list" data-credential-presentation={compact ? "summary" : "details"}>
    {qualification ? <li><article className={styles.staticCard}><strong>{words(qualification.term)}</strong><p>{qualification.detail}</p></article></li> : null}
    {cards.map(card => <li key={card.term + card.number}>
      {compact && card.link ? <a className={styles.compactCard} href={card.link.href} target="_blank" rel="noopener noreferrer">
        <strong><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.5" /></svg><span>{words(card.term)}</span></strong><span>{card.number}</span>
      </a> : <article className={`${styles.staticCard} ${card.detail ? styles.fullCredential : ""}`}>
        <strong>{words(card.term)}</strong><p className={styles.credentialNumber}>{card.number}</p>
        {card.detail ? <p className={styles.credentialDetail}>{card.detail}</p> : null}
        {card.facts.length ? <dl className={styles.credentialFacts}>{card.facts.map(line => <div key={line.label}><dt>{line.label}</dt><dd>{words(line.value)}</dd></div>)}</dl> : null}
        {card.link ? <a className={styles.staticRegistryLink} href={card.link.href} target="_blank" rel="noopener noreferrer">{card.link.label}</a> : null}
      </article>}
    </li>)}
  </ul>;
}
