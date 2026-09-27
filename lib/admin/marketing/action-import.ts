import "server-only";
import { z } from "zod";
import { neon } from "@neondatabase/serverless";
import { marketingActionSchema } from "./model";
import { adminOperationsRuntimeInputFromEnvironment, resolveAdminOperationsRuntimeIdentity } from "../operations/foundation";
export const MARKETING_WORKSPACE_ID="1zpXXHuQ152wSZXdHb0yFJPVcdQiGOHvz4Yhxrmjdo-o";
export const marketingActionImportSchema=z.object({spreadsheetId:z.literal(MARKETING_WORKSPACE_ID),rows:z.array(marketingActionSchema.extend({importKey:z.string().regex(/^[A-Za-z0-9:_-]{1,120}$/)})).max(100)}).strict();
export async function importMarketingActions(input:z.infer<typeof marketingActionImportSchema>,variables:Record<string,string|undefined>=process.env){const p=marketingActionImportSchema.parse(input);if(!resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment(variables))||!variables.CCPUN_ADMIN_DATABASE_URL?.trim())throw new Error("MARKETING_DATABASE_NOT_READY");const rows=await neon(variables.CCPUN_ADMIN_DATABASE_URL.trim()).query("SELECT ccpun_admin.admin_import_marketing_actions($1::jsonb) AS data",[JSON.stringify(p)]);return rows[0]?.data;}
