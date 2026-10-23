'use client';
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";

export default function CookieSettingsButton({ className = '' }: { className?: string }) {
  const text = usePublicCopy();
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('ccpun:openCookieSettings'))}
      className={`inline-flex min-h-11 items-center text-[13px] text-muted-foreground hover:text-primary transition-colors ${className}`.trim()}
    >{text.node("site.cookie.settings")}</button>
  );
}
