export function ownerAgentJobKindLabel(kind: string): string {
  if (kind === "exports.google_sheet · export.google_sheet") return "Google Sheet Export";
  return "Agent OS Workflow";
}
