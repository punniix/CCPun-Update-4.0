'use client';

import { useState, useCallback } from 'react';
import functionalMotion from '@/components/ui/FunctionalMotion.module.css';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  id?: string;
  showZero?: boolean;
  'aria-describedby'?: string;
}

/** รับเฉพาะจำนวนเต็มบวก และหยุดที่จุดทศนิยมเพื่อไม่ให้ 30,000.00 กลายเป็น 3,000,000 */
function normalizeInput(raw: string): string {
  if (raw.includes('-')) return '';
  const digits = raw.split('.', 1)[0].replace(/[^0-9]/g, '');
  const normalized = digits.replace(/^0+(?=\d)/, '');
  if (!normalized) return '';
  const value = Number(normalized);
  return Number.isSafeInteger(value) ? normalized : '';
}

/** แสดงตัวเลขมี comma "1,500,000" */
function formatWithCommas(n: number): string {
  return Number.isSafeInteger(n) && n >= 0
    ? n.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : '';
}

export default function CurrencyInput({
  value,
  onChange: onValueChange,
  placeholder = 'ใส่ตัวเลข',
  className,
  error,
  id,
  showZero = false,
  'aria-describedby': ariaDescribedby,
}: CurrencyInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  // displayValue = string ที่แสดงใน input (single source of truth)
  // เริ่มต้นว่าง (เห็น placeholder) ถ้า value=0, มิฉะนั้นแสดงค่าจาก prop
  const [displayValue, setDisplayValue] = useState<string>(
    value === 0 && !showZero ? '' : formatWithCommas(value)
  );

  const formattedValue = value === 0 && !showZero ? '' : formatWithCommas(value);
  const inputValue = isFocused ? displayValue : formattedValue;

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // ขณะ focus ถอด comma ออกเพื่อให้พิมพ์ต่อได้ง่าย
    // ถ้า displayValue ว่างหรือ "0" ก็คงไว้ตามเดิม
    if (inputValue !== '' && inputValue !== '0') {
      setDisplayValue(inputValue.replace(/,/g, ''));
    } else {
      setDisplayValue(inputValue);
    }
  }, [inputValue]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // ใส่ comma กลับเมื่อ blur
    if (displayValue === '') return; // ว่างอยู่แล้ว → แสดง placeholder
    const normalized = normalizeInput(displayValue);
    const n = normalized ? Number(normalized) : 0;
    setDisplayValue(n === 0 && !showZero ? '' : formatWithCommas(n));
  }, [displayValue, showZero]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const normalized = normalizeInput(raw);

      setDisplayValue(normalized);

      onValueChange(normalized === '' ? 0 : Number(normalized));
    },
    [onValueChange]
  );

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
        ฿
      </span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={inputValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        aria-describedby={ariaDescribedby}
        aria-invalid={error || undefined}
        className={cn(
          'bg-background/50 border-border/50 focus:border-primary/50 h-12 text-foreground placeholder:text-muted-foreground pl-8',
          functionalMotion.inputFeedback,
          error && 'border-destructive',
          className
        )}
      />
    </div>
  );
}
