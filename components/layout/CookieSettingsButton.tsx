'use client';

export default function CookieSettingsButton({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('ccpun:openCookieSettings'))}
      className={`inline-flex min-h-11 items-center text-[13px] text-muted-foreground hover:text-primary transition-colors ${className}`.trim()}
    >
      ตั้งค่าคุกกี้
    </button>
  );
}
