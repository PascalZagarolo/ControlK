import Link from 'next/link';
import { disconnectGoogleAction } from './gmail-actions';
import type { GoogleConnection } from '@/lib/auth/google-tokens';

const GMAIL_READ = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_MODIFY = 'https://www.googleapis.com/auth/gmail.modify';

// "Gmail-Verbindung" panel for /settings/integrations.
//
// Three states:
//   1. User never signed in with Google → no connection row at all.
//   2. Signed in with Google for login only (no Gmail scope) → connected
//      identity, but no offline access. Show CTA "Mit Gmail verbinden".
//   3. Connected + Gmail scope granted → show email + scopes + disconnect.
export function GmailConnection({
  connection,
}: {
  connection: GoogleConnection | null;
}) {
  const hasModifyScope =
    !!connection && connection.scopes.includes(GMAIL_MODIFY);
  const hasReadScope =
    !!connection &&
    (hasModifyScope || connection.scopes.includes(GMAIL_READ));
  const needsUpgrade = hasReadScope && !hasModifyScope;

  return (
    <section className="flex flex-col gap-3 rounded-[12px] border border-white/[0.08] bg-white/[0.02] p-5">
      <header className="flex items-start gap-3">
        <GoogleLogo />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-medium leading-tight text-ink-50">
            Gmail
          </h2>
          <p className="mt-0.5 text-[12.5px] leading-[1.55] text-ink-300">
            Ctrl K liest deinen <span className="text-ink-100">Posteingang</span> für die
            Triage und deine <span className="text-ink-100">gesendeten Mails</span>, um deine
            Zusagen zu erkennen. Es <span className="text-ink-100">versendet nichts ohne
            deine Bestätigung</span> und gibt nichts weiter.
          </p>
        </div>
        <StatusBadge
          connection={connection}
          hasModify={hasModifyScope}
          hasRead={hasReadScope}
        />
      </header>

      {connection && (
        <div className="rounded-[8px] border border-white/[0.04] bg-black/20 px-4 py-3 text-[12.5px]">
          <Row label="Konto" value={connection.email ?? '—'} />
          <Row
            label="Scopes"
            value={
              connection.scopes.length
                ? connection.scopes
                    .map((s) =>
                      s.replace('https://www.googleapis.com/auth/', '')
                    )
                    .join(', ')
                : 'nur openid email profile'
            }
            mono
          />
          <Row
            label="Offline-Access"
            value={connection.hasOfflineAccess ? 'aktiv' : 'nein'}
            mono
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!hasReadScope ? (
          <Link
            href={`/api/auth/google/start?scopes=${encodeURIComponent(GMAIL_MODIFY)}&from=/settings/integrations`}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#E8B86D] px-3.5 py-2 text-[13px] font-medium leading-none text-[#0A0A0C] transition-colors hover:bg-[#F0C079]"
          >
            <GoogleLogo size={14} />
            <span>{connection ? 'Mit Gmail verbinden' : 'Mit Google + Gmail verbinden'}</span>
          </Link>
        ) : needsUpgrade ? (
          // Read-only granted but new modify scope is needed for archive/
          // mark-read actions. One-click upgrade — Google's consent
          // dialog only asks about the *new* scope.
          <Link
            href={`/api/auth/google/start?scopes=${encodeURIComponent(GMAIL_MODIFY)}&from=/settings/integrations`}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#E8B86D] px-3.5 py-2 text-[13px] font-medium leading-none text-[#0A0A0C] transition-colors hover:bg-[#F0C079]"
          >
            <GoogleLogo size={14} />
            <span>Gmail-Zugriff erweitern</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#5ee08a]/[0.10] px-3 py-1.5 text-[11.5px] font-medium leading-none text-[#5ee08a]">
            <span aria-hidden>✓</span>
            <span>Gmail verbunden (lesen + verwalten)</span>
          </span>
        )}
        {connection?.hasOfflineAccess && (
          <form action={disconnectGoogleAction}>
            <button
              type="submit"
              className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] text-ink-300 transition-colors hover:border-[#ff8a8a]/30 hover:bg-[#ff8a8a]/10 hover:text-[#ff8a8a]"
            >
              Verbindung trennen
            </button>
          </form>
        )}
      </div>

      <p className="text-[11.5px] leading-[1.55] text-ink-300">
        Wir lesen Email-Metadaten + Snippets, niemals Anhänge. Tokens
        liegen AES-256-GCM-verschlüsselt in der DB. Du kannst die
        Verbindung jederzeit hier oder in den{' '}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-100 underline decoration-white/20 underline-offset-2 hover:text-ink-50"
        >
          Google-Kontoberechtigungen
        </a>{' '}
        widerrufen.
      </p>
    </section>
  );
}

function StatusBadge({
  connection,
  hasModify,
  hasRead,
}: {
  connection: GoogleConnection | null;
  hasModify: boolean;
  hasRead: boolean;
}) {
  if (hasModify) {
    return (
      <span className="shrink-0 rounded-full border border-[#5ee08a]/30 bg-[#5ee08a]/[0.08] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[#5ee08a]">
        Aktiv
      </span>
    );
  }
  if (hasRead) {
    return (
      <span className="shrink-0 rounded-full border border-[#ffd96a]/30 bg-[#ffd96a]/[0.06] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[#ffd96a]">
        Nur Lesen
      </span>
    );
  }
  if (connection) {
    return (
      <span className="shrink-0 rounded-full border border-[#ffd96a]/30 bg-[#ffd96a]/[0.06] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[#ffd96a]">
        Nur Login
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-300">
      Nicht verbunden
    </span>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 py-[3px]">
      <span className="w-[88px] shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-300">
        {label}
      </span>
      <span
        className={`min-w-0 truncate text-ink-100 ${mono ? 'font-mono text-[11.5px]' : 'text-[12.5px]'}`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden style={{ flexShrink: 0 }}>
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.62Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.35-1.59-5.06-3.72H.96v2.34A9 9 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.94 10.7A5.41 5.41 0 0 1 3.66 9c0-.59.1-1.16.28-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.98-2.34Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96L3.94 7.3C4.65 5.17 6.65 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
