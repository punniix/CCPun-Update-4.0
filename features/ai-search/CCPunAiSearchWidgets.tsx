'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';

// Public endpoint — no credentials are embedded in the website bundle.
export const CCPUN_AI_SEARCH_URL =
  'https://ea88b552-a894-4e4e-8e39-08fc938baf22.search.ai.cloudflare.com/';

const snippetStyle = {
  '--search-snippet-primary-color': '#E0C985',
  '--search-snippet-font-family': "'Kanit', sans-serif",
} as CSSProperties;

function useSearchSnippet() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    import('@cloudflare/ai-search-snippet').then(
      () => { if (active) setReady(true); },
      () => { /* Search enhancement fails closed, without breaking the site. */ },
    );
    return () => { active = false; };
  }, []);
  return ready;
}

export function CCPunAiSearchChrome() {
  const ready = useSearchSnippet();
  if (!ready) return null;
  return (
    <>
      <search-modal-snippet
        api-url={CCPUN_AI_SEARCH_URL}
        placeholder="ค้นหาบทความการเงิน ประกัน และการลงทุน"
        shortcut="k"
        show-url="true"
        show-date="true"
        style={snippetStyle}
      />
      <chat-bubble-snippet api-url={CCPUN_AI_SEARCH_URL} style={snippetStyle} />
    </>
  );
}

export function CCPunAiSearchBar() {
  const ready = useSearchSnippet();
  if (!ready) return <Link href="/blog/" style={{ color: '#E0C985' }}>อ่านบทความ CCPun ทั้งหมด</Link>;
  return (
    <search-bar-snippet
      api-url={CCPUN_AI_SEARCH_URL}
      placeholder="ลองถาม เช่น Copayment กับ Deductible ต่างกันอย่างไร?"
      max-results="20"
      max-render-results="8"
      show-url="true"
      show-date="true"
      style={snippetStyle}
    />
  );
}
