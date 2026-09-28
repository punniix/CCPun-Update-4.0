export function ownerAgentJobKindLabel(kind: string): string {
  if (kind === "exports.google_sheet · export.google_sheet") return "สร้างหรืออัปเดต Google Sheet";
  return "งานอัตโนมัติอื่น";
}
