'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Modal,
  ModalActions,
  ModalError,
  ModalField,
  ModalInput,
  ModalPrimary,
  ModalSecondary,
  ModalSelect,
  ModalTextarea,
} from '@/components/ui/modal';
import {
  addVehicleDamage,
  deleteVehicleDamage,
  toggleDamageResolved,
} from '@/lib/actions/vehicles';
import type { VehicleDamageEntry, VehicleDamageSeverity } from '@/lib/types';

const SEVERITY_META: Record<
  VehicleDamageSeverity,
  { color: string; label: string }
> = {
  minor: { color: '#5eb6ff', label: 'Klein' },
  major: { color: '#ffd96a', label: 'Groß' },
  totalschaden: { color: '#ff8a8a', label: 'Total' },
};

function fmtEur(cents?: number) {
  if (cents == null) return '—';
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

export function DamageGallery({
  vehicleId,
  damages,
  customers,
}: {
  vehicleId: string;
  damages: VehicleDamageEntry[];
  customers: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Schäden · {damages.length}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-ink-200 hover:border-white/[0.18] hover:bg-white/[0.05]"
        >
          + Schaden melden
        </button>
      </div>

      {damages.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-white/[0.08] bg-white/[0.01] py-6 text-center text-[12px] text-ink-300">
          Keine Schäden dokumentiert.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {damages.map((d) => (
            <DamageCard key={d.id} damage={d} />
          ))}
        </div>
      )}

      <AddDamageModal
        open={open}
        onClose={() => setOpen(false)}
        vehicleId={vehicleId}
        customers={customers}
      />
    </div>
  );
}

function DamageCard({ damage }: { damage: VehicleDamageEntry }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const sev = SEVERITY_META[damage.severity];
  return (
    <div
      className={`group flex flex-col gap-2 rounded-[10px] border bg-white/[0.02] p-3 transition-opacity ${
        damage.resolved ? 'opacity-60' : ''
      }`}
      style={{ borderColor: `${sev.color}33` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-4 items-center gap-1 rounded-full px-1.5 font-mono text-[9px] uppercase tracking-[0.3px]"
            style={{ background: `${sev.color}1f`, color: sev.color }}
          >
            {sev.label}
          </span>
          <span className="font-mono text-[10px] text-ink-300">
            {new Date(damage.date).toLocaleDateString('de-DE')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              start(async () => {
                await toggleDamageResolved(damage.id);
                router.refresh();
              })
            }
            disabled={pending}
            className="rounded-[4px] border border-white/[0.08] bg-white/[0.02] px-1.5 py-0.5 text-[10px] text-ink-300 hover:border-white/[0.18] hover:text-ink-50"
          >
            {damage.resolved ? '↺' : '✓'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirm('Schaden löschen?')) return;
              start(async () => {
                await deleteVehicleDamage(damage.id);
                router.refresh();
              });
            }}
            disabled={pending}
            className="rounded-[4px] text-[11px] text-ink-300 hover:text-[#ff8a8a]"
          >
            ×
          </button>
        </div>
      </div>
      {damage.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={damage.photoUrl}
          alt={damage.title}
          className="aspect-video w-full rounded-[6px] object-cover"
        />
      )}
      <p className="text-[13px] font-medium leading-snug text-ink-50">{damage.title}</p>
      {damage.description && (
        <p className="line-clamp-2 text-[11.5px] leading-[1.45] text-ink-300">{damage.description}</p>
      )}
      <div className="flex items-center justify-between text-[10.5px] text-ink-300">
        <div className="flex items-center gap-2">
          {damage.customerName && damage.customerId && (
            <Link
              href={`/kunden/${damage.customerId}`}
              className="font-mono uppercase tracking-[0.3px] hover:text-ink-50"
            >
              ◉ {damage.customerName}
            </Link>
          )}
          {damage.contractTitle && damage.contractId && (
            <Link
              href={`/vertraege/${damage.contractId}`}
              className="font-mono uppercase tracking-[0.3px] hover:text-ink-50"
            >
              § {damage.contractTitle.slice(0, 16)}
            </Link>
          )}
        </div>
        {damage.costCents != null && (
          <span className="font-mono tabular-nums text-ink-200">{fmtEur(damage.costCents)}</span>
        )}
      </div>
    </div>
  );
}

function AddDamageModal({
  open,
  onClose,
  vehicleId,
  customers,
}: {
  open: boolean;
  onClose: () => void;
  vehicleId: string;
  customers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} kicker="Schaden" title="Schaden dokumentieren" maxWidth={520}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const data = new FormData(e.currentTarget);
          start(async () => {
            const res = await addVehicleDamage({
              vehicleId,
              title: String(data.get('title') ?? ''),
              severity: (String(data.get('severity') ?? 'minor') as VehicleDamageSeverity) || 'minor',
              description: String(data.get('description') ?? '') || undefined,
              costCents:
                parseInt(String(data.get('cost') ?? '').replace(/[^\d]/g, ''), 10) * 100 || undefined,
              customerId: (String(data.get('customerId') ?? '') as any) || null,
              photoUrl: String(data.get('photoUrl') ?? '') || undefined,
              occurredAt: String(data.get('occurredAt') ?? '') || undefined,
            });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onClose();
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}
        <ModalField label="Was ist passiert?">
          <ModalInput name="title" required placeholder="Kratzer Stoßstange hinten" />
        </ModalField>
        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Schwere">
            <ModalSelect name="severity" defaultValue="minor">
              <option value="minor">Klein</option>
              <option value="major">Groß</option>
              <option value="totalschaden">Totalschaden</option>
            </ModalSelect>
          </ModalField>
          <ModalField label="Datum">
            <ModalInput name="occurredAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </ModalField>
        </div>
        <ModalField label="Beschreibung (optional)">
          <ModalTextarea name="description" rows={2} placeholder="Hergang, Beobachtungen …" />
        </ModalField>
        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Kunde verursachte">
            <ModalSelect name="customerId" defaultValue="">
              <option value="">— Keiner —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </ModalSelect>
          </ModalField>
          <ModalField label="Geschätzte Kosten (€)">
            <ModalInput name="cost" type="number" placeholder="250" />
          </ModalField>
        </div>
        <ModalField label="Foto-URL (optional)" hint="Vorerst Link, später Upload via Vercel Blob">
          <ModalInput name="photoUrl" type="url" placeholder="https://…" />
        </ModalField>
        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>Schaden speichern</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}
