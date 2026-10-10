import { z } from "zod";

// Only a signed/credentialed UAT webhook may issue this compact receipt.
// A transport 2xx is not proof that n8n accepted or processed a durable job.
const safeAckSchema = z.object({
  accepted: z.literal(true),
  environment: z.literal("admin-uat"),
  jobId: z.string().uuid(),
  correlationId: z.string().uuid(),
  receiptVerified: z.literal(true),
  n8nExecutionId: z.string().regex(/^[1-9][0-9]{0,159}$/),
}).strict();

export function readScopedUatAck(value: unknown, expected: { jobId: string; correlationId: string }) {
  const parsed = safeAckSchema.safeParse(value);
  return parsed.success && parsed.data.jobId === expected.jobId && parsed.data.correlationId === expected.correlationId
    ? parsed.data : null;
}
