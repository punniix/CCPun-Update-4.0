'use client';

import { useEffect, useRef, useState } from 'react';
import { Edit3, MessageCircle, RefreshCw } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import {
  CI_ESTIMATION_METHOD_LABELS,
  CI_LINE_OA_URL,
  CI_ASSESSMENT_VERSION,
} from '@/features/ci-planning/calculator/constants';
import type { CIEstimationMethod, CIResult as CIResultType } from '@/features/ci-planning/calculator/types';
import ResultImageDownloadButton from '@/features/ci-planning/components/ResultImageDownloadButton';

interface CIResultProps {
  result: CIResultType;
  onEditData: () => void;
  onReset: () => void;
}

function baht(value: number) {
  return `${Math.round(value).toLocaleString('th-TH')} บาท`;
}

function getDefaultEstimationMethod(result: CIResultType): CIEstimationMethod {
  if (result.calculatedNeed > 0) return 'expense';
  if (result.incomeBasedNeed > 0) return 'income';
  return 'expense';
}

function NeedBars({
  need,
  existingCoverage,
  liquidAssets,
  availableResources,
  methodLabel,
}: {
  need: number;
  existingCoverage: number;
  liquidAssets: number;
  availableResources: number;
  methodLabel: string;
}) {
  const scaleMax = Math.max(need, availableResources, 1);
  const width = (value: number) => `${Math.min((value / scaleMax) * 100, 100)}%`;

  return (
    <figure className="space-y-4">
      <figcaption className="text-sm font-semibold text-foreground">
        เปรียบเทียบ{methodLabel}กับทรัพยากรที่พร้อมใช้
      </figcaption>

      <div aria-hidden="true" className="space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">{methodLabel}</span>
            <span className="font-semibold tabular-nums text-foreground">{baht(need)}</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-muted/50">
            <div className="h-full rounded-full bg-primary" style={{ width: width(need) }} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">เงินก้อนจากประกันโรคร้ายแรง</span>
            <span className="font-semibold tabular-nums text-foreground">{baht(existingCoverage)}</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-muted/50">
            <div className="h-full rounded-full bg-foreground/70" style={{ width: width(existingCoverage) }} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">สินทรัพย์สภาพคล่อง</span>
            <span className="font-semibold tabular-nums text-foreground">{baht(liquidAssets)}</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-muted/50">
            <div className="h-full rounded-full bg-primary/55" style={{ width: width(liquidAssets) }} />
          </div>
        </div>
      </div>

      <dl className="grid gap-3 rounded-xl border border-border/30 bg-background/25 p-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">{methodLabel}</dt>
          <dd className="mt-1 font-semibold tabular-nums text-foreground">{baht(need)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">เงินก้อนจากประกันโรคร้ายแรง</dt>
          <dd className="mt-1 font-semibold tabular-nums text-foreground">{baht(existingCoverage)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">สินทรัพย์สภาพคล่อง</dt>
          <dd className="mt-1 font-semibold tabular-nums text-foreground">{baht(liquidAssets)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">เงินและสินทรัพย์ที่พร้อมใช้รวม</dt>
          <dd className="mt-1 font-semibold tabular-nums text-primary">{baht(availableResources)}</dd>
        </div>
      </dl>
    </figure>
  );
}

export default function CIResult({ result, onEditData, onReset }: CIResultProps) {
  const [selectedMethod, setSelectedMethod] = useState<CIEstimationMethod>(
    () => getDefaultEstimationMethod(result),
  );
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const hasTrackedResultViewRef = useRef(false);
  const hasIncomeMethod = result.incomeBasedNeed > 0;
  const activeMethod = selectedMethod === 'income' && hasIncomeMethod ? 'income' : 'expense';
  const methodLabel = CI_ESTIMATION_METHOD_LABELS[activeMethod];
  const selectedNeed = activeMethod === 'income' ? result.incomeBasedNeed : result.calculatedNeed;
  const displayedGap = activeMethod === 'income' ? result.incomeShortfall : result.shortfall;
  const displayedSurplus = activeMethod === 'income' ? result.incomeSurplus : result.surplus;

  useEffect(() => {
    resultHeadingRef.current?.scrollIntoView({ block: 'start' });
    resultHeadingRef.current?.focus({ preventScroll: true });
    if (hasTrackedResultViewRef.current) return;
    hasTrackedResultViewRef.current = true;
    trackEvent('ci_result_view', {
      tool_name: 'ci_planning',
      cta_location: 'ci_result',
      calculator_version: CI_ASSESSMENT_VERSION,
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="form-glass space-y-6 p-5 md:p-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-primary">ผลคำนวณจากข้อมูลของคุณ</p>
          <h2 ref={resultHeadingRef} tabIndex={-1} className="scroll-mt-28 rounded-sm text-2xl font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">ประมาณการทุนเบื้องต้น · {methodLabel}</h2>
          {hasIncomeMethod && (
            <fieldset className="space-y-3 py-3" aria-describedby="ci-estimation-method-help">
              <legend className="text-sm font-semibold text-foreground">เลือกวิธีดูประมาณการ</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['expense', 'income'] as const).map((method) => {
                  const value = method === 'expense' ? result.calculatedNeed : result.incomeBasedNeed;
                  const inputId = `ci-estimation-method-${method}`;

                  return (
                    <label
                      key={method}
                      htmlFor={inputId}
                      className={`flex min-h-14 cursor-pointer flex-wrap items-center justify-between gap-3 border-l-2 px-4 py-3 focus-within:ring-2 focus-within:ring-ring ${activeMethod === method ? 'border-primary bg-primary/5' : 'border-border/50 bg-background/20'}`}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          id={inputId}
                          type="radio"
                          name="ci-estimation-method"
                          value={method}
                          checked={activeMethod === method}
                          onChange={() => setSelectedMethod(method)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="font-semibold text-foreground">{CI_ESTIMATION_METHOD_LABELS[method]}</span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">{baht(value)}</span>
                    </label>
                  );
                })}
              </div>
              <p id="ci-estimation-method-help" className="text-sm leading-relaxed text-muted-foreground">
                ระบบแสดงสองวิธีแยกกันและไม่นำมาบวกกัน
              </p>
            </fieldset>
          )}
          <output className="block break-words text-[clamp(1.5rem,5vw,2.25rem)] font-bold tabular-nums text-primary" aria-live="polite" aria-atomic="true">
            {baht(selectedNeed)}
          </output>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {activeMethod === 'expense'
              ? 'ทุนตามรายจ่ายอิงค่าใช้จ่าย ระยะเวลาที่ต้องการวางแผน ค่าเรียน ค่างวด และยอดหนี้อื่นคงเหลือที่คุณกรอก'
              : 'ทุนตามรายได้อิงรายได้ต่อเดือนและระยะเวลาที่คุณเลือก โดยแสดงเป็นอีกวิธีหนึ่งแยกจากทุนตามรายจ่าย'}
          </p>
        </div>

        <NeedBars
          need={selectedNeed}
          existingCoverage={result.existingCoverage}
          liquidAssets={result.liquidAssets}
          availableResources={result.availableResources}
          methodLabel={methodLabel}
        />

        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <p className="text-sm text-muted-foreground">
              {displayedGap > 0
                ? 'ทุนที่ยังขาด'
                : displayedSurplus > 0
                  ? 'เงินและสินทรัพย์ที่มีมากกว่าประมาณการ'
                  : 'ส่วนต่างจากประมาณการ'}
            </p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {baht(displayedGap > 0 ? displayedGap : displayedSurplus)}
            </p>
          </div>
          {displayedSurplus > 0 && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              ตัวเลขนี้แสดงเฉพาะจำนวนที่สูงกว่าผลประมาณการจากข้อมูลชุดนี้
            </p>
          )}
        </div>
      </div>

      <section className="form-glass space-y-5 p-5 md:p-8" aria-labelledby="ci-breakdown-title">
        <div>
          <p className="text-sm font-semibold text-primary">ที่มาของประมาณการ</p>
          <h3 id="ci-breakdown-title" className="text-xl font-bold text-foreground">
            {activeMethod === 'expense' ? 'องค์ประกอบของทุนตามรายจ่าย' : 'วิธีคิดทุนตามรายได้'}
          </h3>
        </div>
        {activeMethod === 'expense' ? (
          <>
            <dl className="grid gap-3 rounded-xl border border-border/30 bg-background/25 p-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted-foreground">ค่าใช้จ่ายครอบครัว</dt>
                <dd className="mt-1 font-semibold tabular-nums text-foreground">{baht(result.householdNeed)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">ค่าเรียนบุตร</dt>
                <dd className="mt-1 font-semibold tabular-nums text-foreground">{baht(result.educationNeed)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">ภาระหนี้รวม</dt>
                <dd className="mt-1 font-semibold tabular-nums text-foreground">{baht(result.debtNeed)}</dd>
              </div>
            </dl>
            <p className="text-sm leading-relaxed text-muted-foreground">
              ทั้งสามส่วนรวมเป็นทุนตามรายจ่าย และแสดงแยกจากทุนตามรายได้
            </p>
          </>
        ) : (
          <p className="rounded-xl border border-border/30 bg-background/25 p-4 text-sm leading-relaxed text-muted-foreground">
            ทุนตามรายได้ดูจากรายได้ต่อเดือนตลอดระยะเวลาที่เลือก และแสดงแยกจากทุนตามรายจ่าย
          </p>
        )}
      </section>

      <div className="rounded-xl border border-border/25 bg-background/20 p-4">
        <p className="text-sm font-semibold leading-relaxed text-foreground">
          หมายเหตุ: ยังไม่รวมค่าจ้างผู้ดูแล และค่ารักษาส่วนที่ประกันสุขภาพไม่ครอบคลุม
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          ผลลัพธ์นี้เป็นประมาณการเบื้องต้นจากข้อมูลและสมมติฐานที่คุณกรอก ไม่ใช่คำแนะนำเฉพาะบุคคล และไม่รับรองว่าจำนวนเงินนี้จะเพียงพอในทุกกรณี โปรดทำความเข้าใจรายละเอียดความคุ้มครอง เงื่อนไข และข้อยกเว้นก่อนตัดสินใจทำประกันภัย และประกันไม่ใช่เงินฝาก
        </p>
      </div>

      <section className="form-glass space-y-4 p-5 md:p-6" aria-labelledby="ci-next-steps-title">
        <div>
          <p className="text-sm font-semibold text-primary">หลังดูผลลัพธ์</p>
          <h3 id="ci-next-steps-title" className="mt-1 text-xl font-bold text-foreground">
            ขั้นตอนต่อไปของคุณ
          </h3>
        </div>
        <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <li className="border-l border-primary/50 pl-4">
            ทบทวนว่ารายได้ ค่าใช้จ่าย ระยะเวลาที่เลือก และเงินก้อนที่กรอก สะท้อนสถานการณ์ปัจจุบันของคุณหรือไม่
          </li>
          <li className="border-l border-primary/50 pl-4">
            ลองปรับข้อมูลที่ยังไม่แน่ใจ แล้วดูว่าที่มาของประมาณการและส่วนต่างเปลี่ยนไปอย่างไร
          </li>
          <li className="border-l border-primary/50 pl-4">
            หากต้องการมุมมองเพิ่มเติม เตรียมหน้าสรุปนี้ไว้คุยกับ CCPun ทาง LINE OA @ccpun ได้
          </li>
        </ul>
      </section>

      <div className="form-glass space-y-3 p-5 text-center md:p-6">
        <ResultImageDownloadButton result={result} selectedMethod={activeMethod} />

        <div>
          <h3 className="text-xl font-bold text-foreground">คุยต่อกับ CCPun ทาง LINE OA</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            ส่งภาพสรุปนี้เพื่อคุยรายละเอียดเพิ่มเติมได้เมื่อพร้อม
          </p>
        </div>

        <a
          href={CI_LINE_OA_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="คุยกับ CCPun ทาง LINE OA (เปิดในแท็บใหม่)"
          className="gold-button liquid-shine inline-flex min-h-14 w-full items-center justify-center gap-2 px-6 py-3 sm:w-auto"
          onClick={() => trackEvent('ci_contact_click', {
            tool_name: 'ci_planning',
            cta_location: 'ci_result',
            contact_channel: 'line',
            calculator_version: CI_ASSESSMENT_VERSION,
          })}
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          คุยกับ CCPun ทาง LINE OA
        </a>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onEditData} className="glass-button flex min-h-12 flex-1 items-center justify-center gap-2">
          <Edit3 className="h-4 w-4" />
          <span>แก้ไขข้อมูล</span>
        </button>
        <button type="button" onClick={onReset} className="glass-button flex min-h-12 flex-1 items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4" />
          <span>เริ่มใหม่</span>
        </button>
      </div>
    </div>
  );
}
