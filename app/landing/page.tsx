import Link from 'next/link';
import { FoyerReplica } from './_components/FoyerReplica';
import { WaitlistForm } from './_components/WaitlistForm';
import { Reveal } from './_components/Reveal';

const CANVAS = '#0A0A0C';
const SURFACE = '#161618';
const BORDER = '#1F1F23';
const PRIMARY = '#FAFAFA';
const SECONDARY = '#A1A1AA';
const MUTED = '#52525B';
const ACCENT = '#E8B86D';

export default function LandingPage() {
  return (
    <main
      style={{
        background: CANVAS,
        color: PRIMARY,
        minHeight: '100vh',
        fontFamily: 'var(--font-inter), -apple-system, system-ui, sans-serif',
      }}
    >
      {/* Floating top nav */}
      <nav
        aria-label="Primär"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(12px) saturate(140%)',
          background: 'rgba(10,10,12,0.72)',
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            padding: '14px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: ACCENT,
                boxShadow: '0 0 10px rgba(232,184,109,0.45)',
              }}
            />
            <span
              style={{
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: '-0.015em',
                color: PRIMARY,
              }}
            >
              Ctrl K
            </span>
          </div>
          <a
            href="#waitlist"
            style={{
              color: SECONDARY,
              fontSize: 14,
              textDecoration: 'none',
              transition: 'color 140ms ease-out',
              letterSpacing: '-0.005em',
            }}
            className="landing-nav-cta"
          >
            Get early access
          </a>
        </div>
      </nav>

      {/* ── Section 1 — Hero ────────────────────────────────────────── */}
      <section
        style={{
          padding: '120px 28px 0',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Single very soft warm bloom behind the hero — no animation */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -120,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 720,
            height: 280,
            background:
              'radial-gradient(50% 50% at 50% 50%, rgba(232,184,109,0.07) 0%, rgba(232,184,109,0) 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ maxWidth: 880, margin: '0 auto', position: 'relative' }}>
          <Reveal>
            <h1
              style={{
                fontSize: 'clamp(40px, 7vw, 56px)',
                lineHeight: 1.05,
                letterSpacing: '-0.025em',
                fontWeight: 500,
                textAlign: 'center',
                margin: 0,
                color: PRIMARY,
              }}
            >
              One workspace.
              <br />
              Many lives.
            </h1>
          </Reveal>

          <Reveal delay={0.08}>
            <p
              style={{
                marginTop: 22,
                fontSize: 16,
                lineHeight: 1.6,
                letterSpacing: '-0.005em',
                color: SECONDARY,
                maxWidth: 520,
                marginLeft: 'auto',
                marginRight: 'auto',
                textAlign: 'center',
              }}
            >
              Der ruhige Operations-Hub. Ein{' '}
              <span
                style={{
                  color: PRIMARY,
                  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                  fontSize: 14,
                  padding: '1px 5px',
                  borderRadius: 4,
                  border: `1px solid ${BORDER}`,
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                Cmd+K
              </span>{' '}
              von überall — Inbox, Notizen, Todos, Kalender, dein Tag.
            </p>
          </Reveal>

          <Reveal delay={0.16}>
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <a href="#waitlist" className="landing-cta">
                Get early access →
              </a>
            </div>
          </Reveal>
        </div>

        {/* Hero visual: HTML-replica of the foyer, framed */}
        <Reveal delay={0.28} y={20} duration={0.6}>
          <div
            style={{
              maxWidth: 1080,
              margin: '80px auto 0',
              position: 'relative',
            }}
          >
            <FoyerReplica />
            {/* Gentle fade to canvas at the bottom */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 120,
                background: `linear-gradient(180deg, rgba(10,10,12,0) 0%, ${CANVAS} 92%)`,
                pointerEvents: 'none',
              }}
            />
          </div>
        </Reveal>
      </section>

      {/* ── Section 2 — Features ────────────────────────────────────── */}
      <section style={{ padding: '160px 28px 0' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <Reveal>
            <p
              style={{
                color: MUTED,
                fontSize: 11.5,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                marginBottom: 14,
                textAlign: 'center',
              }}
            >
              Was im Workspace steckt
            </p>
            <h2
              style={{
                fontSize: 'clamp(28px, 4vw, 36px)',
                fontWeight: 500,
                letterSpacing: '-0.025em',
                color: PRIMARY,
                margin: 0,
                marginBottom: 96,
                lineHeight: 1.15,
                textAlign: 'center',
              }}
            >
              Fünf Bausteine, statt sechs offener Tabs.
            </h2>
          </Reveal>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              {
                n: '01',
                kicker: 'Command palette',
                title: 'Cmd+K — überall.',
                body:
                  'Eine Tastenkombination öffnet dir alles. Springe in jede Notiz, jeden Kontakt, jedes Todo. Lege neue Items an, ohne Maus. Frage den Workspace etwas — er antwortet aus deinem Kontext, nicht aus dem Internet.',
              },
              {
                n: '02',
                kicker: 'Foyer',
                title: 'Ein ruhiger Start statt eines Dashboards.',
                body:
                  'Beim Öffnen: eine Begrüßung, ein Briefing für heute, ein konkreter Vorschlag was als nächstes ansteht. Kein Notification-Storm, keine Badges, keine unfertigen Widgets. Du startest deinen Tag, anstatt ihn zu sortieren.',
              },
              {
                n: '03',
                kicker: 'Universal Inbox',
                title: 'Email, Channels, Mentions — eine Liste.',
                body:
                  'Alles, was auf deine Aufmerksamkeit zielt, landet im selben Stack — gruppiert nach Thread, nicht nach App. Du antwortest direkt aus der Inbox und musst nicht mehr zwischen sechs Oberflächen springen.',
              },
              {
                n: '04',
                kicker: 'Verknüpfte Notizen',
                title: 'Notizen, die mit allem reden.',
                body:
                  'Schreibe eine Notiz, erwähne einen Kontakt, ein Todo, ein Projekt. Die Notiz wird Teil dieses Kontexts — und taucht beim nächsten Anruf, beim nächsten Meeting, beim nächsten Brief automatisch wieder auf. Suchen wird zur Ausnahme.',
              },
              {
                n: '05',
                kicker: 'Daily Briefing',
                title: 'Ein Briefing am Morgen, in 90 Sekunden.',
                body:
                  'Ein narrativer Überblick: was heute ansteht, was überfällig ist, welche Kontakte lange still sind, welche Aufgaben blockiert. Lesbar oder vorgelesen. Aus deinen eigenen Daten — nicht aus generischen KI-Spielereien.',
              },
            ].map((f, i, arr) => (
              <Reveal key={f.n} delay={Math.min(i * 0.04, 0.16)}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 200px) minmax(0, 1fr)',
                    gap: 48,
                    padding: '40px 0',
                    borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`,
                  }}
                  className="landing-feature-row"
                >
                  <div>
                    <div
                      style={{
                        color: ACCENT,
                        fontSize: 11,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                        marginBottom: 8,
                      }}
                    >
                      {f.n} · {f.kicker}
                    </div>
                  </div>
                  <div>
                    <h3
                      style={{
                        fontSize: 22,
                        fontWeight: 500,
                        letterSpacing: '-0.02em',
                        color: PRIMARY,
                        margin: 0,
                        marginBottom: 14,
                        lineHeight: 1.3,
                      }}
                    >
                      {f.title}
                    </h3>
                    <p
                      style={{
                        fontSize: 15,
                        lineHeight: 1.7,
                        color: SECONDARY,
                        margin: 0,
                        maxWidth: 560,
                      }}
                    >
                      {f.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3 — Roadmap (single calm paragraph) ─────────────── */}
      <section style={{ padding: '160px 28px 0' }}>
        <Reveal>
          <div
            style={{
              maxWidth: 640,
              margin: '0 auto',
            }}
          >
            <p
              style={{
                color: MUTED,
                fontSize: 11.5,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                marginBottom: 22,
              }}
            >
              Was kommt
            </p>
            <p
              style={{
                fontSize: 18,
                lineHeight: 1.75,
                letterSpacing: '-0.005em',
                color: SECONDARY,
                margin: 0,
              }}
            >
              Heute:{' '}
              <span style={{ color: PRIMARY }}>Foyer, Todos, Notizen, Channels, Kalender.</span>{' '}
              Im nächsten Quartal: ein echter universal Inbox mit Gmail-Integration und semantischem
              Threading. Danach: zeitbewusstes Briefing, kontextuelles Erinnern, der Inverse Kalender
              — die Features, die Ctrl K wie einen echten Assistant fühlen lassen statt nur wie ein
              Tool. Teams, Slack, Outlook kommen, wenn das Fundament steht.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── Section 4 — Waitlist ────────────────────────────────────── */}
      <section
        id="waitlist"
        style={{
          padding: '160px 28px 120px',
          scrollMarginTop: 80,
        }}
      >
        <Reveal>
          <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
            <h2
              style={{
                fontSize: 32,
                fontWeight: 500,
                letterSpacing: '-0.025em',
                margin: 0,
                marginBottom: 14,
                color: PRIMARY,
                lineHeight: 1.15,
              }}
            >
              Get early access.
            </h2>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: SECONDARY,
                margin: 0,
                marginBottom: 36,
              }}
            >
              Die Waitlist für die erste Kohorte ist offen.
            </p>
            <WaitlistForm />
          </div>
        </Reveal>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: `1px solid ${BORDER}`,
          padding: '28px',
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
            color: MUTED,
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: ACCENT,
                opacity: 0.7,
              }}
            />
            <span>Ctrl K — gebaut in der Öffentlichkeit aus Deutschland</span>
          </div>
          <div style={{ display: 'flex', gap: 18 }}>
            <a href="mailto:hello@ctrlk.de" className="landing-footer-link">
              hello@ctrlk.de
            </a>
          </div>
        </div>
      </footer>

      {/* Hover styles live in a single global rule below so we don't pull
          tailwind utilities or a CSS module for one-off marketing styles. */}
      <style>{`
        .landing-cta {
          color: ${PRIMARY};
          text-decoration: none;
          font-size: 15px;
          letter-spacing: -0.005em;
          position: relative;
          padding: 6px 0;
          display: inline-flex;
          gap: 6px;
          align-items: center;
        }
        .landing-cta::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 1px;
          background: ${ACCENT};
          transform: scaleX(0.18);
          transform-origin: left center;
          transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .landing-cta:hover::after { transform: scaleX(1); }
        .landing-cta-inline {
          color: ${PRIMARY};
          text-decoration: none;
          border-bottom: 1px solid ${ACCENT};
          padding-bottom: 1px;
          transition: color 140ms ease-out;
        }
        .landing-cta-inline:hover { color: ${ACCENT}; }
        .landing-underline {
          background-image: linear-gradient(${ACCENT}, ${ACCENT});
          background-repeat: no-repeat;
          background-size: 100% 1px;
          background-position: 0 100%;
          padding-bottom: 1px;
        }
        .landing-nav-cta:hover { color: ${PRIMARY}; }
        .landing-footer-link {
          color: ${MUTED};
          text-decoration: none;
          transition: color 140ms ease-out;
        }
        .landing-footer-link:hover { color: ${PRIMARY}; }
        @media (max-width: 720px) {
          .landing-feature-row {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
            padding: 28px 0 !important;
          }
        }
      `}</style>
    </main>
  );
}
