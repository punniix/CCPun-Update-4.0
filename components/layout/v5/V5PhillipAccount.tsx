import Image from "next/image";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import { V5_ACCOUNT_LINKS } from "./constants";
import shell from "./V5.module.css";
import styles from "./V5PhillipAccount.module.css";

/** The approved account destination and original QR are shared by the two native placements. */
export default async function V5PhillipAccount({ siteCopy }: { siteCopy?: PublicCopyValues }) {
  const text = publicCopyText(siteCopy ?? await getPublicCopy("site"));
  const account = V5_ACCOUNT_LINKS.find((link) => link.id === "phillip");
  if (!account) return null;
  return (
    <section className={styles.section} aria-labelledby="phillip-account-title">
      <div className={shell.inner}>
        <div className={styles.card}>
          <div className={styles.copy}>
            <h2 id="phillip-account-title">{text.node("site.account.phillip.title")}</h2>
            <p className={styles.desktopDescription}>{text.node("site.account.phillip.desktopDescription")}</p>
            <p className={styles.mobileDescription}>{text.node("site.account.phillip.mobileDescription")}</p>
            <a className={`${shell.button} ${styles.action}`} href={account.href} target="_blank" rel="noopener noreferrer">{text.node("site.account.phillip.action")}</a>
          </div>
          <div className={styles.qr} aria-hidden="true">
            <Image src="/assets/website-v5/phillip-account-qr-84935a14.png" alt="" width={200} height={200} unoptimized loading="lazy" />
          </div>
        </div>
      </div>
    </section>
  );
}
