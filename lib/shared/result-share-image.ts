export const RESULT_SHARE_IMAGE_WIDTH = 1080;
export const RESULT_SHARE_IMAGE_HEIGHT = 1350;

export interface ResultShareMetric {
  label: string;
  value: string;
  emphasis?: boolean;
}

export interface ResultShareLineItem {
  label: string;
  amount: number;
}

export interface ResultShareImageSummary {
  toolName: string;
  resultLabel: string;
  primaryAmount: string;
  metrics: readonly [ResultShareMetric, ResultShareMetric, ResultShareMetric];
  methodTitle: string;
  methodDetail: string;
  noticeTitle: string;
  noticeDetail: string;
  actionLabel: string;
  scopeNote?: string;
  dateLabel?: string;
  composition?: Readonly<{
    targetItems: readonly ResultShareLineItem[];
    resourceItems: readonly ResultShareLineItem[];
    resourcesText: string;
    targetAmount: number;
    resourcesAmount: number;
    protectedAssetsAmount?: number;
  }>;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + r, y, r);
  context.closePath();
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
): void {
  roundedRect(context, x, y, width, height, radius);
  context.fillStyle = color;
  context.fill();
}

function fitText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  startingSize: number,
  weight = 700,
  minimumSize = 20,
): void {
  let size = startingSize;
  while (size > minimumSize) {
    context.font = `${weight} ${size}px Kanit, sans-serif`;
    if (context.measureText(value).width <= maxWidth) break;
    size -= 2;
  }
  context.font = `${weight} ${Math.max(size, minimumSize)}px Kanit, sans-serif`;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('ไม่สามารถโหลดองค์ประกอบของภาพสรุปได้'));
    image.src = source;
  });
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('ไม่สามารถสร้างไฟล์ภาพ PNG ได้')), 'image/png');
  });
}

export async function renderResultShareImage(
  summary: Readonly<ResultShareImageSummary>,
  logoPath: string,
  lineQrPath: string,
): Promise<Blob> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('การสร้างภาพสรุปทำได้เฉพาะในเบราว์เซอร์');
  }

  await document.fonts?.ready;
  const [logo, lineQr] = await Promise.all([loadImage(logoPath), loadImage(lineQrPath)]);
  const visibleCount = (items: readonly ResultShareLineItem[]) => Math.max(1, Math.min(items.filter((item) => item.amount > 0).length, 5));
  const targetCount = summary.composition ? visibleCount(summary.composition.targetItems) : 0;
  const resourceCount = summary.composition ? visibleCount(summary.composition.resourceItems) : 0;
  const targetTotalY = 885 + (targetCount - 1) * 47 + 52;
  const resourceHeaderY = targetTotalY + 92;
  const resourceRowsY = resourceHeaderY + 59;
  const resourceTotalY = resourceRowsY + (resourceCount - 1) * 47 + 52;
  const protectedNoteY = resourceTotalY + 43;
  const cardBottom = summary.composition?.protectedAssetsAmount ? protectedNoteY + 36 : resourceTotalY + 44;
  const footerY = cardBottom + 28;
  // ponytail: the CI image grows with entered rows; the FHC image keeps its existing fixed size.
  const imageHeight = summary.composition ? footerY + 230 : RESULT_SHARE_IMAGE_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = RESULT_SHARE_IMAGE_WIDTH;
  canvas.height = imageHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('เบราว์เซอร์นี้ไม่รองรับการสร้างภาพสรุป');

  const background = '#352727';
  const dark = '#2d2222';
  const panel = '#403030';
  const panelAlt = '#493b35';
  const ink = '#faf8f8';
  const muted = '#b8aaaa';
  const border = '#5b4848';
  const gold = '#dcc786';
  const shortfallColor = '#ff6f61';

  context.fillStyle = background;
  context.fillRect(0, 0, RESULT_SHARE_IMAGE_WIDTH, imageHeight);
  context.fillStyle = dark;
  context.fillRect(0, 0, RESULT_SHARE_IMAGE_WIDTH, 174);
  context.fillStyle = gold;
  context.fillRect(0, 164, RESULT_SHARE_IMAGE_WIDTH, 10);
  context.drawImage(logo, 68, 48, 248, 72);
  if (!summary.composition) {
    context.fillStyle = muted;
    context.font = '500 24px Kanit, sans-serif';
    context.fillText(summary.toolName, 68, 145);
  }
  if (summary.dateLabel) {
    context.fillStyle = muted;
    context.textAlign = 'right';
    fitText(context, summary.dateLabel, 500, 22, 400, 16);
    context.fillText(summary.dateLabel, 1012, 104);
    context.textAlign = 'left';
  }

  if (summary.composition) {
    const target = Math.max(0, summary.composition.targetAmount);
    const resources = Math.max(0, summary.composition.resourcesAmount);
    // ponytail: one proportional bar answers the coverage question; no chart dependency or percentages to decode.
    const availableBarWidth = target > 0 ? 888 * Math.min(resources / target, 1) : resources > 0 ? 888 : 0;
    // ponytail: small cutout stickers sit on card edges, clear of data and QR.
    const drawSticker = (path: string, x: number, y: number, size: number, angle: number) => {
      if (typeof Path2D === 'undefined') return;
      context.save();
      context.translate(x, y);
      context.rotate(angle * Math.PI / 180);
      context.shadowColor = 'rgba(0, 0, 0, 0.24)';
      context.shadowBlur = 10;
      context.shadowOffsetY = 3;
      context.fillStyle = '#ead9a8';
      context.strokeStyle = '#fff4d8';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(-size * 0.34, -size * 0.45);
      context.bezierCurveTo(size * 0.02, -size * 0.55, size * 0.4, -size * 0.48, size * 0.46, -size * 0.18);
      context.bezierCurveTo(size * 0.52, size * 0.12, size * 0.38, size * 0.49, size * 0.06, size * 0.47);
      context.bezierCurveTo(-size * 0.22, size * 0.51, -size * 0.5, size * 0.33, -size * 0.47, size * 0.04);
      context.bezierCurveTo(-size * 0.48, -size * 0.18, -size * 0.49, -size * 0.38, -size * 0.34, -size * 0.45);
      context.closePath();
      context.fill();
      context.stroke();
      context.shadowBlur = 0;
      context.shadowOffsetY = 0;
      context.translate(-(size - 24) / 2, -(size - 24) / 2);
      context.scale((size - 24) / 24, (size - 24) / 24);
      context.strokeStyle = background;
      context.globalAlpha = 0.85;
      context.lineWidth = 1.2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.stroke(new Path2D(path));
      context.restore();
    };
    context.fillStyle = ink;
    fitText(context, summary.resultLabel, 944, 34, 600, 24);
    context.fillText(summary.resultLabel, 68, 236);
    context.fillStyle = gold;
    fitText(context, summary.primaryAmount, 944, 84, 700, 56);
    context.fillText(summary.primaryAmount, 68, 338);
    context.fillStyle = muted;
    fitText(context, summary.methodTitle, 944, 26, 500, 22);
    context.fillText(summary.methodTitle, 68, 385);
    context.save();
    context.translate(0, -28);

    fillRoundedRect(context, 68, 433, 944, 318, 24, panel);
    drawSticker('M12 21c0-2-1.5-3-3-3H3V3h5c2 0 4 1 4 4v14z M12 21c0-2 1.5-3 3-3h6V3h-5c-2 0-4 1-4 4v14z', 940, 470, 50, 11);
    context.fillStyle = ink;
    context.font = '600 32px Kanit, sans-serif';
    context.fillText('ทุนสำหรับรับมือโรคร้ายแรง', 96, 488);
    context.fillStyle = gold;
    context.font = '500 28px Kanit, sans-serif';
    context.fillText('มีแล้ว', 96, 556);
    context.fillStyle = resources < target ? shortfallColor : gold;
    context.fillText(summary.metrics[2].label, 566, 556);
    context.fillStyle = gold;
    fitText(context, summary.composition.resourcesText, 410, 42, 700, 30);
    context.fillText(summary.composition.resourcesText, 96, 610);
    context.fillStyle = resources < target ? shortfallColor : gold;
    fitText(context, summary.metrics[2].value, 410, 42, 700, 30);
    context.fillText(summary.metrics[2].value, 566, 610);
    context.save();
    roundedRect(context, 96, 656, 888, 68, 34);
    context.clip();
    context.fillStyle = resources < target ? shortfallColor : gold;
    context.fillRect(96, 656, 888, 68);
    context.fillStyle = gold;
    context.fillRect(96, 656, availableBarWidth, 68);
    context.restore();
    // ponytail: show at most five readable category rows; any future extras stay in the total as one row.
    const drawItems = (items: readonly ResultShareLineItem[], yStart: number) => {
      const nonzero = items.filter((item) => item.amount > 0);
      const rows = nonzero.length > 5
        ? [...nonzero.slice(0, 4), {
          label: `รายการอื่นอีก ${nonzero.length - 4} รายการ`,
          amount: nonzero.slice(4).reduce((sum, item) => sum + item.amount, 0),
        }]
        : nonzero;
      if (rows.length === 0) {
        context.fillStyle = muted;
        context.font = '500 28px Kanit, sans-serif';
        context.fillText('ยังไม่มีรายการที่กรอก', 96, yStart);
      }
      rows.forEach((item, index) => {
        context.fillStyle = ink;
        fitText(context, item.label, 580, 28, 500, 22);
        context.fillText(item.label, 96, yStart + index * 47);
        context.textAlign = 'right';
        fitText(context, `${Math.round(item.amount).toLocaleString('th-TH')} บาท`, 280, 29, 600, 23);
        context.fillText(`${Math.round(item.amount).toLocaleString('th-TH')} บาท`, 984, yStart + index * 47);
        context.textAlign = 'left';
      });
    };

    fillRoundedRect(context, 68, 783, 944, cardBottom - 783, 22, panel);
    drawSticker('M2 10 12 2l10 8v11H2z M9 21v-8h6v8', 65, 962, 52, 14);
    drawSticker('M3 16V9l2-4h14l2 4v7 M3 16h18 M6 16v3 M18 16v3 M6 10h12 M6 13h1 M17 13h1', 940, resourceHeaderY + 7, 50, -10);
    context.fillStyle = gold;
    context.font = '600 30px Kanit, sans-serif';
    context.fillText('ที่มาของทุนที่ประเมิน', 96, 835);
    drawItems(summary.composition.targetItems, 885);
    context.fillStyle = gold;
    context.font = '600 30px Kanit, sans-serif';
    context.fillText('รวมทุนที่ต้องเตรียม', 96, targetTotalY);
    context.textAlign = 'right';
    fitText(context, summary.primaryAmount, 350, 30, 600, 24);
    context.fillText(summary.primaryAmount, 984, targetTotalY);
    context.textAlign = 'left';
    context.strokeStyle = border;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(96, targetTotalY + 36);
    context.lineTo(984, targetTotalY + 36);
    context.stroke();
    context.fillStyle = gold;
    context.font = '600 30px Kanit, sans-serif';
    context.fillText('ทุนที่มีสำหรับรับมือโรคร้ายแรง', 96, resourceHeaderY);
    drawItems(summary.composition.resourceItems, resourceRowsY);
    context.fillStyle = gold;
    context.font = '600 30px Kanit, sans-serif';
    context.fillText('รวมทุนที่มี', 96, resourceTotalY);
    context.textAlign = 'right';
    fitText(context, summary.composition.resourcesText, 350, 30, 600, 24);
    context.fillText(summary.composition.resourcesText, 984, resourceTotalY);
    context.textAlign = 'left';
    if (summary.composition.protectedAssetsAmount) {
      context.fillStyle = muted;
      fitText(context, 'สินทรัพย์ยังอยู่ในทุนที่มี และเพิ่มเป้าหมายเพื่อเก็บก้อนเดิม', 888, 23, 500, 19);
      context.fillText('สินทรัพย์ยังอยู่ในทุนที่มี และเพิ่มเป้าหมายเพื่อเก็บก้อนเดิม', 96, protectedNoteY);
    }

    fillRoundedRect(context, 68, footerY, 944, 200, 22, dark);
    drawSticker('M9 3h6v6h6v6h-6v6H9v-6H3V9h6z', 64, footerY + 143, 48, -12);
    context.fillStyle = gold;
    fitText(context, summary.noticeTitle, 630, 26, 600, 22);
    context.fillText(summary.noticeTitle, 96, footerY + 52);
    context.fillStyle = ink;
    fitText(context, summary.noticeDetail, 630, 24, 500, 20);
    context.fillText(summary.noticeDetail, 96, footerY + 106);
    context.fillStyle = gold;
    fitText(context, summary.actionLabel, 630, 28, 600, 22);
    context.fillText(summary.actionLabel, 96, footerY + 170);
    context.drawImage(lineQr, 816, footerY + 20, 164, 164);
    context.restore();
    return canvasToPng(canvas);
  }

  context.fillStyle = ink;
  fitText(context, summary.resultLabel, 944, 42, 700, 28);
  context.fillText(summary.resultLabel, 68, 274);
  context.fillStyle = gold;
  fitText(context, summary.primaryAmount, 944, 82, 700, 48);
  context.fillText(summary.primaryAmount, 68, 382);

  summary.metrics.forEach((metric, index) => {
    const y = 438 + index * 116;
    fillRoundedRect(context, 68, y, 944, 94, 18, index === 2 ? panelAlt : panel);
    context.strokeStyle = border;
    context.lineWidth = 1;
    roundedRect(context, 68, y, 944, 94, 18);
    context.stroke();
    context.fillStyle = muted;
    fitText(context, metric.label, 610, 25, 500, 18);
    context.fillText(metric.label, 96, y + 38);
    context.fillStyle = metric.emphasis ? gold : ink;
    context.textAlign = 'right';
    fitText(context, metric.value, 350, 34, 700, 22);
    context.fillText(metric.value, 980, y + 65);
    context.textAlign = 'left';
  });

  fillRoundedRect(context, 68, 810, 944, 158, 22, panel);
  context.fillStyle = ink;
  fitText(context, summary.methodTitle, 872, 30, 700, 22);
  context.fillText(summary.methodTitle, 96, 862);
  context.fillStyle = muted;
  fitText(context, summary.methodDetail, 872, 24, 400, 17);
  context.fillText(summary.methodDetail, 96, 916);

  fillRoundedRect(context, 68, 1018, 944, 260, 22, dark);
  context.fillStyle = gold;
  fitText(context, summary.noticeTitle, 630, 25, 600, 18);
  context.fillText(summary.noticeTitle, 96, 1072);
  context.fillStyle = ink;
  fitText(context, summary.noticeDetail, 630, 23, 500, 17);
  context.fillText(summary.noticeDetail, 96, 1115);
  context.fillStyle = gold;
  fitText(context, summary.actionLabel, 630, 25, 600, 18);
  context.fillText(summary.actionLabel, 96, 1190);
  if (summary.scopeNote) {
    context.fillStyle = muted;
    fitText(context, summary.scopeNote, 630, 18, 400, 14);
    context.fillText(summary.scopeNote, 96, 1230);
  }
  context.drawImage(lineQr, 826, 1062, 144, 144);

  return canvasToPng(canvas);
}
