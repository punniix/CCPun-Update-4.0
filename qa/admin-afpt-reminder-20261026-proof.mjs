import { createHash } from 'node:crypto';

// COO C4, 2026-10-26: only the Bangkok-date AFPT™ card/import/setup may succeed
// the reviewed dashboard copy fix. Existing digest constants remain unchanged.
export const adminAfptReminder20261026Source = Object.freeze({
  file: 'apps/admin/app/(control-plane)/dashboard/page.tsx',
  before: 'cb513d139f472171b10d88448819342f1d95150de6e50b9f6a01bf9e5236599c',
  after: '4ab465813bf1ff198f1e792cb8c521540dfa7cbb0f6e3a43fdd61c87bb9486e9',
});
const sha = source => createHash('sha256').update(source).digest('hex');

export function adminAfptReminder20261026PredecessorDigest(file, digest) {
  const entry = adminAfptReminder20261026Source;
  return file === entry.file && digest === entry.after ? entry.before : digest;
}

/** Exact-source gate first: an altered or duplicate card is never stripped. */
export function adminAfptReminder20261026SourcePredecessor(source) {
  if (sha(source) !== adminAfptReminder20261026Source.after) return source;
  return source
    .replace('environmentLabel, thaiDisplayDate }', 'environmentLabel }')
    .replace('import { AFPT_CREDENTIAL, getAfptRenewalReminder } from "@/lib/admin/afpt-renewal";\n', '')
    .replace('  const afptReminder = getAfptRenewalReminder();\n', '')
    .replace(/      \{afptReminder \? \([\s\S]*?      \) : null\}\n\n/, '');
}

export function adminAfptReminder20261026DomPredecessor(html) {
  if (typeof html !== 'string' || html.split('data-afpt-reminder=').length !== 2) return html;
  for (const days of [-1, ...Array.from({ length: 91 }, (_, day) => day)]) {
    const expired = days < 0;
    const heading = expired ? 'AFPT™ หมดอายุแล้ว' : 'AFPT™ ใกล้ครบกำหนดต่ออายุ';
    const detail = expired ? 'โปรดตรวจการต่ออายุ' : days === 0 ? 'ใช้ได้ถึงวันนี้' : `เหลืออีก ${days} วัน`;
    const card = `<section role="status" aria-labelledby="afpt-renewal-heading" data-afpt-reminder="${expired ? 'expired' : 'due'}" class="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-5 text-amber-50"><h2 id="afpt-renewal-heading" class="text-lg font-semibold">${heading}</h2><p class="mt-2 text-sm">TFPA · เลขที่ AFPT260195</p><p class="mt-1 text-sm">มีผล 22 ก.ย. 2569 · ใช้ได้ถึง 31 ธ.ค. 2571</p><p class="mt-2 text-sm font-medium">${detail}</p></section>`;
    if (html.includes(card)) return html.replace(card, '');
  }
  return html;
}
