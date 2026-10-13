import type { FundDetailResponse } from "./domain/types";
import styles from "./InvestmentAllocation.module.css";

export default function FundSharpeFact({ detail, projectId, className }: {
  detail: FundDetailResponse;
  projectId: string;
  className: string | null;
}) {
  const fact = detail.statistics;
  const classRequired = detail.classes.length > 0 && !className;
  const matched = !classRequired && detail.state !== "unavailable" && (detail.source === "sec_v2" || detail.source === "uat_synthetic") &&
    detail.fund?.projectId === projectId && fact?.projectId === projectId &&
    fact.className === (className ?? "main") && detail.selectedClassName === className;
  const value = matched && typeof fact?.sharpeRatio === "number" && Number.isFinite(fact.sharpeRatio) ? fact.sharpeRatio : null;

  return <section className={styles.resultPanel} aria-label="Sharpe Ratio ของกองทุน">
    <h3>Sharpe Ratio</h3>
    {classRequired ? <p>เลือกชนิดหน่วยลงทุนก่อน เพื่อดูค่าของชนิดหน่วยที่เลือก</p> : <dl className={styles.factRows}>
      <div><dt>ค่าที่กองทุนรายงาน</dt><dd>{value === null ? "ยังไม่มีข้อมูลที่ยืนยันได้" : value}</dd></div>
    </dl>}
    {matched ? <p className={styles.provenance}>ชนิดหน่วย: {fact!.className} · วันที่เริ่มใช้ factsheet: {fact!.factsheetStartDate ?? "ไม่ระบุ"} · วันที่สิ้นสุด: {fact!.factsheetEndDate ?? "ไม่ระบุ"} · อัปเดตข้อมูล: {fact!.lastUpdated ?? "ไม่ระบุ"}</p> : null}
    <details>
      <summary className={styles.smallButton}>ค่านี้บอกอะไร และมีข้อจำกัดอย่างไร</summary>
      <p className={styles.provenance}>ผลตอบแทนส่วนเกินจากอัตราผลตอบแทนไร้ความเสี่ยงต่อความผันผวนของผลตอบแทน ไม่ใช่เปอร์เซ็นต์ผลตอบแทนหรือคะแนนความเหมาะสมของกองทุน</p>
      <p className={styles.provenance}>API นี้รายงาน Sharpe Ratio สำหรับกองทุนหุ้น แต่ไม่ได้ระบุช่วงเวลาที่ใช้คำนวณ วันที่ factsheet ไม่ใช่ช่วงเวลาวัดผล จึงไม่ใช้ค่านี้จัดอันดับกองทุนหรือคำนวณ Sharpe ของพอร์ต</p>
      <p className={styles.provenance}>{detail.source === "uat_synthetic" ? "ข้อมูลสังเคราะห์สำหรับทดสอบ UAT เท่านั้น" : <>แหล่งข้อมูล: <a href="https://secopendata.sec.or.th/sec-open-apis?user=developer&type=fund&id=getFactsheetStatisticsinfo" target="_blank" rel="noopener noreferrer">SEC Open Data · สถิติ factsheet</a></>}</p>
    </details>
  </section>;
}
