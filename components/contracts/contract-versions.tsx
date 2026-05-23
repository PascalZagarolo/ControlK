'use client';

import { useState } from 'react';
import { Avatar } from '@/components/channel/avatar';
import {
  Modal,
  ModalActions,
  ModalSecondary,
} from '@/components/ui/modal';
import type { ContractRevision } from '@/lib/types';

function fmtEur(cents?: number) {
  if (cents == null) return '—';
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

export function ContractVersions({
  revisions,
  currentBody,
  currentTitle,
}: {
  revisions: ContractRevision[];
  currentBody: { heading: string; paragraphs: string[] }[];
  currentTitle: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openRev = revisions.find((r) => r.id === openId) ?? null;

  if (revisions.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-white/[0.08] bg-white/[0.01] py-4 text-center text-[12px] text-ink-300">
        Noch keine Versionen. Beim nächsten Speichern wird ein Snapshot erstellt.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {revisions.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => setOpenId(r.id)}
          className="group flex items-center gap-3 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
        >
          {r.snapshotBy && (
            <Avatar
              initials={r.snapshotBy.initials}
              from={r.snapshotBy.from}
              to={r.snapshotBy.to}
              size={22}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] text-ink-50">
              {r.snapshotBy?.name ?? 'System'}{' '}
              <span className="text-ink-300">·</span>{' '}
              <span className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
                {new Date(r.snapshotAt).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-ink-300">
              {r.body.length} Sektion{r.body.length === 1 ? '' : 'en'} · {fmtEur(r.valueCents)}
              {r.note && ` · ${r.note}`}
            </p>
          </div>
          <span className="font-mono text-[10px] text-ink-300 group-hover:text-ink-50">→</span>
        </button>
      ))}

      {openRev && (
        <Modal
          open
          onClose={() => setOpenId(null)}
          kicker={`Snapshot · ${new Date(openRev.snapshotAt).toLocaleString('de-DE')}`}
          title={openRev.title}
          maxWidth={760}
        >
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Pane label="Diese Version (Snapshot)">
                {openRev.body.length === 0 ? (
                  <p className="text-[12px] text-ink-300">— leer —</p>
                ) : (
                  openRev.body.map((s, i) => (
                    <div key={i} className="mb-3">
                      <h4 className="text-[13px] font-medium text-ink-50">{s.heading}</h4>
                      <div className="mt-1 flex flex-col gap-1 text-[12px] text-ink-200">
                        {s.paragraphs.map((p, j) => (
                          <p key={j} className="whitespace-pre-line">
                            {p}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </Pane>
              <Pane label={`Aktuell · ${currentTitle}`}>
                {currentBody.length === 0 ? (
                  <p className="text-[12px] text-ink-300">— leer —</p>
                ) : (
                  currentBody.map((s, i) => (
                    <div key={i} className="mb-3">
                      <h4 className="text-[13px] font-medium text-ink-50">{s.heading}</h4>
                      <div className="mt-1 flex flex-col gap-1 text-[12px] text-ink-200">
                        {s.paragraphs.map((p, j) => (
                          <p key={j} className="whitespace-pre-line">
                            {p}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </Pane>
            </div>
            <ModalActions>
              <ModalSecondary onClick={() => setOpenId(null)}>Schließen</ModalSecondary>
            </ModalActions>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Pane({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">{label}</p>
      <div className="max-h-[440px] overflow-y-auto">{children}</div>
    </div>
  );
}
