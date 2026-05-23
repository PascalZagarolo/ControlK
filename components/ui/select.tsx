'use client';

import * as React from 'react';
import * as RS from '@radix-ui/react-select';

// ─── Atomic shadcn-style API ──────────────────────────────────

export const Select = RS.Root;
export const SelectGroup = RS.Group;
export const SelectValue = RS.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof RS.Trigger>,
  React.ComponentPropsWithoutRef<typeof RS.Trigger> & { className?: string }
>(function SelectTrigger({ className, children, ...props }, ref) {
  return (
    <RS.Trigger
      ref={ref}
      {...props}
      className={
        'flex h-9 w-full items-center justify-between rounded-[8px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] leading-none text-ink-50 outline-none transition-colors placeholder:text-ink-300 hover:bg-white/[0.05] focus:border-white/[0.20] focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-ink-300 ' +
        (className ?? '')
      }
    >
      {children}
      <RS.Icon asChild>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-2 shrink-0 opacity-60"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </RS.Icon>
    </RS.Trigger>
  );
});

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof RS.Content>,
  React.ComponentPropsWithoutRef<typeof RS.Content> & { className?: string }
>(function SelectContent({ className, children, position = 'popper', ...props }, ref) {
  return (
    <RS.Portal>
      <RS.Content
        ref={ref}
        position={position}
        sideOffset={4}
        {...props}
        className={
          'z-[300] max-h-[--radix-select-content-available-height] min-w-[--radix-select-trigger-width] overflow-y-auto rounded-[10px] border border-white/[0.10] bg-[#16181d] p-1 shadow-xl backdrop-blur-md ' +
          (className ?? '')
        }
      >
        <RS.Viewport className="p-0.5">{children}</RS.Viewport>
      </RS.Content>
    </RS.Portal>
  );
});

export const SelectLabel = React.forwardRef<
  React.ElementRef<typeof RS.Label>,
  React.ComponentPropsWithoutRef<typeof RS.Label> & { className?: string }
>(function SelectLabel({ className, ...props }, ref) {
  return (
    <RS.Label
      ref={ref}
      {...props}
      className={
        'px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300 ' +
        (className ?? '')
      }
    />
  );
});

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof RS.Item>,
  React.ComponentPropsWithoutRef<typeof RS.Item> & { className?: string }
>(function SelectItem({ className, children, ...props }, ref) {
  return (
    <RS.Item
      ref={ref}
      {...props}
      className={
        'relative flex w-full cursor-pointer select-none items-center rounded-[6px] py-1.5 pl-2 pr-7 text-[13px] text-ink-100 outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-ink-50 data-[disabled]:opacity-40 ' +
        (className ?? '')
      }
    >
      <RS.ItemText>{children}</RS.ItemText>
      <RS.ItemIndicator className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5eb6ff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      </RS.ItemIndicator>
    </RS.Item>
  );
});

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof RS.Separator>,
  React.ComponentPropsWithoutRef<typeof RS.Separator>
>(function SelectSeparator(props, ref) {
  return (
    <RS.Separator
      ref={ref}
      {...props}
      className="-mx-1 my-1 h-px bg-white/[0.06]"
    />
  );
});

// ─── Compact inline trigger (for drawers, toolbars) ─────────────
export const SelectTriggerInline = React.forwardRef<
  React.ElementRef<typeof RS.Trigger>,
  React.ComponentPropsWithoutRef<typeof RS.Trigger> & { className?: string }
>(function SelectTriggerInline({ className, children, ...props }, ref) {
  return (
    <RS.Trigger
      ref={ref}
      {...props}
      className={
        'inline-flex h-7 items-center gap-1.5 rounded-[6px] border border-white/[0.08] bg-white/[0.02] px-2 text-[11.5px] leading-none text-ink-200 outline-none transition-colors hover:bg-white/[0.05] focus:border-white/[0.20] data-[placeholder]:text-ink-300 ' +
        (className ?? '')
      }
    >
      {children}
      <RS.Icon asChild>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-60"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </RS.Icon>
    </RS.Trigger>
  );
});

// ─── Children parsing helper ───────────────────────────────────
// Lets the legacy ModalSelect API (children = <option>/<optgroup>) work
// without changing 21 call-sites.

type ParsedOption = { value: string; label: string; disabled?: boolean };
type ParsedGroup = { label: string; options: ParsedOption[] };
type ParsedNode = { kind: 'option'; option: ParsedOption } | { kind: 'group'; group: ParsedGroup };

export function parseSelectChildren(children: React.ReactNode): ParsedNode[] {
  const out: ParsedNode[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === 'option') {
      const props = child.props as {
        value?: string | number;
        children?: React.ReactNode;
        disabled?: boolean;
      };
      out.push({
        kind: 'option',
        option: {
          value: String(props.value ?? ''),
          label: String(props.children ?? ''),
          disabled: props.disabled,
        },
      });
    } else if (child.type === 'optgroup') {
      const props = child.props as { label?: string; children?: React.ReactNode };
      const opts: ParsedOption[] = [];
      React.Children.forEach(props.children, (sub) => {
        if (!React.isValidElement(sub) || sub.type !== 'option') return;
        const op = sub.props as {
          value?: string | number;
          children?: React.ReactNode;
          disabled?: boolean;
        };
        opts.push({
          value: String(op.value ?? ''),
          label: String(op.children ?? ''),
          disabled: op.disabled,
        });
      });
      out.push({ kind: 'group', group: { label: String(props.label ?? ''), options: opts } });
    }
  });
  return out;
}
