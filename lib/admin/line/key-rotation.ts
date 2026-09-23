import "server-only";

import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import {
  adminOperationsRuntimeInputFromEnvironment,
  resolveAdminOperationsRuntimeIdentity,
} from "../operations/foundation";

const rotationStatusRowSchema = z.object({
  identity_v1_count: z.coerce.number().int().nonnegative(),
  identity_v2_count: z.coerce.number().int().nonnegative(),
  provider_message_v1_count: z.coerce.number().int().nonnegative(),
  provider_message_v2_count: z.coerce.number().int().nonnegative(),
  message_content_v1_count: z.coerce.number().int().nonnegative(),
  message_content_v2_count: z.coerce.number().int().nonnegative(),
  outbound_content_v1_count: z.coerce.number().int().nonnegative(),
  outbound_content_v2_count: z.coerce.number().int().nonnegative(),
  advisor_note_v1_count: z.coerce.number().int().nonnegative(),
  advisor_note_v2_count: z.coerce.number().int().nonnegative(),
  rotatable_v1_count: z.coerce.number().int().nonnegative(),
  admin_only_v1_count: z.coerce.number().int().nonnegative(),
  total_v1_count: z.coerce.number().int().nonnegative(),
  unsupported_version_count: z.coerce.number().int().nonnegative(),
  encrypted_unsent_count: z.coerce.number().int().nonnegative(),
  all_v1_zero: z.boolean(),
});

export type LineKeyRotationStatus =
  | {
      state: "ready";
      activeVersion: "1" | "2";
      v2Configured: boolean;
      lazyRotationEnabled: boolean;
      identityV1Count: number;
      identityV2Count: number;
      providerMessageV1Count: number;
      providerMessageV2Count: number;
      messageContentV1Count: number;
      messageContentV2Count: number;
      outboundContentV1Count: number;
      outboundContentV2Count: number;
      advisorNoteV1Count: number;
      advisorNoteV2Count: number;
      rotatableV1Count: number;
      adminOnlyV1Count: number;
      totalV1Count: number;
      unsupportedVersionCount: number;
      encryptedUnsentCount: number;
      allV1Zero: boolean;
    }
  | {
      state: "not_ready" | "unavailable";
      activeVersion: "1" | "2";
      v2Configured: boolean;
      lazyRotationEnabled: boolean;
    };

function activeVersion(variables: Record<string, string | undefined>): "1" | "2" {
  return variables.CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION?.trim() === "2" ? "2" : "1";
}

export async function readLineKeyRotationStatus(
  variables: Record<string, string | undefined> = process.env,
): Promise<LineKeyRotationStatus> {
  const safeRuntime = {
    activeVersion: activeVersion(variables),
    v2Configured: Boolean(variables.CCPUN_LINE_ENCRYPTION_KEY_V2?.trim()),
    lazyRotationEnabled: variables.CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED?.trim() === "true",
  } as const;

  const runtime = resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment(variables));
  const connectionString = variables.CCPUN_ADMIN_DATABASE_URL?.trim();
  if (!runtime || !connectionString) return { state: "not_ready", ...safeRuntime };

  try {
    const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(5_000) } });
    const rows = rotationStatusRowSchema.array().parse(await sql.query(
      `SELECT
         identity_v1_count,identity_v2_count,
         provider_message_v1_count,provider_message_v2_count,
         message_content_v1_count,message_content_v2_count,
         outbound_content_v1_count,outbound_content_v2_count,
         advisor_note_v1_count,advisor_note_v2_count,
         rotatable_v1_count,admin_only_v1_count,total_v1_count,
         unsupported_version_count,encrypted_unsent_count,all_v1_zero
       FROM private_line.admin_read_line_key_rotation_status()`,
      [],
    ));
    const row = rows[0];
    if (!row) return { state: "unavailable", ...safeRuntime };
    return {
      state: "ready",
      ...safeRuntime,
      identityV1Count: row.identity_v1_count,
      identityV2Count: row.identity_v2_count,
      providerMessageV1Count: row.provider_message_v1_count,
      providerMessageV2Count: row.provider_message_v2_count,
      messageContentV1Count: row.message_content_v1_count,
      messageContentV2Count: row.message_content_v2_count,
      outboundContentV1Count: row.outbound_content_v1_count,
      outboundContentV2Count: row.outbound_content_v2_count,
      advisorNoteV1Count: row.advisor_note_v1_count,
      advisorNoteV2Count: row.advisor_note_v2_count,
      rotatableV1Count: row.rotatable_v1_count,
      adminOnlyV1Count: row.admin_only_v1_count,
      totalV1Count: row.total_v1_count,
      unsupportedVersionCount: row.unsupported_version_count,
      encryptedUnsentCount: row.encrypted_unsent_count,
      allV1Zero: row.all_v1_zero,
    };
  } catch {
    return { state: "unavailable", ...safeRuntime };
  }
}
