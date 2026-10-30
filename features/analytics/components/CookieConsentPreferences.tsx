'use client';
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";

import { useState } from 'react';
import styles from './CookieConsent.module.css';

// ─── Toggle Switch (CSS-only) ────────────────────────────────────
function ToggleSwitch({
  checked,
  onChange,
  disabled,
  id,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  id: string;
  label: string;
}) {
  const text = usePublicCopy();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={styles.switch}
      aria-label={`${label}: ${disabled ? text("site.cookie.ariaAlwaysActive") : checked ? text("site.toggleSwitchText") : text("site.toggleSwitchText2")}`}
    >
      <span aria-hidden="true" className={styles.track}>
        <span className={styles.knob} />
      </span>
    </button>
  );
}

// ─── Cookie Category Row (Expandable) ─────────────────────────────
export function CategoryRow({
  label,
  description,
  checked,
  onChange,
  alwaysActive,
  toggleId,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  alwaysActive?: boolean;
  toggleId: string;
}) {
  const text = usePublicCopy();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.row}>
      {/* Row หลัก */}
      <div className={styles.rowMain}>
        {/* + icon + label */}
        <div className={styles.rowLabelGroup}>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-controls={`desc-${toggleId}`}
            className={styles.expand}
            aria-label={expanded ? text("site.categoryRowText") : text("site.categoryRowText2")}
          >
            {expanded ? '−' : '+'}
          </button>
          <label
            htmlFor={alwaysActive ? undefined : toggleId}
            className={styles.rowLabel}
            data-always-active={alwaysActive ? 'true' : undefined}
          >
            {label}
          </label>
        </div>

        {/* toggle หรือ Always Active text */}
        {alwaysActive ? (
          <span className={styles.alwaysActive}>{text.node("site.cookie.alwaysActive")}</span>
        ) : (
          <ToggleSwitch
            checked={checked}
            onChange={onChange}
            id={toggleId}
            label={label}
          />
        )}
      </div>

      {/* คำอธิบาย (expand) */}
      {expanded && (
        <div
          id={`desc-${toggleId}`}
          className={styles.rowDescription}
        >
          <p>
            {description}
          </p>
        </div>
      )}
    </div>
  );
}
