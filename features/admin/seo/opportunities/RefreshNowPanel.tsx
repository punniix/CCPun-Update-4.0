"use client";

import { useState } from "react";
import GscManualSync from "./GscManualSync";
import Ga4ManualSync from "./Ga4ManualSync";

type Props = {
  defaultStartDate: string;
  defaultEndDate: string;
  laneLabel: "ระบบจริง" | "พื้นที่ทดสอบ";
  sessionConnectAllowed: boolean;
  sessionConnectionState?: "configuration-required" | "connect-required" | "connected";
  sessionConnectError: boolean;
  sessionAccountRefreshed: boolean;
  initiallyOpen?: boolean;
};

// Owner decision A4: the separate manual GSC/GA4 pull page is folded into one
// "ดึงใหม่ตอนนี้" button on the morning report. Pressing it runs the very same
// read-only Search Console and GA4 syncs (same API routes, same guards) and
// shows their results below. Nothing is saved; the 06:00 data stays as is.
export default function RefreshNowPanel({ initiallyOpen = false, ...props }: Props) {
  const [run, setRun] = useState(0);
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <section className="mt-6 rounded-2xl border border-[#e0c985]/25 bg-[#e0c985]/[0.05] p-4 sm:p-5" aria-labelledby="refresh-now-title" data-refresh-now="">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="refresh-now-title" className="text-lg font-semibold">ต้องการตัวเลขล่าสุดตอนนี้?</h2>
          <p className="mt-1 text-sm leading-6 text-white/70">อ่าน Google Search Console และ GA4 ช่วง 28 วันล่าสุดแบบอ่านอย่างเดียว ไม่แก้ข้อมูลรอบ 06:00 และไม่บันทึกสำเนา</p>
        </div>
        <button
          type="button"
          onClick={() => { setOpen(true); setRun((value) => value + 1); }}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#e0c985] px-5 py-2 text-sm font-semibold text-[#251818] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e0c985]"
        >
          ดึงใหม่ตอนนี้
        </button>
      </div>
      {open ? (
        <div key={run}>
          <GscManualSync defaultStartDate={props.defaultStartDate} defaultEndDate={props.defaultEndDate} laneLabel={props.laneLabel} autoStart={run > 0} />
          <Ga4ManualSync defaultStartDate={props.defaultStartDate} defaultEndDate={props.defaultEndDate} laneLabel={props.laneLabel}
            sessionConnectAllowed={props.sessionConnectAllowed} sessionConnectionState={props.sessionConnectionState}
            sessionConnectError={props.sessionConnectError} sessionAccountRefreshed={props.sessionAccountRefreshed} autoStart={run > 0} />
        </div>
      ) : null}
    </section>
  );
}
