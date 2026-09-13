import { readFileSync } from 'node:fs';
import {
  CI_LINE_OA_DESTINATION,
  CI_LINE_OA_URL,
} from '../features/ci-planning/calculator/constants';
import type { CIResult } from '../features/ci-planning/calculator/types';
import {
  createCIResultImageSummary,
  RESULT_IMAGE_HEIGHT,
  RESULT_IMAGE_WIDTH,
} from '../features/ci-planning/result-image';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

equal(RESULT_IMAGE_WIDTH, 1080, 'result image width must be stable');
equal(RESULT_IMAGE_HEIGHT, 1350, 'result image height must be stable');

equal(CI_LINE_OA_URL, 'https://lin.ee/tqLCs4f', 'CI must always use the approved LINE OA URL');
equal(CI_LINE_OA_DESTINATION, 'line_oa', 'CI analytics destination must always be direct LINE OA');

const result: CIResult = {
  householdMonthly: 12_345,
  householdNeed: 740_700,
  educationPlans: [{ annualCost: 98_765, yearsRemaining: 3 }],
  educationNeed: 296_295,
  mortgageDebtNeed: 444_444,
  carDebtNeed: 222_222,
  otherDebtBalance: 777_777,
  debtNeed: 666_666,
  calculatedNeed: 1_703_661,
  existingCoverage: 500_000,
  liquidAssets: 250_000,
  availableResources: 750_000,
  signedGap: 953_661,
  gap: 953_661,
  shortfall: 953_661,
  surplus: 0,
  incomeBasedNeed: 3_000_000,
  incomeSignedGap: 2_250_000,
  incomeShortfall: 2_250_000,
  incomeSurplus: 0,
  effectiveReserveYears: 5,
};

const summary = createCIResultImageSummary(
  result,
  'expense',
  'ci_planning_v6',
  new Date('2026-08-04T00:00:00.000Z'),
);
const expectedKeys = [
  'assessmentVersion',
  'availableResources',
  'breakdown',
  'disclaimer',
  'estimationMethod',
  'existingCICover',
  'generatedDate',
  'imageNotice',
  'liquidAssets',
  'mainNeedToday',
  'methodLabel',
  'shortfall',
  'surplus',
  'toolName',
];
equal(
  Object.keys(summary).sort().join(','),
  expectedKeys.sort().join(','),
  'image summary must expose only the approved top-level DTO',
);
assert(summary.breakdown, 'expense-method image must include the expense breakdown');
equal(summary.estimationMethod, 'expense', 'expense export must preserve the selected method enum');
equal(summary.methodLabel, 'ทุนตามรายจ่าย', 'expense export must show the selected method label');
equal(summary.mainNeedToday, result.calculatedNeed, 'expense export must use expense-derived need');
equal(summary.shortfall, result.shortfall, 'expense export must use the expense shortfall');
equal(summary.existingCICover, result.existingCoverage, 'expense export must include CI lump sum');
equal(summary.liquidAssets, result.liquidAssets, 'expense export must include liquid assets');
equal(summary.availableResources, result.availableResources, 'expense export must include combined available resources');
equal(summary.breakdown.household, result.householdNeed, 'aggregate household need must be included');
equal(summary.breakdown.education, result.educationNeed, 'aggregate education need must be included');
equal(summary.breakdown.debt, result.debtNeed, 'aggregate debt need must be included');

const incomeSummary = createCIResultImageSummary(
  result,
  'income',
  'ci_planning_v6',
  new Date('2026-08-04T00:00:00.000Z'),
);
equal(incomeSummary.estimationMethod, 'income', 'income export must preserve the selected method enum');
equal(incomeSummary.methodLabel, 'ทุนตามรายได้', 'income export must show the selected method label');
equal(incomeSummary.mainNeedToday, result.incomeBasedNeed, 'income export must use income-derived need');
equal(incomeSummary.shortfall, result.incomeShortfall, 'income export must use the independent income shortfall');
equal(incomeSummary.surplus, result.incomeSurplus, 'income export must use the independent income surplus');
equal(incomeSummary.breakdown, null, 'income export must not attach the unrelated expense breakdown');

const serializedSummary = JSON.stringify(summary);
for (const forbiddenKey of [
  'formData',
  'name',
  'email',
  'phone',
  'age',
  'health',
  'disease',
  'householdMonthly',
  'monthlyIncome',
  'educationPlans',
  'annualCost',
  'yearsRemaining',
  'mortgageDebtNeed',
  'carDebtNeed',
  'otherDebtBalance',
  'multiPayCoverage',
  'utm_source',
  'utm_campaign',
  'fbclid',
  'gclid',
]) {
  assert(!serializedSummary.includes(`\"${forbiddenKey}\"`), `${forbiddenKey} must not enter the image DTO`);
  assert(!JSON.stringify(incomeSummary).includes(`\"${forbiddenKey}\"`), `${forbiddenKey} must not enter the income image DTO`);
}
for (const rawValue of ['12345', '98765', '777777']) {
  assert(!serializedSummary.includes(rawValue), `raw input value ${rawValue} must not enter the image DTO`);
}

const imageSource = readFileSync(new URL('../features/ci-planning/result-image.ts', import.meta.url), 'utf8');
const shareImageSource = readFileSync(new URL('../lib/shared/result-share-image.ts', import.meta.url), 'utf8');
const fhcImageSource = readFileSync(
  new URL('../features/financial-health-check/components/FHCLifeResultImageDownloadButton.tsx', import.meta.url),
  'utf8',
);
const ciResultSource = readFileSync(
  new URL('../features/ci-planning/components/result/CIResult.tsx', import.meta.url),
  'utf8',
);
const ciConstantsSource = readFileSync(new URL('../features/ci-planning/calculator/constants.ts', import.meta.url), 'utf8');
const ciPageSource = readFileSync(new URL('../features/ci-planning/page.tsx', import.meta.url), 'utf8');
const ciLandingSource = readFileSync(
  new URL('../features/ci-planning/components/CILandingIntro.tsx', import.meta.url),
  'utf8',
);
const ciWalkthroughSource = readFileSync(
  new URL('../features/ci-planning/components/CIPreToolWalkthrough.tsx', import.meta.url),
  'utf8',
);
const ciExpensesSource = readFileSync(
  new URL('../features/ci-planning/components/steps/StepExpenses.tsx', import.meta.url),
  'utf8',
);
const ciExistingSource = readFileSync(
  new URL('../features/ci-planning/components/steps/StepExistingCI.tsx', import.meta.url),
  'utf8',
);
const resultImageButtonSource = readFileSync(
  new URL('../features/ci-planning/components/ResultImageDownloadButton.tsx', import.meta.url),
  'utf8',
);
const ciCalculatorSource = readFileSync(new URL('../features/ci-planning/calculator/calculator.ts', import.meta.url), 'utf8');
const ciTypesSource = readFileSync(new URL('../features/ci-planning/calculator/types.ts', import.meta.url), 'utf8');
const analyticsSource = readFileSync(new URL('../lib/analytics.ts', import.meta.url), 'utf8');
const llmsSource = readFileSync(new URL('../public/llms.txt', import.meta.url), 'utf8');
const navConfigSource = readFileSync(new URL('../lib/nav-config.json', import.meta.url), 'utf8');
const ccpunWordmarkSource = readFileSync(
  new URL('../public/assets/ccpun-text-logo.svg', import.meta.url),
  'utf8',
);
for (const source of [ciResultSource, imageSource]) {
  assert(
    source.includes('ค่ารักษาส่วนที่ประกันสุขภาพไม่ครอบคลุม'),
    'CI result and saved image must disclose excluded medical expense differences',
  );
}
for (const networkPrimitive of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket']) {
  assert(!shareImageSource.includes(networkPrimitive), `shared result image module must not use ${networkPrimitive}`);
}
assert(imageSource.includes('/assets/ccpun-text-logo.svg'), 'result image must use the current same-origin CCPUN wordmark');
assert(imageSource.includes('/assets/line-oa-qr.png'), 'result image must include the approved same-origin LINE OA QR');
assert(imageSource.includes('เพิ่มเพื่อน LINE @ccpun'), 'result image must label the LINE OA QR');
assert(ccpunWordmarkSource.includes('viewBox="0 0 124 36"'), 'CCPUN wordmark must retain enough safe area to avoid clipping the N');
assert(!imageSource.includes('เวอร์ชันวิธีประเมิน:'), 'result image must not expose the internal assessment version');
assert(!imageSource.includes("context.fillText('ccpun.com'"), 'result image must remove the obsolete footer signature');
assert(!shareImageSource.includes('#16352f') && shareImageSource.includes('#352727'), 'result image must use the current warm-brown palette');
assert(imageSource.includes('รายได้ต่อเดือน × 12 เดือน × จำนวนปีที่เลือก'), 'income result image must state that the selected duration is in years');
assert(shareImageSource.includes("'image/png'"), 'result image must be encoded as PNG');
assert(imageSource.includes('renderResultShareImage'), 'CI export must use the shared result image renderer');
assert(fhcImageSource.includes('renderResultShareImage'), 'FHC export must use the shared result image renderer');
for (const source of [ciResultSource, imageSource]) {
  assert(
    source.includes('ประมาณการทุนเบื้องต้น'),
    'CI result surfaces must use the required preliminary-estimate heading',
  );
  assert(
    source.includes('ส่วนต่างจากประมาณการ'),
    'CI result surfaces must use the preliminary-estimate difference label',
  );
  assert(
    source.includes('ทุนที่ยังขาด'),
    'CI result surfaces must use the preliminary exact-match message',
  );
  for (const misleadingCopy of ['ทุนที่ควรมีวันนี้', 'ส่วนเกิน', 'เงินก้อนที่ยังขาด']) {
    assert(!source.includes(misleadingCopy), `CI result copy must not contain: ${misleadingCopy}`);
  }
}
assert(!ciConstantsSource.includes('resolveCILineOAUrl'), 'CI external redirect resolver must be removed');
assert(!ciConstantsSource.includes('CI_LINE_OA_FALLBACK_URL'), 'CI fallback/override semantics must be removed');
for (const legacyFhcResolverToken of ['bit.ly', 'NEXT_PUBLIC_LINE_OA_BITLY_URL']) {
  assert(
    !ciConstantsSource.includes(legacyFhcResolverToken),
    `CI constants must not contain legacy FHC resolver token: ${legacyFhcResolverToken}`,
  );
}

for (const requiredLandingCopy of [
  'เครื่องมือวางแผนทุนโรคร้ายแรง · Research Preview',
  'เงินก้อนจากประกันโรคร้ายแรงที่มี ',
  'เพียงพอรับภาระจริงไหม?',
  'วางแผนทุนโรคร้ายแรงจากรายได้และภาระ | CCPun',
  'วางแผนทุนโรคร้ายแรงด้วยเครื่องมือประเมินเบื้องต้น เปรียบเทียบรายได้หรือค่าใช้จ่ายกับเงินก้อนและสินทรัพย์สภาพคล่อง เพื่อเห็นส่วนต่างก่อนทบทวนความคุ้มครอง',
  'เครื่องมือ Research Preview สำหรับเปรียบเทียบทุนตามรายได้หรือรายจ่าย กับเงินก้อนจากประกันโรคร้ายแรงและสินทรัพย์สภาพคล่องที่พร้อมใช้',
  'กรอกรายได้หรือภาระที่ยังต้องดูแล แล้วเทียบกับเงินก้อนจากประกันโรคร้ายแรงและสินทรัพย์สภาพคล่องที่พร้อมใช้',
  'เพราะคำว่า “พอ” ของแต่ละคนไม่เท่ากัน',
  'หลายๆ คน รวมถึงผม พอเริ่มคิดเรื่องทุนประกันโรคร้ายแรง ก็มักติดอยู่กับคำถามเดียวกันว่า “ต้องมีเท่าไรถึงจะพอ?”',
  'เพราะเราไม่รู้ล่วงหน้าว่าโรคร้ายแรงจะเกิดเมื่อไร ต้องพักรักษาตัวนานแค่ไหน หรือรายได้จะหายไปเท่าไร แต่ค่าบ้าน ค่ารถ หนี้บัตรเครดิต ค่าเทอมลูก และค่าใช้จ่ายในครอบครัวยังเดินต่อ',
  'ผมจึงลองแยกรายได้และภาระทีละส่วน วางตามช่วงเวลาที่ต้องรับผิดชอบจริง แล้วเทียบกับเงินก้อนจากประกันโรคร้ายแรงและสินทรัพย์ที่พร้อมใช้ เพื่อให้เห็นที่มาของตัวเลขชัดขึ้น',
  'รายได้ที่หายไป',
  'ถ้าต้องพักรักษาตัวไม่กี่วัน ก็อาจขาดรายได้ไม่กี่วัน แต่ถ้าต้องรักษาตัวหลายเดือน รายได้ที่เคยมีก็อาจหายจนเหลือศูนย์',
  'ค่าบ้าน รถ และภาระค่าใช้จ่ายอื่นๆ',
  'ถ้าเสาหลักต้องหยุดรักษาตัว ค่าบ้าน รถ บัตรเครดิต และสินเชื่อส่วนบุคคลอาจกลายเป็นภาระที่ครอบครัวต้องช่วยกันรับต่อ',
  'ทุนประกันโรคร้ายแรงที่มีอยู่ และสินทรัพย์',
  'ผมจึงเทียบภาระกับทุนประกันโรคร้ายแรง รวมถึงสินทรัพย์ที่พร้อมเปลี่ยนเป็นเงินสดได้เร็ว',
  'เมื่อแยกทีละส่วน คุณจะเห็นที่มาของตัวเลข ภาระส่วนไหนต้องดูแลอีกนาน และเงินก้อนจากประกันโรคร้ายแรงที่มีอยู่ช่วยรองรับได้เพียงใด',
  'เทียบกับเงินก้อนจากประกันโรคร้ายแรงและสินทรัพย์สภาพคล่อง',
  'เริ่มจากรายได้และภาระที่ยังต้องดูแล',
]) {
  assert(
    ciPageSource.includes(requiredLandingCopy) || ciLandingSource.includes(requiredLandingCopy),
    `lean CI landing must contain: ${requiredLandingCopy}`,
  );
}
assert(!ciLandingSource.includes('คำถามที่ไม่มีคำตอบเดียว'), 'lean CI landing must remove the deleted eyebrow');
assert(ciPageSource.includes('highlightOnNewLine'), 'CI hero highlight must start on its own line');
assert(!ciPageSource.includes('· Beta'), 'CI Research Preview must not retain the Beta label');
assert(!navConfigSource.includes('วางแผนเงินก้อนโรคร้ายแรง (Beta)'), 'CI navigation must not retain the Beta label');
for (const activeCiSource of [ciPageSource, ciExpensesSource, ciExistingSource, ciResultSource, ciCalculatorSource, ciTypesSource]) {
  assert(!/เงินเฟ้อ|inflation/i.test(activeCiSource), 'active CI scope must not retain inflation code or copy');
  assert(!/multiPay|Multi-pay|ความคุ้มครองโรคร้ายแรงที่อาจจ่ายได้หลายครั้ง/.test(activeCiSource), 'active CI scope must not retain Multi-pay');
}
equal(
  (ciWalkthroughSource.match(/href="#ci-calculator"/g) ?? []).length,
  1,
  'lean CI landing must have exactly one pre-calculator anchor',
);
equal(
  (ciWalkthroughSource.match(/gold-button/g) ?? []).length,
  1,
  'lean CI landing must have exactly one pre-calculator gold CTA',
);
for (const storyImage of [
  '/assets/ci-story-income-v6.webp',
  '/assets/ci-story-debt-v6.webp',
  '/assets/ci-story-coverage-v6.webp',
]) {
  equal(
    (ciLandingSource.match(new RegExp(storyImage.replace(/\//g, '\\/'), 'g')) ?? []).length,
    1,
    `lean CI landing must declare the distinct story image once: ${storyImage}`,
  );
}
assert(!ciLandingSource.includes('/assets/ci-planning-consultation-v1.webp'), 'lean CI landing must not repeat the legacy composite image');
assert(ciLandingSource.includes('src={beat.src}'), 'lean CI landing must map one image source per story beat');
for (const approvedImageAlt of [
  'ภาพประกอบผู้รับการรักษาด้วยคีโมกำลังทบทวนค่าใช้จ่ายกับคู่ชีวิต ขณะที่งานและรายได้อาจหยุดลง',
  'ภาพประกอบครอบครัวกำลังทบทวนค่างวดบ้าน รถ และค่าใช้จ่ายที่ยังต้องดูแล',
  'ภาพประกอบครอบครัวหลายวัยกำลังทบทวนเงินก้อนจากประกันโรคร้ายแรงและสินทรัพย์ที่พร้อมใช้',
]) {
  assert(ciLandingSource.includes(approvedImageAlt), `lean CI landing must keep the approved image alt: ${approvedImageAlt}`);
}
assert(
  ciLandingSource.includes('ภาพประกอบสร้างด้วย Generative AI'),
  'lean CI landing must disclose the Generative AI image',
);
equal(
  (ciLandingSource.match(/ภาพประกอบสร้างด้วย Generative AI/g) ?? []).length,
  1,
  'Generative AI caption must appear exactly once',
);
assert(!ciLandingSource.includes('<figure'), 'lean CI landing must not contain a standalone image figure');
assert(!ciLandingSource.includes('rounded-full'), 'lean CI landing must not restore image chips');
assert(
  ciExpensesSource.includes('หนี้อื่นๆ คงเหลือทั้งหมด'),
  'Step 1 must use the exact other-debt field label',
);
assert(ciExpensesSource.includes('id="ci-other-debt-balance"'), 'Step 1 must expose a stable other-debt field id');
assert(
  ciExpensesSource.includes('ค่างวดบ้านและรถนับตามงวดที่เหลือภายในช่วงที่เลือก ส่วนหนี้อื่นนับจากยอดคงเหลือครั้งเดียว'),
  'Step 1 must explain debt treatment concisely',
);
assert(ciExpensesSource.includes('id="ci-monthly-income"'), 'Step 1 must expose an accessible monthly-income field');
assert(ciExistingSource.includes('id="ci-liquid-assets"'), 'Step 2 must expose a stable liquid-assets field');
assert(ciExistingSource.includes('placeholder="เช่น 500,000"'), 'liquid-assets currency field must use a short numeric example');
assert(ciExistingSource.includes('บ้าน รถ หรือทรัพย์สินจำเป็นที่ไม่ตั้งใจขายไม่ต้องกรอก'), 'short numeric examples must retain the asset inclusion guidance');
assert(ciExpensesSource.includes('placeholder="เช่น 100,000"'), 'other-debt currency field must use a short numeric example');
assert(ciExistingSource.includes('เงินก้อนจากประกันโรคร้ายแรงที่มี'), 'Step 2 must retain the existing CI lump-sum field');
assert(
  ciExpensesSource.includes('รายได้ ภาระ และระยะที่ต้องการวางแผน')
    && ciExpensesSource.includes('อย่างน้อยกรอกรายได้ หรือค่าใช้จ่ายและภาระ 1 รายการ ช่องอื่นเว้นได้'),
  'Step 1 must use the approved heading and subtitle',
);
assert(
  ciExpensesSource.includes('กรอกเมื่อต้องการดูทุนตามรายได้ ระบบจะแสดงแยกจากทุนตามรายจ่าย'),
  'monthly-income field must explain that methods stay separate',
);
assert(!analyticsSource.includes("'monthlyIncome'"), 'raw monthly income must never enter the analytics allowlist');
assert(!analyticsSource.includes("'otherDebtBalance'"), 'raw other debt must never enter the analytics allowlist');
for (const source of [ciExpensesSource, ciResultSource]) {
  assert(source.includes('ภาระหนี้รวม'), 'CI debt surfaces must use the aggregate debt label');
}
for (const source of [ciResultSource, imageSource]) {
  assert(source.includes('สินทรัพย์สภาพคล่อง'), 'CI result surfaces must show liquid assets');
}
assert(!ciResultSource.includes('ดูวิธีคิดและข้อจำกัด'), 'CI result must not restore the expanded formula section');
assert(!ciPageSource.includes('ข้อมูลของคุณทำงานอย่างไรในเครื่องมือนี้'), 'CI landing must remove the privacy explainer section');
assert(ciPageSource.includes('"@type": "FAQPage"'), 'CI page must include FAQPage schema');
assert(
  ciPageSource.includes('mainEntity: CI_FAQS.map')
    && ciPageSource.includes('{CI_FAQS.map((faq) =>'),
  'visible FAQ and FAQPage schema must share CI_FAQS',
);
assert(
  ciResultSource.includes("if (result.calculatedNeed > 0) return 'expense'")
    && ciResultSource.includes("if (result.incomeBasedNeed > 0) return 'income'"),
  'result method must default to expense when available and fall back to income for income-only planning',
);
assert(ciResultSource.includes('result.incomeBasedNeed > 0'), 'income selector must only appear when income-derived need is positive');
assert(ciResultSource.includes('ระบบแสดงสองวิธีแยกกันและไม่นำมาบวกกัน'), 'result must prohibit combining the two methods');
assert(
  resultImageButtonSource.includes('selectedMethod={activeMethod}')
    || ciResultSource.includes('selectedMethod={activeMethod}'),
  'result download must receive the selected method',
);
assert(
  resultImageButtonSource.includes('createCIResultImageSummary(result, selectedMethod, CI_ASSESSMENT_VERSION)'),
  'result download must export the selected method',
);

const ciLlmsLine = llmsSource.split('\n').find((line) => line.includes('[CI Planning]'));
assert(ciLlmsLine, 'llms.txt must include the CI Planning entry');
assert(ciLlmsLine.includes('ประมาณการเบื้องต้น'), 'CI llms entry must use preliminary-estimate wording');
for (const staleLlmsPhrase of ['ที่ควรมี', 'จากรายได้']) {
  assert(!ciLlmsLine.includes(staleLlmsPhrase), `CI llms entry must not contain: ${staleLlmsPhrase}`);
}
for (const requiredComplianceCopy of [
  'ได้เลขทุนแล้ว ต้องทำอย่างไรต่อ?',
  'ทุนตามรายได้กับทุนตามรายจ่ายต่างกันอย่างไร?',
  'ทุนตามรายได้ดูจากรายได้ต่อเดือนและระยะเวลาที่เลือก ส่วนทุนตามรายจ่ายดูจากค่าใช้จ่ายครอบครัว ค่าเรียน ค่างวด และหนี้ที่เหลือ ระบบแสดงแยกกันและไม่นำมาบวกกัน',
  'เครื่องมือแสดงสองวิธีแยกกัน ไม่นำมาบวกกัน แล้วเทียบกับเงินก้อนจากประกันโรคร้ายแรงและสินทรัพย์สภาพคล่องที่พร้อมใช้',
  'สินทรัพย์สภาพคล่องควรกรอกอะไรบ้าง?',
]) {
  assert(ciPageSource.includes(requiredComplianceCopy), `CI page must contain: ${requiredComplianceCopy}`);
}
for (const removedLowerCopy of ['ระบบส่งจำนวนเงินหรือคำตอบที่กรอกไปยัง GA4 หรือ Meta หรือไม่?', 'เครื่องมือนี้เหมาะกับใคร — และไม่ใช้แทนอะไร']) {
  assert(!ciPageSource.includes(removedLowerCopy), `CI page must remove confusing lower copy: ${removedLowerCopy}`);
}
for (const removedFormulaExample of ['20,000 บาท × 12 เดือน', '726,000 บาท', '326,000 บาท']) {
  assert(!ciPageSource.includes(removedFormulaExample), `CI landing must remove detailed formula example: ${removedFormulaExample}`);
}
assert(
  llmsSource.includes('- [LINE Official Account](https://lin.ee/tqLCs4f): เพิ่มเพื่อน LINE @ccpun'),
  'llms.txt must use the approved LINE Official Account CTA',
);
assert(!llmsSource.includes('LINE OpenChat:'), 'llms.txt must not expose the stale LINE OpenChat CTA');
assert(!llmsSource.includes('- โทรศัพท์:'), 'llms.txt must not expose a phone CTA');
assert(ciLlmsLine.includes('หนี้อื่นคงเหลือ'), 'CI llms entry must document other remaining debt');
assert(!ciPageSource.includes('3 ล้านบาท'), 'CI page must not present a fixed 3M floor');
assert(!ciPageSource.includes('bit.ly'), 'CI page must use direct LINE only');

console.log('result action regression checks passed');
