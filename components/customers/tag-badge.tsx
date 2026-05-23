'use client';

import type { CustomerTag } from '@/lib/types';

export function TagBadge({
  tag,
  removable,
  onRemove,
}: {
  tag: CustomerTag;
  removable?: boolean;
  onRemove?: () => void;
}) {
  const color = tag.color ?? '#9c9c9d';
  return (
    <span
      className="inline-flex h-5 items-center gap-1 rounded-[4px] px-1.5 text-[10.5px] font-medium"
      style={{ background: `${color}24`, color: '#e6e7ec', boxShadow: `inset 0 0 0 1px ${color}55` }}
    >
      <span className="inline-block h-1 w-1 rounded-full" style={{ background: color }} />
      {tag.name}
      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Tag entfernen"
          className="ml-0.5 text-ink-300 transition-colors hover:text-ink-50"
        >
          ×
        </button>
      )}
    </span>
  );
}
