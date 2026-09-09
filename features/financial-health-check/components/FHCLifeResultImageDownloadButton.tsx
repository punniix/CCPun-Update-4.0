'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

type Summary = {
  familySupport: number;
  debtAndEducation: number;
  resources: number;
  gap: number;
};

function amount(value: number): string {
  return `${Math.round(value).toLocaleString('th-TH')} บาท`;
}

async function makeImage(summary: Summary): Promise<Blob> {
  const { renderResultShareImage } = await import('@/lib/shared/result-share-image');
  return renderResultShareImage({
    toolName: 'เครื่องมือวางแผนทุนประกันชีวิต',
    resultLabel: 'ส่วนต่างทุนประกันชีวิต',
    primaryAmount: amount(summary.gap),
    metrics: [
      { label: 'ค่าใช้จ่ายครัวเรือนตามระยะที่เลือก', value: amount(summary.familySupport) },
      { label: 'หนี้และทุนการศึกษา', value: amount(summary.debtAndEducation) },
      { label: 'ทุนเดิมและสินทรัพย์ที่มีอยู่', value: amount(summary.resources), emphasis: true },
    ],
    methodTitle: 'วิธีดูผลลัพธ์',
    methodDetail: 'ภาระครอบครัว + หนี้/การศึกษา − ทุนเดิมและสินทรัพย์',
    noticeTitle: 'เป็นประมาณการเบื้องต้นจากข้อมูลที่กรอก',
    noticeDetail: 'ไม่ใช่คำแนะนำเฉพาะบุคคลหรือเอกสารรับรอง ประกันไม่ใช่เงินฝาก',
    actionLabel: 'เพิ่มเพื่อน LINE @ccpun',
  }, '/assets/ccpun-text-logo.svg', '/assets/line-oa-qr.png');
}

export default function FHCLifeResultImageDownloadButton({ summary }: { summary: Summary }) {
  const [status, setStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle');

  async function download(): Promise<void> {
    if (status === 'working') return;
    setStatus('working');
    try {
      const blob = await makeImage(summary);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ccpun-life-coverage-summary-${new Date().toISOString().slice(0, 10)}.png`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      trackEvent('fhc_result_download', { tool_name: 'fhc', cta_location: 'fhc_result', surface_group: 'fhc' });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  return <div className="space-y-2">
    <button type="button" onClick={download} disabled={status === 'working'} aria-busy={status === 'working'} aria-describedby="fhc-image-privacy fhc-image-status" className="glass-button inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3 sm:w-auto"><Download className="h-5 w-5" aria-hidden="true" />{status === 'working' ? 'กำลังสร้างภาพ…' : 'บันทึกภาพสรุป'}</button>
    <p id="fhc-image-privacy" className="text-xs text-muted-foreground">ภาพสร้างบนอุปกรณ์นี้ ไม่มีการอัปโหลดข้อมูลที่คุณกรอก</p>
    <p id="fhc-image-status" aria-live="polite" className="min-h-5 text-xs text-muted-foreground">{status === 'success' ? 'เริ่มดาวน์โหลดภาพสรุปแล้ว' : status === 'error' ? 'สร้างภาพไม่สำเร็จ กรุณาลองอีกครั้ง' : ''}</p>
  </div>;
}
