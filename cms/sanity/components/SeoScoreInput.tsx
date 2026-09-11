"use client";

import type { ObjectInputProps } from "sanity";
import { Badge, Card, Flex, Stack, Text } from "@sanity/ui";

type SeoValue = {
  auditSnapshot?: {
    score?: number;
    criticalIssues?: number;
    warnings?: number;
    passedChecks?: number;
    auditedAt?: string;
  };
};

function formatDate(value?: string) {
  if (!value) return "ไม่ทราบเวลา";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

export default function SeoScoreInput(props: ObjectInputProps<SeoValue>) {
  const snapshot = props.value?.auditSnapshot;
  const score = snapshot?.score;
  const tone = score == null ? "default" : score >= 85 ? "positive" : score >= 70 ? "primary" : score >= 50 ? "caution" : "critical";

  return (
    <Stack gap={4}>
      <Card padding={4} radius={3} border>
        <Stack gap={2}>
          <Text size={1} weight="semibold">SEO Control Center</Text>
          <Text size={1}>
            แก้ SEO Title, Meta Description, Search Intent และ Semantic Topic ได้ในฟอร์มด้านล่าง ส่วนความพร้อม SEO / GEO แบบสดให้ตรวจใน Control Plane เพื่อไม่คำนวณผลตรวจซ้ำใน Studio
          </Text>
          <Text size={1} muted>
            URL Slug, หมวดหมู่ที่กำหนด path, Canonical override และ Noindex เป็น Protected fields หลังบทความมีวันเผยแพร่
          </Text>
          <Text size={1} muted>
            Semantic Topic แยกจาก URL จริง จึงใช้จัด Knowledge Graph ได้โดยไม่ต้องย้าย canonical path
          </Text>
        </Stack>
      </Card>

      <Card padding={4} radius={3} border tone={tone}>
        <Stack gap={3}>
          <Flex align="center" justify="space-between" gap={3}>
            <Stack gap={2}>
              <Text size={1} weight="semibold">ผลตรวจ SEO ล่าสุดที่บันทึก</Text>
              <Text size={4} weight="bold">{score == null ? "ยังไม่ตรวจ" : `${score}/100`}</Text>
            </Stack>
            {score != null ? <Badge tone={tone}>ตรวจเมื่อ {formatDate(snapshot?.auditedAt)}</Badge> : null}
          </Flex>
          {score != null ? (
            <Text size={1}>ผ่าน {snapshot?.passedChecks ?? 0} · จุดสำคัญ {snapshot?.criticalIssues ?? 0} · คำเตือน {snapshot?.warnings ?? 0}</Text>
          ) : null}
          <Text size={1} muted>หากแก้บทความหลังเวลานี้ ให้กดตรวจ SEO ใหม่ใน Control Plane คะแนนเป็นกฎภายในของ CCPun ไม่ใช่คะแนนจาก Google</Text>
        </Stack>
      </Card>
      {props.renderDefault(props)}
    </Stack>
  );
}
