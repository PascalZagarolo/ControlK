import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Danke — Ctrl K',
  description: 'Anmeldung zur Ctrl K Waitlist bestätigt.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/danke' },
};

const CANVAS = '#0A0A0C';
const PRIMARY = '#FAFAFA';
const SECONDARY = '#A1A1AA';
const MUTED = '#52525B';
const ACCENT = '#E8B86D';

export default async function DankePage({
  searchParams,
}: {
  searchParams?: Promise<{ again?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const again = params.again === '1';
  const heading = again ? 'Schon bestätigt.' : 'Du bist drin.';
  const body = again
    ? 'Du bist bereits auf der Liste. Keine doppelte Mail nötig — du bekommst eine Nachricht, sobald Early Access bereitsteht.'
    : 'Danke für dein Vertrauen. Ich melde mich persönlich, sobald es etwas zu zeigen gibt — keine Newsletter, kein Spam, nur echte Updates.';
  return (
    <main
      style={{
        background: CANVAS,
        color: PRIMARY,
        minHeight: '100vh',
        fontFamily: 'var(--font-inter), -apple-system, system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 28px',
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: '0 auto',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -80,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 480,
            height: 240,
            background:
              'radial-gradient(50% 50% at 50% 50%, rgba(232,184,109,0.08) 0%, rgba(232,184,109,0) 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: ACCENT,
              boxShadow: '0 0 14px rgba(232,184,109,0.5)',
              marginBottom: 28,
            }}
          />

          <h1
            style={{
              fontSize: 'clamp(32px, 5vw, 44px)',
              fontWeight: 500,
              letterSpacing: '-0.025em',
              margin: '0 0 18px',
              color: PRIMARY,
              lineHeight: 1.1,
            }}
          >
            {heading}
          </h1>

          <p
            style={{
              fontSize: 16,
              lineHeight: 1.7,
              color: SECONDARY,
              margin: '0 0 36px',
              letterSpacing: '-0.005em',
            }}
          >
            {body}
          </p>

          <p
            style={{
              fontSize: 13,
              color: MUTED,
              margin: '0 0 36px',
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            — Pascal
          </p>

          <Link href="/" className="danke-back">
            Zurück zur Startseite
            <span aria-hidden className="danke-back-arrow">
              →
            </span>
          </Link>
        </div>

        <style>{`
          .danke-back {
            color: ${PRIMARY};
            text-decoration: none;
            font-size: 15px;
            letter-spacing: -0.005em;
            position: relative;
            padding: 6px 2px;
            display: inline-flex;
            gap: 8px;
            align-items: center;
            transition: letter-spacing 220ms cubic-bezier(0.22, 1, 0.36, 1);
          }
          .danke-back::after {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 1px;
            background: ${ACCENT};
            opacity: 0.4;
            transition: opacity 220ms cubic-bezier(0.22, 1, 0.36, 1);
          }
          .danke-back:hover { letter-spacing: 0.005em; }
          .danke-back:hover::after { opacity: 1; }
          .danke-back-arrow {
            display: inline-block;
            will-change: transform;
            transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
          }
          .danke-back:hover .danke-back-arrow { transform: translateX(4px); }
        `}</style>
      </div>
    </main>
  );
}
