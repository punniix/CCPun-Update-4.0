export function State({ ok, yes = "พร้อม", no = "ต้องตั้งค่า" }: { ok: boolean; yes?: string; no?: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${ok ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-amber-200/20 bg-amber-200/10 text-amber-50"}`}>{ok ? yes : no}</span>;
}

export function Row({ label, value, state }: { label: string; value: string; state?: boolean }) {
  return <div className="flex min-h-12 items-center justify-between gap-4 border-t border-white/10 py-3 first:border-t-0"><div><p className="text-sm font-medium text-white/85">{label}</p><p className="mt-1 text-xs text-white/45">{value}</p></div>{state === undefined ? null : <State ok={state} />}</div>;
}
