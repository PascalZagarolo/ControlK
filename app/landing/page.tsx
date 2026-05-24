import Link from 'next/link';
import { FoyerReplica } from './_components/FoyerReplica';
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <Link
              href="/sign-in"
              style={{
                color: SECONDARY,
                fontSize: 14,
                textDecoration: 'none',
                transition: 'color 140ms ease-out',
                letterSpacing: '-0.005em',
              }}
              className="landing-nav-cta"
            >
              Anmelden
            </Link>
            <Link href="/sign-up" className="landing-nav-primary">
              <span>Loslegen</span>
              <span aria-hidden className="landing-nav-primary-arrow">
                →
              </span>
            </Link>
          </div>
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
            <div
              style={{
                marginTop: 28,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Link href="/sign-up" className="landing-cta">
                <span>Kostenlos starten</span>
                <span className="landing-cta-arrow" aria-hidden>
                  →
                </span>
              </Link>
              <Link
                href="/sign-in"
                style={{
                  color: MUTED,
                  fontSize: 13,
                  textDecoration: 'none',
                  letterSpacing: '-0.005em',
                  transition: 'color 140ms ease-out',
                }}
                className="landing-hero-secondary"
              >
                Schon Konto? Anmelden
              </Link>
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

      {/* ── Section 2 — Was im Workspace steckt (cool feature tease) ─── */}
      <section style={{ padding: '120px 28px 0' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
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
                marginBottom: 18,
                lineHeight: 1.15,
                textAlign: 'center',
              }}
            >
              Sechs Dinge, die sich anders anfühlen werden.
            </h2>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: SECONDARY,
                margin: 0,
                marginBottom: 80,
                textAlign: 'center',
                maxWidth: 520,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              Keine Liste von Features, sondern eine Sammlung von Momenten.
              Manche sind heute schon da, manche kommen — alle gehören
              dahin, wo dein Tag wirklich passiert.
            </p>
          </Reveal>

          <div
            className="landing-cool-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              columnGap: 56,
              rowGap: 56,
            }}
          >
            {[
              {
                code: '01',
                kicker: 'Time-Travel',
                title: 'Eine Zeitachse durch alles.',
                body:
                  'Scroll jede Notiz, jeden Kontakt, jedes Todo zurück in der Zeit. Was wusstest du über diesen Kunden vor sechs Monaten? Was hast du in dem Projekt damals entschieden? Ctrl K behält alles — du musst nur scrollen.',
              },
              {
                code: '02',
                kicker: 'Inverser Kalender',
                title: 'Du sagst was wichtig ist. Die Zeit findet sich.',
                body:
                  'Wirf eine Aufgabe in den Kalender, ohne zu wissen wann. Ctrl K liest deine Muster, deine offenen Slots, deine Energie über den Tag — und legt sie an die richtige Stelle. Du verschiebst sie nur, wenn es sich falsch anfühlt.',
              },
              {
                code: '03',
                kicker: 'Semantic Threading',
                title: 'Drei Kanäle, ein Gespräch.',
                body:
                  'Email mit dem Kunden, Slack-Thread mit dem Kollegen, WhatsApp-Notiz an dich selbst — alle zum gleichen Thema. Ctrl K erkennt es und zeigt es als eine durchgehende Konversation, nicht als drei zerrissene Stränge.',
              },
              {
                code: '04',
                kicker: 'Pre-Meeting Brief',
                title: '30 Sekunden bevor der Call beginnt.',
                body:
                  'Ein leises Pop-up: wer das ist, was zuletzt besprochen wurde, was offen blieb, welche Dateien geteilt wurden, welche Versprechen offen sind. Du gehst nicht mehr blind in den ersten Call des Tages.',
              },
              {
                code: '05',
                kicker: 'Decision Log',
                title: 'Markiere einen Moment als Entscheidung.',
                body:
                  'Klick auf eine Notiz, einen Chat-Verlauf, ein Briefing. Ctrl K legt es ab als „Entscheidung getroffen am 24. Mai". In 30 Tagen kommt es zurück mit einer einzigen Frage: noch wahr?',
              },
              {
                code: '06',
                kicker: 'Quiet Hours',
                title: 'Es lernt, wann du nicht gestört werden willst.',
                body:
                  'Ctrl K liest deine Muster — wann du tief arbeitest, wann du verfügbar bist. Notifications, Briefings, Pings warten still, bis du wieder auftauchst. Kein Setup, keine Regeln, keine Ausreden.',
              },
            ].map((f, i) => (
              <Reveal key={f.code} delay={Math.min(i * 0.04, 0.16)}>
                <div className="landing-cool-card">
                  <div
                    style={{
                      color: ACCENT,
                      fontSize: 10.5,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                      marginBottom: 14,
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 8,
                    }}
                  >
                    <span>{f.code}</span>
                    <span style={{ color: MUTED }}>·</span>
                    <span>{f.kicker}</span>
                  </div>
                  <h3
                    style={{
                      fontSize: 20,
                      fontWeight: 500,
                      letterSpacing: '-0.02em',
                      color: PRIMARY,
                      margin: 0,
                      marginBottom: 12,
                      lineHeight: 1.3,
                    }}
                  >
                    {f.title}
                  </h3>
                  <p
                    style={{
                      fontSize: 14.5,
                      lineHeight: 1.65,
                      color: SECONDARY,
                      margin: 0,
                      letterSpacing: '-0.005em',
                    }}
                  >
                    {f.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3 — Five principles deep-dive ──────────────────── */}
      <section style={{ padding: '120px 28px 0' }}>
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
              Die Idee
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
              Fünf Prinzipien. Ein Workspace.
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

      {/* ── Section 4 — Roadmap timeline ────────────────────────────── */}
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
                marginBottom: 36,
              }}
            >
              Was kommt
            </p>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                {
                  label: 'Jetzt',
                  when: 'Live',
                  body: 'Foyer, Todos, Notizen, Kontakte. Single-User. Was du täglich brauchst.',
                  color: PRIMARY,
                  isNow: true,
                },
                {
                  label: 'Als Nächstes',
                  when: 'Q3 2026',
                  body: 'Universal Inbox. Gmail OAuth, semantisches Threading, echte Daten im Stack.',
                  color: SECONDARY,
                  isNow: false,
                },
                {
                  label: 'Später',
                  when: 'Q4 2026',
                  body: 'Kontextuelles Erinnern. Inverse Kalender. Zeitbewusstes Briefing. Die Features, die Ctrl K zum Assistenten machen.',
                  color: MUTED,
                  isNow: false,
                },
                {
                  label: 'Irgendwann',
                  when: '2027',
                  body: 'Teams, Slack, Outlook, Plattform-Schicht.',
                  color: '#3F3F46',
                  isNow: false,
                },
              ].map((row, i) => (
                <div
                  key={row.label}
                  className="landing-roadmap-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '280px minmax(0, 1fr)',
                    gap: 48,
                    padding: '22px 0',
                    borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`,
                    alignItems: 'baseline',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 10,
                      color: row.color,
                      fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                      fontSize: 12,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      transition: 'color 140ms ease-out',
                    }}
                  >
                    {row.isNow && (
                      <span
                        aria-hidden
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: ACCENT,
                          boxShadow: '0 0 8px rgba(232,184,109,0.45)',
                          flexShrink: 0,
                          alignSelf: 'center',
                          marginTop: -1,
                        }}
                      />
                    )}
                    <span>{row.label}</span>
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span>{row.when}</span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      color: row.color,
                      fontSize: 15,
                      lineHeight: 1.6,
                      letterSpacing: '-0.005em',
                      transition: 'color 140ms ease-out',
                    }}
                  >
                    {row.body}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Section 5 — Loslegen CTA ──────────────────────────────── */}
      <section
        id="loslegen"
        style={{
          padding: '160px 28px 120px',
          scrollMarginTop: 80,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Soft amber bloom behind the CTA — mirrors the hero bloom. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 640,
            height: 240,
            background:
              'radial-gradient(50% 50% at 50% 50%, rgba(232,184,109,0.07) 0%, rgba(232,184,109,0) 70%)',
            pointerEvents: 'none',
          }}
        />

        <Reveal>
          <div
            style={{
              maxWidth: 560,
              margin: '0 auto',
              textAlign: 'center',
              position: 'relative',
            }}
          >
            <h2
              style={{
                fontSize: 'clamp(28px, 4vw, 36px)',
                fontWeight: 500,
                letterSpacing: '-0.025em',
                margin: 0,
                marginBottom: 18,
                color: PRIMARY,
                lineHeight: 1.15,
              }}
            >
              Bereit für einen ruhigeren Workspace?
            </h2>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: SECONDARY,
                margin: 0,
                marginBottom: 44,
                letterSpacing: '-0.005em',
              }}
            >
              Konto erstellen, ersten Tag im Foyer starten. Zwei Minuten.
              Kein Newsletter, kein Spam.
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <Link href="/sign-up" className="landing-cta">
                <span>Kostenlos starten</span>
                <span className="landing-cta-arrow" aria-hidden>
                  →
                </span>
              </Link>
              <Link
                href="/sign-in"
                style={{
                  color: MUTED,
                  fontSize: 13,
                  textDecoration: 'none',
                  letterSpacing: '-0.005em',
                  transition: 'color 140ms ease-out',
                }}
                className="landing-hero-secondary"
              >
                Schon Konto? Anmelden
              </Link>
            </div>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
            <a href="mailto:hello@ctrlk.de" className="landing-footer-link">
              hello@ctrlk.de
            </a>
            <Link href="/impressum" className="landing-footer-link">
              Impressum
            </Link>
            <Link href="/datenschutz" className="landing-footer-link">
              Datenschutz
            </Link>
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
          padding: 6px 2px;
          display: inline-flex;
          gap: 8px;
          align-items: center;
          transition: letter-spacing 220ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .landing-cta::after {
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
        .landing-cta:hover { letter-spacing: 0.005em; }
        .landing-cta:hover::after { opacity: 1; }
        .landing-cta-arrow {
          display: inline-block;
          will-change: transform;
          transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .landing-cta:hover .landing-cta-arrow { transform: translateX(4px); }
        .landing-nav-cta:hover { color: ${PRIMARY}; }
        .landing-nav-primary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: ${ACCENT};
          background: rgba(232, 184, 109, 0.08);
          border: 1px solid rgba(232, 184, 109, 0.22);
          padding: 7px 14px;
          border-radius: 999px;
          font-size: 13px;
          letter-spacing: -0.005em;
          text-decoration: none;
          transition: background 140ms ease-out, border-color 140ms ease-out;
        }
        .landing-nav-primary:hover {
          background: rgba(232, 184, 109, 0.14);
          border-color: rgba(232, 184, 109, 0.4);
        }
        .landing-nav-primary-arrow {
          display: inline-block;
          will-change: transform;
          transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .landing-nav-primary:hover .landing-nav-primary-arrow {
          transform: translateX(3px);
        }
        .landing-hero-secondary:hover { color: ${SECONDARY}; }
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
          .landing-roadmap-row {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
            padding: 18px 0 !important;
          }
          .landing-cool-grid {
            grid-template-columns: 1fr !important;
            row-gap: 40px !important;
          }
        }
      `}</style>
    </main>
  );
}
