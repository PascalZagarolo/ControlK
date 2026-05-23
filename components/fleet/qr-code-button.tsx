'use client';

import { useEffect, useState } from 'react';
import { Modal, ModalActions, ModalSecondary } from '@/components/ui/modal';

export function QrCodeButton({
  vehiclePlate,
  vehicleExternalId,
}: {
  vehiclePlate: string;
  vehicleExternalId: string;
}) {
  const [open, setOpen] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/flotte/${vehicleExternalId}` : '';

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        // Use qrcode dynamic import — only when modal opens
        const mod = await import('qrcode');
        const svg = await mod.toString(url, {
          type: 'svg',
          margin: 1,
          color: { dark: '#f1efe8', light: '#0a0b0d00' },
        });
        if (!cancelled) setQrSvg(svg);
      } catch {
        if (!cancelled)
          setQrSvg(
            '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><text x="100" y="100" text-anchor="middle" fill="#ff8a8a" font-family="monospace" font-size="12">qrcode-Modul fehlt</text></svg>'
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 text-[12px] text-ink-200 hover:border-white/[0.18] hover:bg-white/[0.05] hover:text-ink-50"
      >
        ▦ QR-Code
      </button>
      <Modal open={open} onClose={() => setOpen(false)} kicker="QR-Code" title={vehiclePlate} maxWidth={400}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="aspect-square w-[280px] rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4"
            dangerouslySetInnerHTML={{ __html: qrSvg ?? '' }}
          />
          <p className="text-center text-[11.5px] leading-[1.5] text-ink-300">
            Drucken & am Fahrzeug ankleben.
            <br />
            Scan → öffnet diese Seite.
          </p>
          <p className="break-all font-mono text-[10px] text-ink-400">{url}</p>
          <ModalActions>
            <ModalSecondary onClick={() => setOpen(false)}>Schließen</ModalSecondary>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-[8px] bg-white px-3 py-2 text-[12px] font-medium text-black"
            >
              Drucken
            </button>
          </ModalActions>
        </div>
      </Modal>
    </>
  );
}
