'use client';
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { BLOG_COPY_DEFAULTS } from "@/lib/content/blog-copy-defaults";

import { useState } from 'react';
import { Link as LinkIcon, Check as CheckIcon } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import styles from '@/components/layout/website-43/Website43.module.css';
import { useArticleEngagement } from './ArticleEngagement';

// Genuine Simple Icons SVG paths (CC0) for LINE, Facebook and X, preserved as provided.
const social = {
  line: 'M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314',
  facebook: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
  x: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z',
} as const;
type ShareMethod = keyof typeof social;
type SharePlacement = 'header' | 'footer';

const URL_ORIGIN = 'https://ccpun.com';

function SocialLogo({ method }: { method: ShareMethod }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="21" height="21" fill="currentColor">
    <path d={social[method]} />
  </svg>;
}

function fallbackCopy(text: string): boolean {
  const input = document.createElement('textarea');
  input.value = text;
  input.readOnly = true;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  try { return document.execCommand('copy'); }
  finally { input.remove(); }
}

export default function ArticleShareActions({ path, title, placement, origin = URL_ORIGIN }: {
  path: string;
  title: string;
  placement: SharePlacement;
  origin?: "https://ccpun.com" | "https://test.ccpun.com";
}) {
  const copyText = usePublicCopy(BLOG_COPY_DEFAULTS);


  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const { record: recordEngagement } = useArticleEngagement();
  // Fixed lane origins only; never trust a Host header or an editorial URL.
  const url = (origin === "https://test.ccpun.com" ? origin : URL_ORIGIN) + path;
  const encoded = encodeURIComponent(url);
  const shares = [
    { method: 'line', name: 'LINE', href: 'https://social-plugins.line.me/lineit/share?url=' + encoded },
    { method: 'facebook', name: 'Facebook', href: 'https://www.facebook.com/sharer/sharer.php?u=' + encoded },
    { method: 'x', name: 'X', href: 'https://twitter.com/intent/tweet?url=' + encoded + '&text=' + encodeURIComponent(title) },
  ] as const;
  const record = (method: 'line' | 'facebook' | 'x' | 'copy') => {
    trackEvent('share', { method, content_type: 'article', share_placement: placement });
    void recordEngagement('share');
  };
  const copy = async () => {
    try {
      const done = navigator.clipboard?.writeText
        ? await navigator.clipboard.writeText(url).then(() => true).catch(() => fallbackCopy(url))
        : fallbackCopy(url);
      if (!done) { setCopyState('error'); return; }
      setCopyState('success');
      record('copy');
    } catch { setCopyState('error'); }
  };

  return (
    <div className={styles.articleShareControls} aria-label={copyText("blog.articleShareActionsarialabel")}>
      <span className={styles.articleShareLabel}>{copyText("blog.articleShareLabel")}</span>
      <div className={styles.articleShareButtons}>
        {shares.map(({ method, name, href }) => (
          <a key={method} className={styles.articleShareButton} href={href} target="_blank" rel="noopener noreferrer"
            aria-label={copyText("blog.articleShareActionsText") + name} title={copyText("blog.articleShareActionsText2") + name}
            onClick={() => record(method)}>
            <SocialLogo method={method} />
          </a>
        ))}
        <button type="button" className={styles.articleShareButton}
          onClick={copy} aria-label={copyText("blog.articleShareActionsarialabel2")} title={copyText("blog.articleShareActionsarialabel2")}>
          {copyState === 'success' ? <CheckIcon aria-hidden="true" size={21} /> : <LinkIcon aria-hidden="true" size={21} />}
        </button>

      </div>
      <span className={styles.articleShareStatus} role="status" aria-live="polite">
        {copyState === 'success' ? copyText("blog.articleShareActionsText3") : copyState === 'error' ? copyText("blog.articleShareActionsText4") : ''}
      </span>
    </div>
  );
}
