"use client";

import { useRef, useState } from "react";
import { useFormValue, useSyncState, type TextInputProps } from "sanity";
import { Button, Card, Stack, Text } from "@sanity/ui";

const messages: Record<string, string> = {
  "overview-conflict": "บทความเปลี่ยนระหว่างสร้างสรุป กรุณาโหลดฉบับล่าสุดแล้วลองใหม่",
  "overview-source-too-large": "เนื้อหายาวเกินขอบเขตที่ระบบสรุปได้อย่างครบถ้วน กรุณาเขียนสรุปเองในช่องนี้",
  "overview-model-unavailable": "โมเดลสรุปยังไม่พร้อม ข้อความเดิมไม่ได้ถูกเขียนทับ",
  "overview-invalid-result": "สรุปยังไม่ผ่านกติกา จึงไม่ได้บันทึกลงบทความ",
  "forbidden": "บัญชีนี้ไม่มีสิทธิ์สร้างสรุปบทความ",
};
export default function ArticleOverviewInput(props: TextInputProps) {
  const id = String(useFormValue(["_id"]) ?? "").replace(/^drafts\./, "");
  const revision = useFormValue(["_rev"]);
  const sync = useSyncState(id, "article");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const pending = useRef(false);
  const exists = Boolean(props.value?.trim());
  async function generate() {
    if (pending.current || busy || exists || sync.isSyncing || !id || typeof revision !== "string") return;
    pending.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/content/${encodeURIComponent(id)}/overview/generate/`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceRevision: revision, requestId: crypto.randomUUID() }) });
      const result = await response.json();
      if (!response.ok || !["applied", "skipped-existing"].includes(result.status)) throw new Error(messages[result.error] ?? "ระบบยังสร้างสรุปไม่สำเร็จ กรุณาลองใหม่ หรือเขียนข้อความเองได้");
      setMessage("บันทึกสรุปใน Draft แล้ว ตรวจแก้ข้อความและอนุมัติบทความก่อน Publish ตามปกติ");
    } catch (error) { setMessage(error instanceof Error ? error.message : "ยังสร้างสรุปไม่สำเร็จ"); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Stack gap={3}>
    {props.renderDefault(props)}
    <Card padding={3} border radius={2}><Stack gap={3}>
      <Text size={1}>สรุปสั้น 2 ประเด็นว่าบทความนี้พูดถึงอะไร คุณแก้ข้อความเองได้ การสร้างสรุปยังไม่เผยแพร่หน้าเว็บ</Text>
      <Button text={busy ? "กำลังสร้างสรุป…" : exists ? "มีสรุปแล้ว" : "Gen สรุปบทความ"} disabled={busy || exists || sync.isSyncing || !id || typeof revision !== "string" || props.readOnly} onClick={() => void generate()} />
      {exists && <Text size={1} muted>หากต้องการสร้างใหม่ ให้ตรวจแล้วล้างข้อความเดิมและรอให้ Draft บันทึกก่อน</Text>}
      {message && <Text size={1}><span role="status">{message}</span></Text>}
    </Stack></Card>
  </Stack>;
}
