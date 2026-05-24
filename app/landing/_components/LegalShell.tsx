import Link from 'next/link';
import type { ReactNode } from 'react';

const CANVAS = '#0A0A0C';
const PRIMARY = '#FAFAFA';
const SECONDARY = '#A1A1AA';
const MUTED = '#52525B';
const ACCENT = '#E8B86D';

export function LegalShell({
  kicker,
  title,
  children,
}: {
  kicker?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main
      style={{
        background: CANVAS,
        color: PRIMARY,
        minHeight: '100vh',
        fontFamily: 'var(--font-inter), -apple-system, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '32px 28px 120px',
        }}
      >
        <Link href="/" className="legal-back" style={{ color: SECONDARY }}>
          ← Zurück
        </Link>

        {kicker && (
          <p
            style={{
              color: MUTED,
              fontSize: 11.5,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              margin: '64px 0 14px',
            }}
          >
            {kicker}
          </p>
        )}

        <h1
          style={{
            fontSize: 'clamp(28px, 4vw, 36px)',
            fontWeight: 500,
            letterSpacing: '-0.025em',
            color: PRIMARY,
            margin: kicker ? '0 0 48px' : '64px 0 48px',
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>

        <div className="legal-prose">{children}</div>
      </div>

      <style>{`
        .legal-back {
          display: inline-block;
          font-size: 14px;
          letter-spacing: -0.005em;
          text-decoration: none;
          transition: color 140ms ease-out;
        }
        .legal-back:hover {
          color: ${PRIMARY};
        }
        .legal-prose {
          color: ${SECONDARY};
          font-size: 15px;
          line-height: 1.75;
          letter-spacing: -0.005em;
        }
        .legal-prose h2 {
          color: ${PRIMARY};
          font-size: 18px;
          font-weight: 500;
          letter-spacing: -0.015em;
          margin: 48px 0 14px;
          line-height: 1.3;
        }
        .legal-prose h3 {
          color: ${PRIMARY};
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.01em;
          margin: 28px 0 10px;
          line-height: 1.4;
        }
        .legal-prose p {
          margin: 0 0 16px;
        }
        .legal-prose ul {
          margin: 0 0 16px;
          padding-left: 22px;
        }
        .legal-prose li {
          margin: 0 0 6px;
        }
        .legal-prose a {
          color: ${SECONDARY};
          text-decoration: underline;
          text-decoration-color: #1F1F23;
          text-underline-offset: 2px;
          transition: color 140ms ease-out, text-decoration-color 140ms ease-out;
        }
        .legal-prose a:hover {
          color: ${PRIMARY};
          text-decoration-color: ${ACCENT};
        }
        .legal-prose strong {
          color: ${PRIMARY};
          font-weight: 500;
        }
        .legal-prose .legal-meta {
          color: ${MUTED};
          font-size: 13px;
          margin: -28px 0 36px;
        }
        .legal-prose .legal-todo {
          display: block;
          margin: 0 0 16px;
          padding: 12px 14px;
          background: rgba(232, 184, 109, 0.05);
          border-left: 2px solid ${ACCENT};
          font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
          font-size: 12.5px;
          color: ${ACCENT};
          letter-spacing: -0.005em;
          line-height: 1.55;
        }
        .legal-prose .legal-review {
          display: block;
          margin: 0 0 36px;
          padding: 14px 16px;
          background: rgba(164, 90, 90, 0.06);
          border-left: 2px solid #A45A5A;
          font-size: 13px;
          color: ${SECONDARY};
          line-height: 1.6;
        }
      `}</style>
    </main>
  );
}
