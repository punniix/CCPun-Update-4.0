'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { usePublicCopy } from '@/components/ui/PublicCopyProvider';
import styles from './CCPunAiSearch.module.css';

// Public, search-only UAT endpoint. Never accept an endpoint from content or URL input.
export const CCPUN_AI_SEARCH_URL = 'https://f687f126-71f5-49d5-8193-ac2313dd8e3e.search.ai.cloudflare.com/search';
export const AI_SEARCH_TIMEOUT_MS = 8000;

const UAT_CORPUS = Array.from({ length: 11 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  const category = index % 2 === 0 ? 'personal-finance' : 'health-insurance';
  return {
    url: `https://test.ccpun.com/blog/${category}/uat-qa-20261023-${number}/`,
    id: `ccpun-uat-qa-article-20261023-${number}`,
    key: `ccpun-uat-qa-20261023-${number}.md`,
  };
});

export type AiSearchResult = { url: string; title: string; text: string };

export function parseAiSearchResults(payload: unknown): AiSearchResult[] {
  if (!payload || typeof payload !== 'object' || !('chunks' in payload) || !Array.isArray(payload.chunks)) throw new Error('unavailable');
  const results: AiSearchResult[] = [];
  for (const chunk of payload.chunks.slice(0, 50)) {
    if (!chunk || typeof chunk !== 'object') continue;
    const metadata = chunk.item?.metadata;
    const approved = UAT_CORPUS.find(item => item.url === metadata?.url && item.id === metadata?.document_id && item.key === chunk.item?.key);
    if (!approved || typeof metadata.title !== 'string' || !metadata.title.trim() || typeof chunk.text !== 'string') continue;
    if (results.some(result => result.url === approved.url)) continue;
    results.push({ url: approved.url, title: metadata.title.slice(0, 240), text: chunk.text.slice(0, 600) });
    if (results.length === 5) break;
  }
  return results;
}

export async function searchUatArticles(query: string, signal: AbortSignal, request: typeof fetch = fetch): Promise<AiSearchResult[]> {
  const value = query.trim();
  if (!value || value.length > 200) throw new Error('query');
  const response = await request(CCPUN_AI_SEARCH_URL, {
    method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ query: value, ai_search_options: {
      query_rewrite: { enabled: false }, reranking: { enabled: false },
      retrieval: { retrieval_type: 'hybrid', max_num_results: 5, match_threshold: 0.2 },
    } }),
  });
  if (!response.ok) throw new Error(response.status === 429 ? 'rate-limit' : 'unavailable');
  return parseAiSearchResults(await response.json());
}

type Status = 'idle' | 'loading' | 'success' | 'query' | 'rate-limit' | 'unavailable' | 'timeout';

export function CCPunAiSearchBar() {
  const text = usePublicCopy();
  const inputId = useId();
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<AiSearchResult[]>([]);

  useEffect(() => () => { activeRequest.current?.abort(); activeRequest.current = null; }, []);

  function close() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setStatus('idle');
    setResults([]);
    if (details.current) details.current.open = false;
    summary.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim() || query.trim().length > 200) { setStatus('query'); return; }
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, AI_SEARCH_TIMEOUT_MS);
    setResults([]);
    setStatus('loading');
    try {
      const nextResults = await searchUatArticles(query, controller.signal);
      if (activeRequest.current !== controller) return;
      setResults(nextResults);
      setStatus('success');
    } catch (error) {
      if (activeRequest.current !== controller) return;
      setStatus(timedOut ? 'timeout' : error instanceof Error && error.message === 'rate-limit' ? 'rate-limit' : 'unavailable');
    } finally {
      clearTimeout(timeout);
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }

  const message = status === 'loading' ? text('site.aiSearch.loading')
    : status === 'query' ? text('site.aiSearch.queryError')
    : status === 'rate-limit' ? text('site.aiSearch.rateLimit')
    : status === 'timeout' ? text('site.aiSearch.timeout')
    : status === 'unavailable' ? text('site.aiSearch.unavailable')
    : status === 'success' && results.length === 0 ? text('site.aiSearch.empty') : '';

  return <details ref={details} className={styles.search}
    onToggle={event => { if (!event.currentTarget.open) { activeRequest.current?.abort(); activeRequest.current = null; setStatus('idle'); setResults([]); } }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close(); } }}>
    <summary ref={summary}>{text('site.aiSearch.open')}</summary>
    <div className={styles.content}>
      <p>{text('site.aiSearch.description')}</p>
      <form onSubmit={submit} role="search" aria-label={text('site.aiSearch.open')}>
        <label htmlFor={inputId}>{text('site.aiSearch.label')}</label>
        <div className={styles.controls}>
          <input id={inputId} name="query" type="search" maxLength={200} required autoComplete="off"
            value={query} onChange={event => setQuery(event.target.value)} placeholder={text('site.aiSearch.placeholder')} />
          <button type="submit" disabled={status === 'loading'}>{text('site.aiSearch.submit')}</button>
        </div>
      </form>
      <div role="status" aria-live="polite" aria-busy={status === 'loading'}>{message}</div>
      {results.length > 0 && <ul aria-label={text('site.aiSearch.results')}>
        {results.map(result => <li key={result.url}><a href={result.url}>{result.title}</a><p>{result.text}</p></li>)}
      </ul>}
      <button className={styles.close} type="button" onClick={close}>{text('site.aiSearch.close')}</button>
    </div>
  </details>;
}
