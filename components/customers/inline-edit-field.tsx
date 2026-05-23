'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateCustomerField } from '@/lib/actions/customers';

type Field = 'name' | 'industry' | 'status' | 'notes' | 'forecastContribution';

export function InlineEditField({
  customerId,
  field,
  value,
  placeholder,
  multiline,
  className,
  displayClassName,
  renderDisplay,
}: {
  customerId: string;
  field: Field;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  displayClassName?: string;
  renderDisplay?: (value: string) => React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() === value.trim()) return;
    start(async () => {
      const res = await updateCustomerField({ customerId, field, value: draft });
      if (!res.ok) setDraft(value);
      router.refresh();
    });
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Klick zum Bearbeiten"
        className={`group block w-full text-left ${displayClassName ?? ''}`}
      >
        {renderDisplay ? (
          renderDisplay(value)
        ) : (
          <span className={value ? '' : 'text-ink-300'}>
            {value || placeholder || '— leer —'}
          </span>
        )}
      </button>
    );
  }

  if (multiline) {
    return (
      <textarea
        ref={inputRef as React.Ref<HTMLTextAreaElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
        disabled={pending}
        rows={4}
        className={`w-full resize-none rounded-[6px] border border-white/[0.18] bg-white/[0.04] px-2.5 py-1.5 text-[13px] text-ink-50 outline-none focus:border-white/[0.30] ${className ?? ''}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <input
      ref={inputRef as React.Ref<HTMLInputElement>}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
      disabled={pending}
      className={`w-full rounded-[6px] border border-white/[0.18] bg-white/[0.04] px-2 py-1 text-[13px] text-ink-50 outline-none focus:border-white/[0.30] ${className ?? ''}`}
      placeholder={placeholder}
    />
  );
}
