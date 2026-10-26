import { createHash } from 'node:crypto';

// COO C4, 2026-10-26: only the Bangkok-date AFPT™ card/import/setup may succeed
// the reviewed dashboard copy fix. Existing digest constants remain unchanged.
export const adminAfptReminder20261026Source = Object.freeze({
  file: 'apps/admin/app/(control-plane)/dashboard/page.tsx',
  before: 'cb513d139f472171b10d88448819342f1d95150de6e50b9f6a01bf9e5236599c',
  after: '4ab465813bf1ff198f1e792cb8c521540dfa7cbb0f6e3a43fdd61c87bb9486e9',
});
const sha = source => createHash('sha256').update(source).digest('hex');

// Round 2 C4b: approved heading/body, with proposed final-day/expired wording.
// Keep the original C4 digest and admit only this exact copy successor.
export const adminAfptReminderCopy20261026Source = Object.freeze({
  file: adminAfptReminder20261026Source.file,
  before: adminAfptReminder20261026Source.after,
  after: 'bc336a2f593bd248b31a849c0122d3b9489553763f4f18515b85a7728f943b73',
});

export function adminAfptReminderCopy20261026PredecessorDigest(file, digest) {
  const entry = adminAfptReminderCopy20261026Source;
  return file === entry.file && digest === entry.after ? entry.before : digest;
}

export function adminAfptReminder20261026PredecessorDigest(file, digest) {
  digest = adminAfptReminderCopy20261026PredecessorDigest(file, digest);
  const entry = adminAfptReminder20261026Source;
  return file === entry.file && digest === entry.after ? entry.before : digest;
}

export function adminAfptReminderCopy20261026SourcePredecessor(source) {
  if (sha(source) !== adminAfptReminderCopy20261026Source.after) return source;
  return source
    .replace('<h2 id="afpt-renewal-heading" className="text-lg font-semibold">เตือนต่ออายุคุณวุฒิ</h2>', '<h2 id="afpt-renewal-heading" className="text-lg font-semibold">{AFPT_CREDENTIAL.name}{afptReminder.expired ? " หมดอายุแล้ว" : " ใกล้ครบกำหนดต่ออายุ"}</h2>')
    .replace(/          <p className="mt-2 text-sm font-medium">[\s\S]*?<\/p>/, '          <p className="mt-2 text-sm font-medium">{afptReminder.expired ? "โปรดตรวจการต่ออายุ" : afptReminder.daysRemaining === 0 ? "ใช้ได้ถึงวันนี้" : `เหลืออีก ${afptReminder.daysRemaining} วัน`}</p>');
}

/** Exact-source gate first: an altered or duplicate card is never stripped. */
export function adminAfptReminder20261026SourcePredecessor(source) {
  source = adminAfptReminderCopy20261026SourcePredecessor(source);
  if (sha(source) !== adminAfptReminder20261026Source.after) return source;
  return source
    .replace('environmentLabel, thaiDisplayDate }', 'environmentLabel }')
    .replace('import { AFPT_CREDENTIAL, getAfptRenewalReminder } from "@/lib/admin/afpt-renewal";\n', '')
    .replace('  const afptReminder = getAfptRenewalReminder();\n', '')
    .replace(/      \{afptReminder \? \([\s\S]*?      \) : null\}\n\n/, '');
}

function cardPair(days) {
    const expired = days < 0;
    const heading = expired ? 'AFPT™ หมดอายุแล้ว' : 'AFPT™ ใกล้ครบกำหนดต่ออายุ';
    const detail = expired ? 'โปรดตรวจการต่ออายุ' : days === 0 ? 'ใช้ได้ถึงวันนี้' : `เหลืออีก ${days} วัน`;
    const card = `<section role="status" aria-labelledby="afpt-renewal-heading" data-afpt-reminder="${expired ? 'expired' : 'due'}" class="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-5 text-amber-50"><h2 id="afpt-renewal-heading" class="text-lg font-semibold">${heading}</h2><p class="mt-2 text-sm">TFPA · เลขที่ AFPT260195</p><p class="mt-1 text-sm">มีผล 22 ก.ย. 2569 · ใช้ได้ถึง 31 ธ.ค. 2571</p><p class="mt-2 text-sm font-medium">${detail}</p></section>`;
    const copyDetail = expired ? 'AFPT™ หมดอายุแล้ว ตั้งแต่ 1 ม.ค. 2572' : days === 0 ? 'AFPT™ ใช้ได้ถึงวันนี้ (31 ธ.ค. 2571)' : `AFPT™ ต้องต่ออายุภายใน 31 ธ.ค. 2571 (เหลือ ${days} วัน)`;
    const copyCard = card.replace(heading, 'เตือนต่ออายุคุณวุฒิ').replace(`<p class="mt-2 text-sm font-medium">${detail}</p>`, `<p class="mt-2 text-sm font-medium">${copyDetail}</p>`);
    return { card, copyCard };
}

export function adminAfptReminderCopy20261026DomPredecessor(html) {
  if (typeof html !== 'string' || html.split('data-afpt-reminder=').length !== 2) return html;
  for (const days of [-1, ...Array.from({ length: 91 }, (_, day) => day)]) {
    const { card, copyCard } = cardPair(days);
    if (html.includes(copyCard)) return html.replace(copyCard, card);
  }
  return html;
}

export function adminAfptReminder20261026DomPredecessor(html) {
  html = adminAfptReminderCopy20261026DomPredecessor(html);
  if (typeof html !== 'string' || html.split('data-afpt-reminder=').length !== 2) return html;
  for (const days of [-1, ...Array.from({ length: 91 }, (_, day) => day)]) {
    const { card } = cardPair(days);
    if (html.includes(card)) return html.replace(card, '');
  }
  return html;
}
