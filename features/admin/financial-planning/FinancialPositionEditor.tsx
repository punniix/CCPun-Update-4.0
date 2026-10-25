"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type {
  FaEmploymentType,
  FinancialPosition,
  HouseholdProfile,
} from "../../../lib/admin/financial-planning/contracts";
import { analyzeFinancialPosition } from "./calculations";
import {
  blankAssetRow,
  blankCashflowRow,
  blankLiabilityRow,
  positionFromRows,
  rowsFromPosition,
  type AssetRow,
  type CashflowRow,
  type EditorRows,
  type LiabilityRow,
} from "./editor-model";
import styles from "./FinancialPlanning.module.css";
import { FinancialSummaryPanel } from "./FinancialSummaryPanel";
import { formatBaht, formatPercent, parseAmountInput } from "./format";
import {
  errorMessage,
  FA_EMPLOYMENT_LABELS,
  FA_EXPENSE_KIND_LABELS,
  FA_FREQUENCY_LABELS,
  FA_INCOME_TYPE_LABELS,
  FA_LIABILITY_KIND_LABELS,
  FA_LIQUIDITY_LABELS,
  FA_MODES,
  type FaMode,
} from "./presentation";

const inputClass = "min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/25 px-3 text-sm text-white";
const invalidClass = styles.invalid;
const DARK_TEXT = { color: "#1c1615" } as const;

type Props = {
  householdId: string;
  initialRevision: number;
  initialProfile: HouseholdProfile;
  initialPosition: FinancialPosition;
  unreadableItems: number;
  /** Rendered only in "เตรียมก่อนนัด": CRM notes are never shown to the client. */
  notes: ReactNode;
};

function useKeys() {
  const counter = useRef(0);
  return () => `row-${++counter.current}`;
}

function SectionCard({ title, total, children, onAdd }: { title: string; total: string; children: ReactNode; onAdd: () => void }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-sm tabular-nums text-[#e0c985]">รวม {total} บาท</span>
      </div>
      {children}
      <button type="button" onClick={onAdd} className="min-h-11 w-fit rounded-xl border border-dashed border-white/20 px-4 text-sm text-[#e0c985] hover:bg-white/[0.04]">
        + เพิ่มรายการ
      </button>
    </section>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" aria-label="ลบรายการ" onClick={onClick} className={`${styles.iconButton} inline-flex items-center justify-center rounded-xl border border-white/10 text-white/60 hover:bg-white/[0.06]`}>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
    </button>
  );
}

export function FinancialPositionEditor({ householdId, initialRevision, initialProfile, initialPosition, unreadableItems, notes }: Props) {
  const nextKey = useKeys();
  const [mode, setMode] = useState<FaMode>("prep");
  const [revision, setRevision] = useState(initialRevision);
  const [profile, setProfile] = useState<HouseholdProfile>(initialProfile);
  const [dependents, setDependents] = useState(initialProfile.dependentsCount === null ? "" : String(initialProfile.dependentsCount));
  const [rows, setRows] = useState<EditorRows>(() => rowsFromPosition(initialPosition, nextKey));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const conversion = useMemo(() => positionFromRows(rows), [rows]);
  const analysis = useMemo(() => analyzeFinancialPosition(conversion.position, profile.employment), [conversion, profile.employment]);
  const invalid = new Set(conversion.ok ? [] : conversion.invalidKeys);
  const presenting = mode === "online";
  const large = mode === "face";

  function change(update: (current: EditorRows) => EditorRows) {
    setRows(update);
    setDirty(true);
    setMessage(null);
  }
  function patch<K extends keyof EditorRows>(section: K, key: string, field: string, value: string) {
    change((current) => ({
      ...current,
      [section]: (current[section] as Array<{ key: string }>).map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    }));
  }
  function remove<K extends keyof EditorRows>(section: K, key: string) {
    change((current) => ({ ...current, [section]: (current[section] as Array<{ key: string }>).filter((row) => row.key !== key) }));
  }

  const dependentsParsed = parseAmountInput(dependents);
  const dependentsValid = dependentsParsed.ok && (dependentsParsed.value === null || (Number.isInteger(dependentsParsed.value) && dependentsParsed.value <= 30));
  const nameValid = profile.displayName.trim().length > 0;

  async function save() {
    if (!conversion.ok || !dependentsValid || !nameValid) {
      setMessage({ tone: "error", text: "มีบางช่องที่ตัวเลขไม่ถูกต้อง (กรอบสีแดง) แก้ก่อนบันทึก" });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/planning/households/${householdId}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRevision: revision,
          profile: { ...profile, displayName: profile.displayName.trim(), dependentsCount: dependentsParsed.ok ? dependentsParsed.value : null },
          position: conversion.position,
        }),
      });
      const body = await response.json().catch(() => null) as { revision?: number; error?: string } | null;
      if (!response.ok || typeof body?.revision !== "number") throw new Error(body?.error ?? "store-failed");
      setRevision(body.revision);
      setDirty(false);
      setMessage({ tone: "ok", text: "บันทึกแล้ว" });
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error instanceof Error ? error.message : null) });
    } finally {
      setBusy(false);
    }
  }

  const incomeShare = (raw: string, frequency: CashflowRow["frequency"]) => {
    const parsed = parseAmountInput(raw);
    if (!parsed.ok || parsed.value === null || analysis.summary.monthlyIncome <= 0) return "—";
    const monthly = frequency === "yearly" ? parsed.value / 12 : parsed.value;
    return `${formatPercent(monthly / analysis.summary.monthlyIncome)} ของรายได้`;
  };

  const cashflowRows = (section: "income" | "expense") => rows[section].map((row) => (
    <div key={row.key} className={`${styles.row} ${styles.cashflowColumns}`}>
      <input aria-label="ชื่อรายการ" value={row.label} maxLength={120} onChange={(event) => patch(section, row.key, "label", event.target.value)} className={inputClass} />
      <input aria-label="จำนวนเงิน (บาท)" inputMode="decimal" value={row.amount} onChange={(event) => patch(section, row.key, "amount", event.target.value)} className={`${inputClass} text-right tabular-nums ${invalid.has(`${row.key}:amount`) ? invalidClass : ""}`} />
      <select aria-label="ความถี่" value={row.frequency} onChange={(event) => patch(section, row.key, "frequency", event.target.value)} className={inputClass}>
        {Object.entries(FA_FREQUENCY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {section === "income" ? (
        <select aria-label="ประเภทเงินได้" value={row.incomeType} onChange={(event) => patch(section, row.key, "incomeType", event.target.value)} className={inputClass}>
          <option value="">ไม่ระบุ</option>
          {Object.entries(FA_INCOME_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      ) : (
        <select aria-label="หมวดรายจ่าย" value={row.expenseKind} onChange={(event) => patch(section, row.key, "expenseKind", event.target.value)} className={inputClass}>
          <option value="">ไม่ระบุ</option>
          {Object.entries(FA_EXPENSE_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      )}
      <RemoveButton onClick={() => remove(section, row.key)} />
      <span className="text-xs text-white/50" style={{ gridColumn: "1 / -1" }}>{incomeShare(row.amount, row.frequency)}</span>
    </div>
  ));

  const assetRows = rows.assets.map((row: AssetRow) => (
    <div key={row.key} className={`${styles.row} ${styles.assetColumns}`}>
      <input aria-label="ชื่อสินทรัพย์" value={row.label} maxLength={120} onChange={(event) => patch("assets", row.key, "label", event.target.value)} className={inputClass} />
      <input aria-label="มูลค่าวันนี้ (บาท)" inputMode="decimal" value={row.value} onChange={(event) => patch("assets", row.key, "value", event.target.value)} className={`${inputClass} text-right tabular-nums ${invalid.has(`${row.key}:value`) ? invalidClass : ""}`} />
      <select aria-label="ประเภทสินทรัพย์" value={row.liquidity} onChange={(event) => patch("assets", row.key, "liquidity", event.target.value)} className={inputClass}>
        {Object.entries(FA_LIQUIDITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <input type="date" aria-label="มูลค่า ณ วันที่" value={row.valuedOn} onChange={(event) => patch("assets", row.key, "valuedOn", event.target.value)} className={`${inputClass} [color-scheme:dark]`} />
      <RemoveButton onClick={() => remove("assets", row.key)} />
    </div>
  ));

  const liabilityRows = rows.liabilities.map((row: LiabilityRow) => (
    <div key={row.key} className={`${styles.row} ${styles.liabilityColumns}`}>
      <input aria-label="ชื่อหนี้" value={row.label} maxLength={120} onChange={(event) => patch("liabilities", row.key, "label", event.target.value)} className={inputClass} />
      <input aria-label="ยอดคงเหลือ (บาท)" inputMode="decimal" value={row.balance} onChange={(event) => patch("liabilities", row.key, "balance", event.target.value)} className={`${inputClass} text-right tabular-nums ${invalid.has(`${row.key}:balance`) ? invalidClass : ""}`} />
      <input aria-label="ผ่อนต่อเดือน (บาท)" inputMode="decimal" value={row.monthlyPayment} onChange={(event) => patch("liabilities", row.key, "monthlyPayment", event.target.value)} className={`${inputClass} text-right tabular-nums ${invalid.has(`${row.key}:monthlyPayment`) ? invalidClass : ""}`} />
      <input aria-label="ดอกเบี้ยต่อปี (%)" inputMode="decimal" value={row.rate} onChange={(event) => patch("liabilities", row.key, "rate", event.target.value)} className={`${inputClass} text-right tabular-nums ${invalid.has(`${row.key}:rate`) ? invalidClass : ""}`} />
      <select aria-label="ประเภทหนี้" value={row.kind} onChange={(event) => patch("liabilities", row.key, "kind", event.target.value)} className={inputClass}>
        {Object.entries(FA_LIABILITY_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <RemoveButton onClick={() => remove("liabilities", row.key)} />
    </div>
  ));

  const header = (labels: string[], columns: string) => (
    <div aria-hidden="true" className={`${styles.header} ${columns}`}>
      {labels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
    </div>
  );

  return (
    <div style={large ? { fontSize: "17px" } : undefined}>
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="โหมดการคุย" className="inline-flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.035] p-1">
          {FA_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
              className={`min-h-11 rounded-lg px-3 text-sm ${mode === item.id ? "bg-white/10 font-semibold text-white" : "text-white/70 hover:text-white"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={save} disabled={busy || !dirty} style={DARK_TEXT} className="min-h-11 rounded-xl bg-[#e0c985] px-5 text-sm font-semibold disabled:opacity-50">
          {busy ? "กำลังบันทึก…" : dirty ? "บันทึก" : "บันทึกแล้ว"}
        </button>
        {message ? <span role="status" className={`text-sm ${message.tone === "ok" ? "text-emerald-200" : "text-rose-200"}`}>{message.text}</span> : null}
      </div>

      {presenting ? (
        <p role="status" className={`${styles.presentingBanner} mt-4 rounded-2xl px-4 py-3 text-sm`}>
          กำลังแชร์หน้าจอกับลูกค้า · ซ่อนโน้ตของที่ปรึกษาแล้ว ก่อนแชร์ให้ปิดแท็บอื่นที่มีข้อมูลลูกค้ารายอื่น
        </p>
      ) : null}

      {unreadableItems > 0 ? (
        <p role="alert" className={`${styles.alertBanner} mt-4 rounded-2xl px-4 py-3 text-sm`}>
          มี {unreadableItems.toLocaleString("th-TH")} รายการที่ถอดรหัสไม่ได้ จึงไม่แสดงในตาราง ถ้ากดบันทึก รายการเหล่านี้จะถูกแทนที่ด้วยตารางที่เห็นอยู่
        </p>
      ) : null}

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:grid-cols-3 md:p-5">
            <label className="text-xs text-white/60">
              ชื่อที่ใช้เรียกครอบครัวนี้
              <input value={profile.displayName} maxLength={120} onChange={(event) => { setProfile({ ...profile, displayName: event.target.value }); setDirty(true); }} className={`${inputClass} mt-1 ${nameValid ? "" : invalidClass}`} />
            </label>
            <label className="text-xs text-white/60">
              ลักษณะรายได้
              <select value={profile.employment} onChange={(event) => { setProfile({ ...profile, employment: event.target.value as FaEmploymentType }); setDirty(true); }} className={`${inputClass} mt-1`}>
                {Object.entries(FA_EMPLOYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-xs text-white/60">
              จำนวนผู้ที่ต้องดูแล
              <input inputMode="numeric" value={dependents} onChange={(event) => { setDependents(event.target.value); setDirty(true); }} className={`${inputClass} mt-1 text-right ${dependentsValid ? "" : invalidClass}`} />
            </label>
          </section>

          <SectionCard title="รายได้" total={`${formatBaht(analysis.summary.monthlyIncome)} / เดือน`} onAdd={() => change((current) => ({ ...current, income: [...current.income, blankCashflowRow(nextKey(), "income")] }))}>
            {header(["รายการ", "บาท", "ความถี่", "ประเภทเงินได้", ""], styles.cashflowColumns)}
            {cashflowRows("income")}
          </SectionCard>

          <SectionCard title="รายจ่าย" total={`${formatBaht(analysis.summary.monthlyExpenseTotal)} / เดือน`} onAdd={() => change((current) => ({ ...current, expense: [...current.expense, blankCashflowRow(nextKey(), "expense")] }))}>
            {header(["รายการ", "บาท", "ความถี่", "หมวด", ""], styles.cashflowColumns)}
            {cashflowRows("expense")}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.05] px-3 py-2.5 text-sm">
              <span>ผ่อนหนี้ทั้งหมด (ดึงจากตารางหนี้สิน ไม่ต้องกรอกซ้ำ)</span>
              <span className="tabular-nums">{formatBaht(analysis.summary.monthlyDebtPayments)} / เดือน</span>
            </div>
          </SectionCard>

          <SectionCard title="สินทรัพย์" total={formatBaht(analysis.summary.assetsTotal)} onAdd={() => change((current) => ({ ...current, assets: [...current.assets, blankAssetRow(nextKey())] }))}>
            {header(["รายการ", "มูลค่าวันนี้ (บาท)", "ประเภท", "ณ วันที่", ""], styles.assetColumns)}
            {assetRows}
          </SectionCard>

          <SectionCard title="หนี้สิน" total={formatBaht(analysis.summary.liabilitiesTotal)} onAdd={() => change((current) => ({ ...current, liabilities: [...current.liabilities, blankLiabilityRow(nextKey())] }))}>
            {header(["รายการ", "ยอดคงเหลือ", "ผ่อน/เดือน", "ดอกเบี้ย %", "ประเภท", ""], styles.liabilityColumns)}
            {liabilityRows}
          </SectionCard>

          {mode === "prep" ? notes : null}
        </div>

        <FinancialSummaryPanel analysis={analysis} large={large} />
      </div>
    </div>
  );
}
