'use client';

import { useState } from 'react';

// ─── Toggle Switch (CSS-only) ────────────────────────────────────
function ToggleSwitch({
  checked,
  onChange,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  id: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: '2.75rem',
        height: '1.75rem',
        borderRadius: '9999px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.25s',
        flexShrink: 0,
        background: disabled
          ? 'rgba(220,190,130,0.45)'
          : checked
          ? 'linear-gradient(135deg,hsl(45,60%,60%) 0%,hsl(45,70%,72%) 100%)'
          : 'rgba(74,74,74,0.8)',
        boxShadow: checked && !disabled
          ? '0 0 12px rgba(220,190,130,0.35)'
          : 'none',
        outline: 'none',
      }}
      aria-label={disabled ? 'Always Active' : checked ? 'เปิด' : 'ปิด'}
    >
      <span
        style={{
          position: 'absolute',
          top: '0.3125rem',
          left: checked ? '1.25rem' : '0.3125rem',
          width: '1.125rem',
          height: '1.125rem',
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.25s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      />
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
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Row หลัก */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.875rem 0',
        }}
      >
        {/* + icon + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-controls={`desc-${toggleId}`}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '4px',
              width: '2rem',
              height: '2rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              color: 'hsl(45,70%,65%)',
              fontSize: '0.875rem',
              lineHeight: 1,
              transition: 'border-color 0.2s',
              padding: 0,
            }}
            aria-label={expanded ? 'ซ่อนรายละเอียด' : 'แสดงรายละเอียด'}
          >
            {expanded ? '−' : '+'}
          </button>
          <label
            htmlFor={alwaysActive ? undefined : toggleId}
            style={{
              fontSize: '0.875rem',
              lineHeight: 1.55,
              fontWeight: 600,
              color: 'hsl(0 10% 92%)',
              cursor: alwaysActive ? 'default' : 'pointer',
              flex: 1,
            }}
          >
            {label}
          </label>
        </div>

        {/* toggle หรือ Always Active text */}
        {alwaysActive ? (
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'hsl(45,70%,65%)',
              flexShrink: 0,
              letterSpacing: '0.02em',
            }}
          >
            Always Active
          </span>
        ) : (
          <ToggleSwitch
            checked={checked}
            onChange={onChange}
            id={toggleId}
          />
        )}
      </div>

      {/* คำอธิบาย (expand) */}
      {expanded && (
        <div
          id={`desc-${toggleId}`}
          style={{
            padding: '0 0 0.875rem 1.75rem',
            animation: 'cookiePanelDown 0.2s ease both',
          }}
        >
          <p style={{ fontSize: '0.8125rem', color: 'hsl(0 10% 65%)', lineHeight: 1.6, margin: 0 }}>
            {description}
          </p>
        </div>
      )}
    </div>
  );
}
