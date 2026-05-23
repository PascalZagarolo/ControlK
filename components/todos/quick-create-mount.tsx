'use client';

import { useUIStore } from '@/lib/stores/ui-store';
import { QuickCreateModal } from './quick-create-modal';

export function QuickCreateMount() {
  const open = useUIStore((s) => s.quickCreateOpen);
  const setOpen = useUIStore((s) => s.setQuickCreateOpen);
  return <QuickCreateModal open={open} onClose={() => setOpen(false)} />;
}
