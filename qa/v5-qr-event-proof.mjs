import { createHash } from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
// C12 owner-approved exact additive QR event; all historical tracking pins remain frozen.
export const qrEventSource = Object.freeze({
  "file": "lib/analytics.ts",
  "before": "534030c0144dd78e4c506a2c446d39c0746bda0cfc24ef6de1ccdb5d8be7dc67",
  "after": "e1d290d31c5d7d8af1f038ef3796795e7df3cf8f479e1018c4699fbdcc30eb38",
  "changes": [
    [
      "  // C12: registered internal IDs only, never CMS text, prefill, answers or customer values.\n  topic: new Set(['check-existing-policy', 'health-plan', 'tax-deduction', 'smart-network-hospital', 'which-plan-fits', 'ci-result-chat', 'ci-plan', 'book-a-chat', 'fhc-result-chat', 'life-cover', 'investment-before', 'fund-allocation', 'motor-quote', 'money-plan', 'type-own']),\n  page_type: new Set(['home', 'blog_index', 'blog_category', 'article', 'tool_ci', 'tool_fhc', 'tool_money_story', 'tool_investment_allocation', 'tools_hub', 'about', 'coming_soon', 'default']),\n",
      ""
    ],
    [
      "  if (eventName === 'line_chat_qr_view') return { ga: ['line_chat_qr_view'], meta: 'none' };\n",
      ""
    ],
    [
      "    topic: null,\n    page_type: null,\n",
      ""
    ],
    [
      "  // C12 is GA4-only: social permission alone must never enqueue or emit this event.\n  if (eventName === 'line_chat_qr_view' && consent.analytics !== true) return;\n",
      ""
    ]
  ]
});
export function qrEventPredecessor(file, source) {
  if (file !== qrEventSource.file || sha(source) !== qrEventSource.after) return source;
  for (const [current, prior] of qrEventSource.changes) {
    if (source.split(current).length !== 2) throw new Error('QR event inverse must be exact and unique');
    source = source.replace(current, prior);
  }
  if (sha(source) !== qrEventSource.before) throw new Error('QR event predecessor mismatch');
  return source;
}
