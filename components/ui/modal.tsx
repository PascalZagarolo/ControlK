'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  parseSelectChildren,
} from './select';

export function Modal({
  open,
  onClose,
  title,
  kicker,
  children,
  maxWidth = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  kicker?: string;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh]"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={panelRef}
        style={{ maxWidth }}
        className="relative w-[calc(100vw-32px)] overflow-hidden rounded-[14px] border border-white/[0.08] bg-[rgba(14,15,18,0.96)] shadow-panel backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            {kicker && (
              <div className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
                {kicker}
              </div>
            )}
            <h2 className="mt-1 text-[18px] font-medium leading-tight tracking-[-0.2px] text-ink-50">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-50"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ModalField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        {label}
      </label>
      {children}
      {hint && <span className="text-[11px] text-ink-300">{hint}</span>}
    </div>
  );
}

export const ModalInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function ModalInput({ className, ...props }, ref) {
    return (
      <input
        {...props}
        ref={ref}
        className={[
          'block w-full rounded-[8px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] text-ink-50 outline-none transition-colors placeholder:text-ink-300 focus:border-white/[0.20] focus:bg-white/[0.05] disabled:opacity-50',
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
      />
    );
  }
);

export function ModalTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="block w-full resize-none rounded-[8px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] leading-[1.55] text-ink-50 outline-none transition-colors placeholder:text-ink-300 focus:border-white/[0.20] focus:bg-white/[0.05]"
    />
  );
}

/**
 * ModalSelect — drop-in replacement for native <select>.
 * Accepts <option> / <optgroup> children (legacy API) and renders a
 * dark, shadcn-style Radix Select. Form submission still works via a
 * hidden input[type="hidden"] that mirrors the chosen value.
 */
// Radix Select forbids "" as item value. Map external "" ↔ this sentinel.
const EMPTY_SENTINEL = '__none__';
const extToInt = (v: string) => (v === '' ? EMPTY_SENTINEL : v);
const intToExt = (v: string) => (v === EMPTY_SENTINEL ? '' : v);

export function ModalSelect({
  name,
  value,
  defaultValue,
  onChange,
  children,
  disabled,
  required,
  placeholder,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  children: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  const items = parseSelectChildren(children);
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string>(defaultValue ?? '');
  const currentExt = isControlled ? (value ?? '') : internal;
  const currentInt = extToInt(currentExt);

  const allOptions = items.flatMap((it) =>
    it.kind === 'option' ? [it.option] : it.group.options
  );
  const labelForCurrent = allOptions.find((o) => o.value === currentExt)?.label;

  const handleChange = (intVal: string) => {
    const ext = intToExt(intVal);
    if (!isControlled) setInternal(ext);
    onChange?.({ target: { value: ext, name } });
  };

  return (
    <>
      <Select value={currentInt} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger>
          {labelForCurrent ? (
            <span className="truncate text-left">{labelForCurrent}</span>
          ) : (
            <SelectValue placeholder={placeholder ?? '— bitte wählen —'} />
          )}
        </SelectTrigger>
        <SelectContent>
          {items.map((it, idx) =>
            it.kind === 'option' ? (
              <SelectItem
                key={`opt-${idx}-${it.option.value}`}
                value={extToInt(it.option.value)}
                disabled={it.option.disabled}
              >
                {it.option.label || '— leer —'}
              </SelectItem>
            ) : (
              <SelectGroup key={`grp-${idx}-${it.group.label}`}>
                <SelectLabel>{it.group.label}</SelectLabel>
                {it.group.options.map((op, j) => (
                  <SelectItem
                    key={`g-${idx}-${j}-${op.value}`}
                    value={extToInt(op.value)}
                    disabled={op.disabled}
                  >
                    {op.label || '— leer —'}
                  </SelectItem>
                ))}
              </SelectGroup>
            )
          )}
        </SelectContent>
      </Select>
      {name && (
        <input type="hidden" name={name} value={currentExt} required={required} />
      )}
    </>
  );
}

export function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 flex items-center justify-end gap-2 pt-3">{children}</div>;
}

export function ModalPrimary({
  pending,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean }) {
  return (
    <button
      type="submit"
      disabled={rest.disabled || pending}
      {...rest}
      className="rounded-[8px] bg-white px-4 py-2 text-[13px] font-medium leading-none text-black transition-opacity hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? 'Bitte warten …' : children}
    </button>
  );
}

export function ModalSecondary({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className="rounded-[8px] border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[13px] font-medium leading-none text-ink-50 transition-colors hover:border-white/[0.18] hover:bg-white/[0.06]"
    >
      {children}
    </button>
  );
}

export function ModalError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-[8px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/10 px-3 py-2 text-[12.5px] leading-[1.5] text-[#ffbdbd]">
      {children}
    </div>
  );
}
