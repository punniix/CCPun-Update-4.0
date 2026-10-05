import type { MoneyEvent, ProtectionType } from './types';
import { PROTECTION_CATALOG } from './config';

type SpendSeed = readonly [string, string, string, number];

function spendEvents(
  category: MoneyEvent['category'],
  seeds: readonly SpendSeed[],
  prefix = category,
): MoneyEvent[] {
  return seeds.map(([id, title, text, amount], index) => ({
    id: prefix + '-' + id,
    category,
    title,
    text,
    weight: 5,
    cooldown: 2,
    options: [
      {
        id: 'full',
        label: 'จัดเต็ม',
        outcomeText: 'ได้สิ่งที่เลือก และเงินสดลดลง',
        effect: { cashDelta: -amount },
      },
      {
        id: 'trim',
        label: 'ลดงบ',
        outcomeText: 'ยังจัดการเรื่องนี้ได้ด้วยงบเล็กลง',
        effect: { cashDelta: -Math.max(300, Math.round((amount * 0.4) / 100) * 100) },
      },
      {
        id: 'skip',
        label: index % 3 === 0 ? 'ผ่านก่อน' : 'ยังไม่เอา',
        outcomeText: 'เงินยังอยู่กับเรา',
        effect: {},
      },
    ],
  }));
}

const everyday = spendEvents('everyday', [
  ['shipping', 'ซื้อเพิ่มอีก 900 เพื่อประหยัดค่าส่ง 40', 'ตะกร้ากำลังเสนอแผนการเงินที่มั่นใจมาก', 900],
  ['coffee-machine', 'ไปซื้อกาแฟ ได้เครื่องชง', 'ตั้งใจซื้อกาแฟแก้วเดียว แต่เครื่องชงดูเหมือนจะรู้จักเราเป็นการส่วนตัว', 4200],
  ['subscription', 'ทดลองฟรีที่จริงจังกับเรา', 'แอปที่เคยทดลองฟรีกำลังต่ออายุแบบเต็มราคา', 1290],
  ['flash-sale', 'Flash Sale ใกล้หมดเวลา', 'ของที่เล็งมานานลดราคา และความเร่งรีบกำลังช่วยตัดสินใจแทนเรา', 3500],
  ['friend-trip', 'ทริปนี้ต้องไปแล้วไหม', 'เพื่อนเปิดกรุ๊ปเที่ยวสุดสัปดาห์ และทุกคนตอบเร็วมาก', 6500],
  ['wedding-season', 'เดือนแห่งซอง', 'ปฏิทินดูเหมือนจะมีงานแต่งมากกว่าวันหยุด', 3200],
  ['delivery-week', 'สัปดาห์ที่แอปส่งอาหารจำชื่อเราได้', 'สะดวกมาก จนยอดรวมเริ่มสะดวกเกินไป', 1800],
  ['upgrade-phone', 'มือถือยังใช้ได้ แต่รุ่นใหม่ออกแล้ว', 'ของเดิมยังทำงานครบ แต่กล้องใหม่ดูน่าสนใจเป็นพิเศษ', 12000],
  ['concert', 'ศิลปินที่รอมาจัดคอนเสิร์ต', 'โอกาสไม่ได้มาทุกเดือน แต่ราคาบัตรก็มาครบทุกบาท', 4800],
  ['gift-season', 'ของขวัญหลายบ้านในเดือนเดียว', 'ความตั้งใจดีหลายก้อนมาชนกันในปฏิทินเดียว', 4000],
  ['late-night-cart', 'ตะกร้าตอนตีหนึ่ง', 'ของบางอย่างดูจำเป็นขึ้นมากหลังเที่ยงคืน', 2400],
  ['premium-seat', 'เพิ่มอีกนิดได้นั่งสบายขึ้น', 'คำว่า “เพิ่มอีกนิด” กำลังทำงานหนักมาก', 1600],
  ['collectible', 'ของสะสมดรอปรอบใหม่', 'ใจบอกว่าหายาก ตะกร้าบอกว่าพร้อมจ่าย', 2900],
  ['weekend-cafe', 'คาเฟ่เปิดใหม่สามร้านในรัศมีเดียวกัน', 'วันหยุดกำลังเสนอแพ็กเกจทดสอบให้ครบ', 2100],
] as const);

const household: MoneyEvent[] = [
  {
    id: 'household-repair-small',
    category: 'household',
    title: 'ของใช้ในบ้านเริ่มมีปัญหา',
    text: 'ยังใช้ต่อได้ แต่ควรจัดการก่อนจะเสียหนักกว่าเดิม',
    weight: 5,
    cooldown: 2,
    options: [
      { id: 'repair', label: 'ซ่อมตอนนี้', outcomeText: 'แก้ให้จบตอนนี้ด้วยค่าใช้จ่ายที่สูงกว่า', effect: { cashDelta: -2800 } },
      { id: 'patch', label: 'แก้เฉพาะจุดก่อน', outcomeText: 'ลดเงินที่ต้องจ่ายวันนี้ แต่ยังต้องเผื่อซ่อมต่อ', effect: { cashDelta: -1100 } },
    ],
  },
  {
    id: 'household-electric',
    category: 'household',
    title: 'ค่าไฟเดือนนี้สูงกว่าปกติ',
    text: 'อากาศร้อนและเครื่องใช้ไฟฟ้าทำงานหนักขึ้น',
    weight: 5,
    cooldown: 2,
    options: [
      { id: 'pay', label: 'จ่ายตามบิล', outcomeText: 'รับค่าใช้จ่ายที่สูงขึ้นในเดือนนี้', effect: { cashDelta: -2200 } },
      { id: 'cut', label: 'ลดการใช้ไฟเดือนนี้', outcomeText: 'ลดค่าใช้จ่ายส่วนเพิ่มลงได้บางส่วน', effect: { cashDelta: -1200 } },
    ],
  },
  {
    id: 'household-internet',
    category: 'household',
    title: 'แพ็กเกจเน็ตบ้านหมดโปร',
    text: 'ราคาใหม่สูงกว่าเดิม และต้องเลือกว่าจะใช้ต่อหรือปรับแพ็กเกจ',
    weight: 5,
    cooldown: 2,
    options: [
      { id: 'keep', label: 'ใช้แพ็กเกจเดิมต่อ', outcomeText: 'จ่ายเพิ่มเพื่อคงบริการเดิม', effect: { cashDelta: -900 } },
      { id: 'downgrade', label: 'ลดแพ็กเกจ', outcomeText: 'ลดค่าใช้จ่ายลง แลกกับบริการที่น้อยลง', effect: { cashDelta: -400 } },
    ],
  },
  {
    id: 'household-cleaning',
    category: 'household',
    title: 'งานบ้านกองจนต้องเลือก',
    text: 'จะจ่ายเพื่อประหยัดเวลา หรือใช้เวลาจัดการเอง',
    weight: 5,
    cooldown: 2,
    options: [
      { id: 'hire', label: 'จ้างคนช่วย', outcomeText: 'เสียเงิน แต่ได้เวลาและแรงกลับมา', effect: { cashDelta: -1800 } },
      { id: 'self', label: 'จัดการเอง', outcomeText: 'ไม่เสียเงินเพิ่ม แต่ใช้เวลาและแรงของตัวเอง', effect: {} },
    ],
  },
  {
    id: 'household-appliance',
    category: 'household',
    title: 'เครื่องใช้ไฟฟ้าหลายชิ้นเริ่มหมดอายุ',
    text: 'บางชิ้นควรเปลี่ยน บางชิ้นยังพอซ่อมเพื่อยืดอายุได้',
    weight: 5,
    cooldown: 2,
    options: [
      { id: 'replace', label: 'เปลี่ยนชิ้นที่จำเป็น', outcomeText: 'จ่ายมากกว่าเพื่อจบปัญหาหลัก', effect: { cashDelta: -5200 } },
      { id: 'repair', label: 'ซ่อมและยืดอายุ', outcomeText: 'ลดเงินก้อนที่ต้องจ่ายวันนี้', effect: { cashDelta: -2200 } },
    ],
  },
  {
    id: 'household-maintenance',
    category: 'household',
    title: 'มีรายการบำรุงรักษาที่ควรทำ',
    text: 'เลื่อนได้ไม่นาน เพราะปล่อยไว้อาจกลายเป็นค่าใช้จ่ายก้อนใหญ่กว่าเดิม',
    weight: 5,
    cooldown: 2,
    options: [
      { id: 'repair', label: 'จัดการให้เรียบร้อย', outcomeText: 'จ่ายตอนนี้เพื่อปิดรายการที่ต้องซ่อม', effect: { cashDelta: -3500 } },
      { id: 'essential', label: 'ทำเฉพาะส่วนจำเป็น', outcomeText: 'ลดค่าใช้จ่ายวันนี้ แต่ยังเหลืองานบางส่วนไว้', effect: { cashDelta: -1400 } },
    ],
  },
  {
    id: 'household-moving-box',
    category: 'household',
    title: 'พื้นที่ในบ้านเริ่มไม่พอ',
    text: 'ของเยอะขึ้น จึงต้องเลือกระหว่างซื้อพื้นที่เก็บเพิ่มกับจัดของใหม่',
    weight: 5,
    cooldown: 2,
    options: [
      { id: 'storage', label: 'ซื้อชั้นเก็บของเพิ่ม', outcomeText: 'ใช้เงินเพื่อเพิ่มพื้นที่จัดเก็บ', effect: { cashDelta: -1600 } },
      { id: 'declutter', label: 'จัดของที่มีใหม่', outcomeText: 'ยังไม่เสียเงินเพิ่ม', effect: {} },
    ],
  },
  {
    id: 'household-utility-deposit',
    category: 'household',
    title: 'มีค่าใช้จ่ายบ้านที่ต้องจ่ายเดือนนี้',
    text: 'เป็นเงินก้อนที่ไม่ได้อยู่ในแผน แต่เลี่ยงไม่ได้',
    weight: 5,
    cooldown: 2,
    options: [
      { id: 'pay', label: 'จ่ายเต็มเดือนนี้', outcomeText: 'ปิดค่าใช้จ่ายก้อนนี้ทันที', effect: { cashDelta: -3000 } },
      { id: 'split', label: 'แบ่งจ่าย 2 เดือน', outcomeText: 'ลดเงินก้อนวันนี้ แต่มีภาระต่ออีกเดือน', effect: { cashDelta: -1500, expenseModifier: { amount: 1500, months: 1, label: 'ค่าใช้จ่ายบ้านค้างจ่าย' } } },
    ],
  },
  {
    id: 'household-laundry',
    category: 'household',
    title: 'เครื่องซักผ้าเริ่มมีอาการ',
    text: 'ยังใช้งานได้ แต่มีสัญญาณว่าควรซ่อมก่อนจะเสียหนัก',
    weight: 5,
    cooldown: 2,
    options: [
      { id: 'repair', label: 'เรียกช่างซ่อม', outcomeText: 'จ่ายเพื่อแก้ปัญหาตอนนี้', effect: { cashDelta: -2400 } },
      { id: 'basic', label: 'ซ่อมเฉพาะจุด', outcomeText: 'ลดค่าใช้จ่ายลง แต่ยังไม่ได้แก้ทุกจุด', effect: { cashDelta: -900 } },
    ],
  },
  {
    id: 'household-internet-backup',
    category: 'household',
    title: 'วันสำคัญเน็ตล่ม',
    text: 'ต้องเลือกหาทางเชื่อมต่อสำรอง หรือย้ายไปทำงานที่อื่น',
    weight: 5,
    cooldown: 2,
    options: [
      { id: 'backup', label: 'ซื้อเน็ตสำรอง', outcomeText: 'จ่ายเพิ่มเพื่อให้งานเดินต่อได้ทันที', effect: { cashDelta: -1200 } },
      { id: 'relocate', label: 'ย้ายไปทำงานที่อื่น', outcomeText: 'เสียค่าเดินทางและค่าใช้สถานที่น้อยกว่า', effect: { cashDelta: -400 } },
    ],
  },
];

const work: MoneyEvent[] = [
  {
    id: 'work-bonus',
    category: 'work',
    title: 'โบนัสเล็กๆ มาแล้ว',
    text: 'บริษัทมีเงินพิเศษให้เดือนนี้',
    weight: 5,
    options: [
      { id: 'cash', label: 'เก็บไว้ก่อน', outcomeText: 'เงินพร้อมใช้เพิ่มขึ้น', effect: { cashDelta: 12000 } },
      { id: 'invest', label: 'แบ่งไปลงทุน', outcomeText: 'แบ่งโบนัสเป็นเงินสดและเงินลงทุน', effect: { cashDelta: 12000, investmentDelta: 8000 } },
    ],
  },
  {
    id: 'work-overtime',
    category: 'work',
    title: 'งานพิเศษเข้ามา',
    text: 'มีโอกาสรับงานเพิ่มช่วงสั้นๆ',
    weight: 5,
    options: [
      { id: 'take', label: 'รับงาน', outcomeText: 'รายได้เพิ่มเดือนนี้', effect: { cashDelta: 6000 } },
      { id: 'skip', label: 'พักก่อน', outcomeText: 'ไม่เพิ่มรายได้และไม่เพิ่มงาน', effect: {} },
    ],
  },
  {
    id: 'work-raise',
    category: 'work',
    title: 'รายได้ฐานเพิ่มขึ้น',
    text: 'ผลงานช่วงที่ผ่านมาเปลี่ยนรายได้ในอีกหลายเดือน',
    weight: 3,
    requirements: { minMonth: 4 },
    options: [
      { id: 'accept', label: 'รับการปรับรายได้', outcomeText: 'รายได้ฐานสูงขึ้นช่วงที่เหลือ', effect: { incomeModifier: { percent: 0.1, months: 8, label: 'รายได้ปรับขึ้น' } } },
    ],
  },
  {
    id: 'work-client-late',
    category: 'work',
    title: 'ลูกค้าขอเลื่อนวันจ่าย',
    text: 'เงินยังมา แต่ช้ากว่าที่คิดหนึ่งเดือน',
    weight: 4,
    requirements: { stabilities: ['variable', 'business'] },
    options: [
      { id: 'wait', label: 'ใช้เงินสำรองรอ', outcomeText: 'รายได้เดือนนี้ลดลงชั่วคราว', effect: { incomeModifier: { percent: -0.28, months: 1, label: 'รายได้เลื่อน' } } },
      { id: 'discount', label: 'รับเร็วแต่ลดนิดหน่อย', outcomeText: 'ได้เงินบางส่วนเข้ามาทันที', effect: { cashDelta: 7000 } },
    ],
  },
  {
    id: 'work-new-skill',
    category: 'work',
    title: 'คอร์สที่ช่วยเพิ่มทักษะ',
    text: 'ต้องจ่ายวันนี้ แต่ทักษะที่ได้จะเพิ่มฐานรายได้ตั้งแต่เดือนหน้าไปจนจบเกม',
    weight: 4,
    options: [
      { id: 'pay', label: 'เรียนด้วยเงินที่มี', outcomeText: 'ลงทุนกับทักษะและเพิ่มฐานรายได้ระยะยาว', effect: { cashDelta: -8000, incomeModifier: { percent: 0.08, throughEnd: true, label: 'ทักษะใหม่' } } },
      { id: 'borrow', label: 'กู้เพื่อเรียน', outcomeText: 'รักษาเงินสดบางส่วนไว้ แต่มีค่างวดเพิ่ม แลกกับฐานรายได้ที่สูงขึ้น', effect: { borrow: { principal: 10000, monthlyRate: 0.0075, termMonths: 12, label: 'เงินกู้เพื่อทักษะ' }, cashDelta: -8000, incomeModifier: { percent: 0.08, throughEnd: true, label: 'ทักษะใหม่' } } },
      { id: 'skip', label: 'ยังไม่เรียน', outcomeText: 'ยังไม่เพิ่มต้นทุนหรือรายได้', effect: {} },
    ],
  },
  {
    id: 'work-commission',
    category: 'work',
    title: 'เดือนนี้ผลงานเข้าเป้า',
    text: 'มีรายได้พิเศษจากผลงาน',
    weight: 4,
    options: [
      { id: 'cash', label: 'รับไว้เป็นเงินสด', outcomeText: 'เงินพร้อมใช้เพิ่ม', effect: { cashDelta: 9000 } },
      { id: 'split', label: 'แบ่งครึ่งลงทุน', outcomeText: 'แบ่งเงินสดกับเงินลงทุน', effect: { cashDelta: 9000, investmentDelta: 4500 } },
    ],
  },
  {
    id: 'work-slow-month',
    category: 'work',
    title: 'เดือนนี้งานเงียบลง',
    text: 'รายได้ลดลงชั่วคราวโดยยังมีภาระเดิม',
    weight: 3,
    options: [
      { id: 'adjust', label: 'ลดรายจ่ายเสริม', outcomeText: 'รายได้ลด แต่ชดเชยได้บางส่วน', effect: { incomeModifier: { percent: -0.18, months: 1, label: 'งานเงียบ' }, cashDelta: 1200 } },
      { id: 'normal', label: 'ใช้แผนเดิม', outcomeText: 'รับรายได้ที่ลดลงตามจริง', effect: { incomeModifier: { percent: -0.18, months: 1, label: 'งานเงียบ' } } },
    ],
  },
  {
    id: 'work-side-gig',
    category: 'work',
    title: 'เพื่อนส่งงานเสริมมาให้',
    text: 'งานไม่ใหญ่มาก แต่เป็นรายได้เพิ่ม',
    weight: 5,
    options: [
      { id: 'take', label: 'รับงาน', outcomeText: 'ได้เงินเพิ่มเดือนนี้', effect: { cashDelta: 5000 } },
      { id: 'pass', label: 'ผ่าน', outcomeText: 'ไม่เพิ่มรายได้และไม่เพิ่มงาน', effect: {} },
    ],
  },
  {
    id: 'work-tool',
    category: 'work',
    title: 'เครื่องมือทำงานลดเวลาได้',
    text: 'จ่ายครั้งเดียวเพื่อช่วยให้ทำงานเร็วขึ้นในหลายเดือน',
    weight: 3,
    options: [
      { id: 'buy', label: 'ซื้อ', outcomeText: 'มีต้นทุนวันนี้และช่วยรายได้ช่วงสั้น', effect: { cashDelta: -5500, incomeModifier: { percent: 0.05, months: 4, label: 'ประสิทธิภาพเพิ่ม' } } },
      { id: 'wait', label: 'รอก่อน', outcomeText: 'ไม่เพิ่มต้นทุน', effect: {} },
    ],
  },
  {
    id: 'work-referral',
    category: 'work',
    title: 'มีคนแนะนำลูกค้าใหม่',
    text: 'โอกาสเล็กๆ ที่มาจากความสัมพันธ์เดิม',
    weight: 4,
    options: [
      { id: 'accept', label: 'รับโอกาส', outcomeText: 'รายได้เพิ่ม', effect: { cashDelta: 7500 } },
      { id: 'decline', label: 'ยังไม่พร้อม', outcomeText: 'ข้ามโอกาสนี้', effect: {} },
    ],
  },
];

const health: MoneyEvent[] = [
  { id: 'health-clinic', category: 'health', title: 'ต้องเข้ารับการรักษา', text: 'มีค่าใช้จ่ายทางการแพทย์ที่ต้องจัดการ', weight: 3, sensitive: true, options: [{ id: 'treat', label: 'รับการรักษา', outcomeText: 'ใช้สิทธิที่มีและความคุ้มครองที่เข้าเงื่อนไขก่อนส่วนที่จ่ายเอง', effect: { cost: { amount: 18000, protectionType: 'health' } } }] },
  { id: 'health-hospital', category: 'health', title: 'ต้องพักรักษาตัวในโรงพยาบาล', text: 'เกิดค่าใช้จ่ายก้อนใหญ่กว่าปกติ', weight: 2, sensitive: true, requirements: { minMonth: 2 }, options: [{ id: 'treat', label: 'จัดการค่าใช้จ่าย', outcomeText: 'ใช้สิทธิและความคุ้มครองที่มีตามกติกาจำลอง', effect: { cost: { amount: 72000, protectionType: 'health' } } }] },
  { id: 'health-recovery', category: 'health', title: 'ต้องพักฟื้นและลดงานชั่วคราว', text: 'รายได้ลดลงพร้อมค่าใช้จ่ายเพิ่มเติม', weight: 2, sensitive: true, options: [{ id: 'recover', label: 'พักฟื้น', outcomeText: 'รายได้ลดชั่วคราวและมีค่าใช้จ่ายดูแลตัวเอง', effect: { cost: { amount: 15000, protectionType: 'health' }, incomeModifier: { percent: -0.2, months: 2, label: 'พักฟื้น' } } }] },
  { id: 'health-critical', category: 'health', title: 'ตรวจพบภาวะสุขภาพที่ต้องรักษาต่อเนื่อง', text: 'นอกจากค่ารักษา ยังมีผลต่อรายได้และการฟื้นตัว', weight: 1, sensitive: true, requirements: { minMonth: 4 }, options: [{ id: 'care', label: 'รับมือกับแผนที่มี', outcomeText: 'เงินก้อนความคุ้มครองที่เข้าเงื่อนไขช่วยลดผลกระทบตามกติกาจำลอง', effect: { cost: { amount: 110000, protectionType: 'critical' }, incomeModifier: { percent: -0.25, months: 3, label: 'พักงานเพื่อรักษา' } } }] },
  { id: 'health-dental', category: 'health', title: 'มีค่าดูแลสุขภาพที่วางแผนได้', text: 'ไม่ใช่เหตุฉุกเฉิน แต่เลื่อนนานก็ไม่ดี', weight: 4, options: [{ id: 'now', label: 'ทำเดือนนี้', outcomeText: 'จ่ายจากเงินสด', effect: { cashDelta: -4500 } }, { id: 'plan', label: 'เลือกแบบพื้นฐาน', outcomeText: 'ลดค่าใช้จ่ายลง', effect: { cashDelta: -1500 } }] },
  { id: 'health-checkup', category: 'health', title: 'ถึงรอบตรวจสุขภาพ', text: 'มีค่าใช้จ่ายเล็กน้อยเพื่อเช็กความพร้อม', weight: 4, options: [{ id: 'go', label: 'ตรวจ', outcomeText: 'จ่ายค่าตรวจตามสมมติฐานเกม', effect: { cashDelta: -2200 } }, { id: 'benefit', label: 'ใช้สิทธิที่มี', outcomeText: 'ลดค่าใช้จ่ายได้บางส่วน', effect: { cashDelta: -600 } }] },
  { id: 'health-care', category: 'health', title: 'ช่วงนี้ร่างกายล้า', text: 'มีทางเลือกดูแลตัวเองแบบใช้งบต่างกัน', weight: 3, options: [{ id: 'pro', label: 'เลือกบริการเต็มรูปแบบ', outcomeText: 'ใช้เงินมากขึ้นเพื่อดูแลตัวเอง', effect: { cashDelta: -3200 } }, { id: 'basic', label: 'เลือกแบบพื้นฐาน', outcomeText: 'ดูแลตัวเองด้วยงบเล็กลง', effect: { cashDelta: -900 } }] },
  { id: 'health-glasses', category: 'health', title: 'แว่นถึงเวลาต้องเปลี่ยน', text: 'ของเดิมเริ่มไม่ตอบโจทย์การใช้งาน', weight: 3, options: [{ id: 'replace', label: 'เปลี่ยน', outcomeText: 'จ่ายค่าใช้จ่ายจำเป็น', effect: { cashDelta: -3800 } }, { id: 'basic', label: 'เลือกรุ่นพื้นฐาน', outcomeText: 'ลดงบลง', effect: { cashDelta: -1800 } }] },
];

const motor: MoneyEvent[] = [
  { id: 'motor-air', category: 'motor', title: 'รถยังวิ่งได้ แต่แอร์เลือกลาออกก่อน', text: 'เป็นค่าบำรุงรักษาปกติ ไม่ใช่อุบัติเหตุ', weight: 4, requirements: { hasCar: true }, options: [{ id: 'fix', label: 'ซ่อมเลย', outcomeText: 'จ่ายค่าซ่อมเองตามปกติ', effect: { cashDelta: -6500 } }, { id: 'basic', label: 'ซ่อมเท่าที่จำเป็น', outcomeText: 'ลดค่าใช้จ่ายลง', effect: { cashDelta: -3500 } }] },
  { id: 'motor-tire', category: 'motor', title: 'ยางถึงรอบเปลี่ยน', text: 'ค่าใช้จ่ายดูธรรมดา แต่เลี่ยงนานไม่ค่อยดี', weight: 4, requirements: { hasCar: true }, options: [{ id: 'replace', label: 'เปลี่ยนชุดที่เหมาะสม', outcomeText: 'จ่ายค่าบำรุงรักษา', effect: { cashDelta: -12000 } }, { id: 'budget', label: 'เลือกทางประหยัด', outcomeText: 'ลดค่าใช้จ่ายแต่ยังจัดการเรื่องจำเป็น', effect: { cashDelta: -7500 } }] },
  { id: 'motor-battery', category: 'motor', title: 'แบตรถหมดกะทันหัน', text: 'ต้องแก้ก่อนเดินทางต่อ', weight: 4, requirements: { hasCar: true }, options: [{ id: 'replace', label: 'เปลี่ยนแบต', outcomeText: 'จ่ายค่าบำรุงรักษา', effect: { cashDelta: -3800 } }] },
  { id: 'motor-minor-accident', category: 'motor', title: 'เกิดอุบัติเหตุรถเล็กน้อย', text: 'มีความเสียหายที่ต้องรับผิดชอบตามสถานการณ์', weight: 2, sensitive: true, requirements: { hasCar: true }, options: [{ id: 'handle', label: 'จัดการความเสียหาย', outcomeText: 'ความคุ้มครองรถช่วยเฉพาะส่วนที่เข้าเงื่อนไขจำลอง', effect: { cost: { amount: 32000, protectionType: 'motor' } } }] },
  { id: 'motor-accident', category: 'motor', title: 'เกิดอุบัติเหตุรถที่มีความเสียหายสูง', text: 'เหตุการณ์นี้มีค่าใช้จ่ายก้อนใหญ่และต้องจัดการอย่างจริงจัง', weight: 1, sensitive: true, requirements: { hasCar: true, minMonth: 3 }, options: [{ id: 'handle', label: 'จัดการความเสียหาย', outcomeText: 'ใช้ความคุ้มครองรถที่เข้าเงื่อนไขก่อนส่วนที่ต้องจ่ายเอง', effect: { cost: { amount: 95000, protectionType: 'motor' } } }] },
  { id: 'motor-parking', category: 'motor', title: 'ค่าจอดรถขึ้นราคา', text: 'รายจ่ายเล็กๆ กำลังขอเป็นสมาชิกประจำ', weight: 3, requirements: { hasCar: true }, options: [{ id: 'pay', label: 'จ่ายตามเดิม', outcomeText: 'ค่าใช้จ่ายเพิ่มหลายเดือน', effect: { expenseModifier: { amount: 900, months: 4, label: 'ค่าจอดรถเพิ่ม' } } }, { id: 'switch', label: 'เปลี่ยนที่จอด', outcomeText: 'มีค่าใช้จ่ายย้ายครั้งเดียว', effect: { cashDelta: -1200 } }] },
  { id: 'motor-service', category: 'motor', title: 'ถึงรอบเช็กระยะ', text: 'ถึงรอบค่าบำรุงรักษาตามปกติ', weight: 4, requirements: { hasCar: true }, options: [{ id: 'service', label: 'เข้าศูนย์/อู่ตามแผน', outcomeText: 'จ่ายค่าบำรุงรักษา', effect: { cashDelta: -4800 } }] },
  { id: 'motor-fuel', category: 'motor', title: 'ค่าเดินทางเดือนนี้สูงขึ้น', text: 'เส้นทางเดิม แต่ต้นทุนไม่เท่าเดิม', weight: 3, requirements: { hasCar: true }, options: [{ id: 'normal', label: 'ใช้รถตามเดิม', outcomeText: 'ค่าใช้จ่ายเพิ่มชั่วคราว', effect: { expenseModifier: { amount: 1600, months: 2, label: 'ค่าเดินทางเพิ่ม' } } }, { id: 'mix', label: 'สลับไปใช้ขนส่งสาธารณะ', outcomeText: 'เพิ่มค่าใช้จ่ายน้อยกว่า', effect: { expenseModifier: { amount: 600, months: 2, label: 'ค่าเดินทางเพิ่มเล็กน้อย' } } }] },
];

const home: MoneyEvent[] = [
  { id: 'home-leak', category: 'home', title: 'บ้านมีจุดรั่วที่ต้องซ่อม', text: 'ความเสียหายเริ่มจากเล็ก แต่ปล่อยไว้อาจลาม', weight: 3, requirements: { hasHome: true }, options: [{ id: 'fix', label: 'ซ่อมทันที', outcomeText: 'จ่ายค่าซ่อมบ้านทั่วไป', effect: { cashDelta: -9000 } }, { id: 'patch', label: 'แก้ชั่วคราว', outcomeText: 'จ่ายน้อยลงตอนนี้ แต่มีค่าใช้จ่ายต่อเนื่อง', effect: { cashDelta: -2500, expenseModifier: { amount: 1800, months: 3, label: 'ซ่อมชั่วคราว' } } }] },
  { id: 'home-storm', category: 'home', title: 'พายุทำให้ทรัพย์สินเสียหาย', text: 'มีความเสียหายก้อนหนึ่งที่ต้องจัดการ', weight: 1, sensitive: true, requirements: { hasHome: true }, options: [{ id: 'repair', label: 'จัดการความเสียหาย', outcomeText: 'ใช้ความคุ้มครองบ้านที่เข้าเงื่อนไขจำลองก่อนส่วนที่จ่ายเอง', effect: { cost: { amount: 85000, protectionType: 'home' } } }] },
  { id: 'home-electrical', category: 'home', title: 'ระบบไฟในบ้านต้องซ่อม', text: 'เป็นรายการที่ควรจัดการเพื่อความปลอดภัย', weight: 2, requirements: { hasHome: true }, options: [{ id: 'repair', label: 'ซ่อม', outcomeText: 'จ่ายค่าซ่อมเอง', effect: { cashDelta: -14000 } }] },
  { id: 'home-security', category: 'home', title: 'อยากเพิ่มความปลอดภัยให้บ้าน', text: 'เป็นค่าใช้จ่ายที่เลือกได้ ไม่ใช่เหตุฉุกเฉิน', weight: 2, requirements: { hasHome: true }, options: [{ id: 'do', label: 'ติดตั้ง', outcomeText: 'จ่ายเพื่อปรับบ้าน', effect: { cashDelta: -8000 } }, { id: 'later', label: 'ไว้ก่อน', outcomeText: 'ไม่เพิ่มค่าใช้จ่ายเดือนนี้', effect: {} }] },
  { id: 'home-fee', category: 'home', title: 'มีค่าดูแลทรัพย์สินประจำปี', text: 'ไม่ได้เกิดทุกเดือน แต่เดือนนี้ถึงรอบ', weight: 3, requirements: { hasHome: true }, options: [{ id: 'pay', label: 'จ่าย', outcomeText: 'เงินสดลดตามค่าใช้จ่าย', effect: { cashDelta: -6000 } }] },
  { id: 'home-appliance', category: 'home', title: 'เครื่องใช้ชิ้นใหญ่ในบ้านเสีย', text: 'ต้องเลือกซ่อมหรือเปลี่ยน', weight: 3, requirements: { hasHome: true }, options: [{ id: 'repair', label: 'ซ่อม', outcomeText: 'ซ่อมเรียบร้อยและใช้เงินน้อยกว่าการเปลี่ยนใหม่', effect: { cashDelta: -5500 } }, { id: 'replace', label: 'เปลี่ยนใหม่', outcomeText: 'เปลี่ยนใหม่และจบค่าใช้จ่ายก้อนนี้', effect: { cashDelta: -15000 } }] },
];

const family: MoneyEvent[] = [
  { id: 'family-school', category: 'family', title: 'มีค่าใช้จ่ายของคนในครอบครัวเพิ่ม', text: 'ภาระที่ต้องดูแลเพิ่มขึ้นในเดือนนี้', weight: 3, requirements: { dependents: true }, options: [{ id: 'pay', label: 'ดูแลตามแผน', outcomeText: 'เงินสดลดลง', effect: { cashDelta: -7000 } }, { id: 'spread', label: 'แบ่งจ่ายหลายเดือน', outcomeText: 'ลดเงินก้อนวันนี้ แต่เพิ่มภาระชั่วคราว', effect: { cashDelta: -2500, expenseModifier: { amount: 1800, months: 3, label: 'ค่าใช้จ่ายครอบครัว' } } }] },
  { id: 'family-activity', category: 'family', title: 'กิจกรรมพิเศษของครอบครัว', text: 'เป็นความสุขที่มีต้นทุนและเลือกขนาดได้', weight: 4, requirements: { dependents: true }, options: [{ id: 'full', label: 'จัดเต็ม', outcomeText: 'ใช้เงินกับประสบการณ์ร่วมกัน', effect: { cashDelta: -6500 } }, { id: 'simple', label: 'เอาแบบเรียบง่าย', outcomeText: 'ยังได้ใช้เวลาด้วยกันแต่ลดงบ', effect: { cashDelta: -2200 } }] },
  { id: 'family-support', category: 'family', title: 'คนในบ้านต้องการความช่วยเหลือ', text: 'มีค่าใช้จ่ายที่ไม่ได้อยู่ในแผนเดิม', weight: 2, sensitive: true, requirements: { dependents: true }, options: [{ id: 'help', label: 'ช่วยค่าใช้จ่าย', outcomeText: 'เงินสดลดลงเพื่อรับภาระครอบครัว', effect: { cashDelta: -18000 } }] },
  { id: 'family-income-loss', category: 'family', title: 'ผู้หารายได้หลักของครอบครัวจากไป', text: 'รายได้ก้อนสำคัญของครอบครัวหายไป ขณะที่ค่าใช้จ่ายจำเป็นยังเดินต่อ', weight: 1, sensitive: true, requirements: { dependents: true, minMonth: 5 }, options: [{ id: 'respond', label: 'ใช้แผนที่เตรียมไว้', outcomeText: 'ความคุ้มครองชีวิตที่เข้าเงื่อนไขช่วยเป็นเงินก้อนลดผลกระทบต่อครอบครัวตามกติกาเกม', effect: { cost: { amount: 160000, protectionType: 'life' }, incomeModifier: { percent: -0.22, months: 3, label: 'รายได้ครอบครัวลด' } } }] },
  { id: 'family-parent', category: 'family', title: 'มีค่าใช้จ่ายดูแลผู้ใหญ่ในบ้าน', text: 'เป็นค่าใช้จ่ายจำเป็นที่เกิดขึ้นช่วงนี้', weight: 2, sensitive: true, requirements: { dependents: true }, options: [{ id: 'care', label: 'จัดการค่าใช้จ่าย', outcomeText: 'มีภาระเพิ่มชั่วคราว', effect: { cashDelta: -12000 } }] },
  { id: 'family-help', category: 'family', title: 'ครอบครัวช่วยแบ่งภาระบางส่วน', text: 'เดือนนี้มีคนช่วยรับค่าใช้จ่ายบางก้อน', weight: 2, requirements: { dependents: true }, options: [{ id: 'accept', label: 'รับความช่วยเหลือ', outcomeText: 'เงินสดเพิ่มขึ้นเล็กน้อย', effect: { cashDelta: 6000 } }] },
];

const marketSeed = [
  ['up-small', 'ตลาดขยับขึ้น', 'เงินลงทุนเดือนนี้เพิ่มขึ้นเล็กน้อย', 0.04, 5, false],
  ['up', 'ตลาดเป็นใจ', 'เงินลงทุนปรับขึ้นชัดเจน', 0.08, 3, false],
  ['flat', 'ตลาดแทบไม่ขยับ', 'เดือนนี้ไม่มีอะไรหวือหวา', 0, 4, false],
  ['down-small', 'ตลาดย่อลง', 'มูลค่าลดลง แต่ยังไม่มีเหตุให้ต้องขาย', -0.05, 5, false],
  ['down', 'ตลาดผันผวน', 'มูลค่าลดลงมากขึ้นในเดือนนี้', -0.11, 3, false],
  ['crash', 'ตลาดปรับลงแรง', 'เกิดความผันผวนสูงและมูลค่าลดลงเร็ว', -0.24, 1, true],
  ['rebound', 'ตลาดฟื้นบางส่วน', 'มูลค่าการลงทุนขยับกลับขึ้น', 0.1, 2, false],
  ['up-tiny', 'ตลาดบวกนิดเดียว', 'ตัวเลขเป็นบวก แต่ยังไม่ถึงขั้นฉลอง', 0.018, 4, false],
] as const;

const market: MoneyEvent[] = marketSeed.map(([id, title, text, pct, weight, sensitive]) => ({
  id: 'market-' + id,
  category: 'market',
  title,
  text,
  weight,
  sensitive,
  requirements: { investments: true },
  options: [{
    id: 'continue',
    label: 'รับความเคลื่อนไหวของตลาด',
    outcomeText: pct >= 0 ? 'มูลค่าการลงทุนเพิ่มตามสถานการณ์จำลอง' : 'มูลค่าการลงทุนลดตามสถานการณ์จำลอง',
    effect: { investmentPercent: pct },
  }],
}));

const crisis: MoneyEvent[] = [
  { id: 'crisis-job-loss', category: 'crisis', title: 'งานหยุดกะทันหัน', text: 'รายได้หลักหยุดลงช่วงหนึ่ง แต่ภาระรายเดือนยังเดินต่อ', weight: 1, sensitive: true, requirements: { minMonth: 4, stabilities: ['stable'] }, options: [{ id: 'buffer', label: 'ใช้แผนที่มีรับมือ', outcomeText: 'รายได้ลดลงอย่างมากในสองเดือนถัดไป', effect: { incomeModifier: { percent: -0.75, months: 2, label: 'รายได้หยุดชั่วคราว' } } }] },
  { id: 'crisis-business', category: 'crisis', title: 'ยอดธุรกิจลดลงแรง', text: 'กระแสเงินเข้าลดลงชั่วคราวและต้องประคองภาระเดิม', weight: 1, sensitive: true, requirements: { minMonth: 4, stabilities: ['business'] }, options: [{ id: 'adapt', label: 'ประคองกระแสเงินสด', outcomeText: 'รายได้ลดลงต่อเนื่องช่วงสั้น', effect: { incomeModifier: { percent: -0.45, months: 3, label: 'ธุรกิจชะลอ' } } }] },
  { id: 'crisis-freelance', category: 'crisis', title: 'งานหลายชิ้นเลื่อนพร้อมกัน', text: 'กระแสเงินเข้าของฟรีแลนซ์หายไปชั่วคราว', weight: 1, sensitive: true, requirements: { minMonth: 4, stabilities: ['variable'] }, options: [{ id: 'buffer', label: 'ใช้เงินสำรอง', outcomeText: 'รายได้ลดลงสองเดือน', effect: { incomeModifier: { percent: -0.5, months: 2, label: 'งานเลื่อน' } } }] },
  { id: 'crisis-flood-home', category: 'crisis', title: 'เกิดความเสียหายจากเหตุภัยพิบัติ', text: 'ทรัพย์สินได้รับผลกระทบและต้องมีค่าใช้จ่ายซ่อมแซม', weight: 0.7, sensitive: true, requirements: { hasHome: true, minMonth: 5 }, options: [{ id: 'repair', label: 'จัดการความเสียหาย', outcomeText: 'ความคุ้มครองบ้านที่เข้าเงื่อนไขจำลองช่วยรับบางส่วน', effect: { cost: { amount: 150000, protectionType: 'home' } } }] },
  { id: 'crisis-major-medical', category: 'crisis', title: 'ต้องรักษาตัวต่อเนื่อง', text: 'มีค่าใช้จ่ายและผลต่อรายได้พร้อมกัน', weight: 0.8, sensitive: true, requirements: { minMonth: 5 }, options: [{ id: 'care', label: 'ใช้แผนที่มีรับมือ', outcomeText: 'ใช้สิทธิและความคุ้มครองที่เข้าเงื่อนไข พร้อมรับรายได้ที่ลดลงชั่วคราว', effect: { cost: { amount: 130000, protectionType: 'health' }, incomeModifier: { percent: -0.25, months: 3, label: 'พักรักษาตัว' } } }] },
  { id: 'crisis-family-loss', category: 'crisis', title: 'ครอบครัวเผชิญการสูญเสียผู้หารายได้หลัก', text: 'รายได้ของครอบครัวหายไป ขณะที่ภาระสำคัญยังต้องเดินต่อ', weight: 0.35, sensitive: true, requirements: { dependents: true, minMonth: 6 }, options: [{ id: 'support', label: 'ใช้แผนที่เตรียมไว้', outcomeText: 'ความคุ้มครองชีวิตที่เข้าเงื่อนไขจำลองช่วยลดผลกระทบต่อครอบครัว', effect: { cost: { amount: 260000, protectionType: 'life' }, incomeModifier: { percent: -0.35, months: 4, label: 'รายได้ครอบครัวหาย' } } }] },
];

const calm: MoneyEvent[] = [
  { id: 'calm-keep', category: 'calm', title: 'เดือนนี้ไม่มีเรื่องใหญ่', text: 'เดือนธรรมดาก็เป็นส่วนสำคัญของการเงิน', weight: 6, repeat: true, options: [{ id: 'keep', label: 'เก็บเงินสดไว้', outcomeText: 'รักษาสภาพคล่อง', effect: {} }, { id: 'invest', label: 'ย้าย 3,000 ไปลงทุน', outcomeText: 'ย้ายเงินสดไปลงทุน', effect: { investmentDelta: 3000 } }] },
  { id: 'calm-debt', category: 'calm', title: 'เดือนค่อนข้างนิ่ง', text: 'มีพื้นที่ให้เลือกว่าจะทำอะไรกับเงินที่มี', weight: 4, repeat: true, options: [{ id: 'keep', label: 'เก็บไว้ก่อน', outcomeText: 'รักษาเงินพร้อมใช้', effect: {} }, { id: 'debt', label: 'ลดหนี้เพิ่ม 3,000', outcomeText: 'ลดเงินสดและเงินต้นคงเหลือ', effect: { debtPrincipalReduction: 3000 } }] },
  { id: 'calm-invest', category: 'calm', title: 'เดือนนี้เรื่องใหญ่ไม่มา', text: 'เดือนนี้ไม่มีเรื่องเร่ง คุณเลือกจัดเงินได้เต็มที่', weight: 4, repeat: true, options: [{ id: 'invest', label: 'ลงทุน 5,000', outcomeText: 'ย้ายเงินสดไปลงทุน', effect: { investmentDelta: 5000 } }, { id: 'cash', label: 'เก็บเงินสด', outcomeText: 'ยังไม่เปลี่ยนสัดส่วน', effect: {} }] },
  { id: 'calm-rest', category: 'calm', title: 'เดือนนี้ไม่มีเรื่องไม่คาดคิด', text: 'ไม่มีเหตุการณ์ใหญ่ และนั่นก็เป็นข่าวดี', weight: 5, repeat: true, options: [{ id: 'next', label: 'ไปต่อ', outcomeText: 'ไม่มีผลกระทบพิเศษ', effect: {} }] },
];

function protectionOffer(
  type: ProtectionType,
  title: string,
  requirements: MoneyEvent['requirements'] = {},
): MoneyEvent {
  const item = PROTECTION_CATALOG[type];
  const lumpSum = type === 'critical' || type === 'life';
  const text =
    type === 'critical'
      ? 'ลองดูว่าเงินก้อนเมื่อเจ็บป่วยรุนแรงช่วยพยุงเงินสดระหว่างรักษาและพักงานได้อย่างไร'
      : type === 'life'
        ? 'ลองดูว่าความคุ้มครองชีวิตช่วยให้ครอบครัวมีเงินก้อนรับภาระต่อ หากผู้หารายได้หลักจากไป'
        : 'ลองดูว่าความคุ้มครอง ' + item.label + ' ช่วยลดค่าใช้จ่ายที่ต้องรับเองในเหตุการณ์จำลองได้แค่ไหน';

  return {
    id: 'protect-' + type,
    category: 'calm',
    title,
    text,
    weight: 2.6,
    repeat: false,
    requirements: { ...requirements, missingProtection: type },
    options: [
      {
        id: 'buy',
        label: 'เพิ่มความคุ้มครอง',
        outcomeText: lumpSum
          ? 'มีเบี้ยรายเดือนเพิ่ม และเริ่มมีสิทธิรับเงินก้อนตามกติกาเกมตั้งแต่เดือนถัดไป'
          : 'มีเบี้ยรายเดือนเพิ่ม และความคุ้มครองเริ่มเดือนถัดไป',
        effect: { addProtection: type },
      },
      { id: 'skip', label: 'ยังไม่เพิ่ม', outcomeText: 'ยังคงแผนเดิม', effect: {} },
    ],
  };
}

export const MONEY_STORY_EVENTS: MoneyEvent[] = [
  ...everyday,
  ...household,
  ...work,
  ...health,
  ...motor,
  ...home,
  ...family,
  ...market,
  ...crisis,
  ...calm,
  protectionOffer('health', 'ทบทวนความเสี่ยงค่ารักษา'),
  protectionOffer('critical', 'ทบทวนเงินก้อนช่วงรักษาตัว'),
  protectionOffer('life', 'ทบทวนคนที่พึ่งรายได้เรา', { dependents: true }),
  protectionOffer('motor', 'ทบทวนความเสี่ยงรถ', { hasCar: true }),
  protectionOffer('home', 'ทบทวนความเสี่ยงบ้านและทรัพย์สิน', { hasHome: true }),
];

export function getMoneyStoryEvent(id: string): MoneyEvent | undefined {
  return MONEY_STORY_EVENTS.find((event) => event.id === id);
}
