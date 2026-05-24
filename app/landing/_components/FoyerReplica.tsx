/**
 * Static HTML reproduction of the product's Foyer page — used as the hero
 * visual on the marketing site instead of a PNG. ~5KB, razor-sharp on
 * any DPR, no image asset to maintain.
 *
 * Mirrors the real Foyer composition: top header (workspace dot + nav),
 * left notification stack (3 stacked cards), centered greeting block
 * with briefing card and event list.
 */

export function FoyerReplica() {
  return (
    <div
      style={{
        background: '#0E0E11',
        border: '1px solid #1F1F23',
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
        aspectRatio: '16 / 10',
        width: '100%',
      }}
    >
      {/* Top header strip */}
      <div
        style={{
          height: 44,
          borderBottom: '1px solid #161618',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '0 14px',
          fontSize: 11,
          color: '#52525B',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#E8B86D',
              boxShadow: '0 0 8px rgba(232,184,109,0.45)',
            }}
          />
          <span style={{ color: '#A1A1AA', fontSize: 12, fontWeight: 500, letterSpacing: '-0.01em' }}>
            Pascals Workspace
          </span>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {['Foyer', 'Inbox', 'Todos', 'Notizen', 'Kalender'].map((m, i) => (
            <span
              key={m}
              style={{
                color: i === 0 ? '#FAFAFA' : '#52525B',
                fontSize: 11.5,
                position: 'relative',
                paddingBottom: 2,
                borderBottom: i === 0 ? '1px solid #E8B86D' : '1px solid transparent',
              }}
            >
              {m}
            </span>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid #1F1F23',
            borderRadius: 6,
            padding: '3px 8px',
            background: 'rgba(255,255,255,0.015)',
          }}
        >
          <span style={{ color: '#52525B', fontSize: 10 }}>Suchen</span>
          <span
            style={{
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              color: '#71717A',
              fontSize: 9.5,
              padding: '1px 4px',
              borderRadius: 3,
              border: '1px solid #1F1F23',
              background: '#161618',
            }}
          >
            ⌘K
          </span>
        </div>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#E8B86D',
            color: '#FAFAFA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9.5,
            fontWeight: 500,
          }}
        >
          P
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', height: 'calc(100% - 44px)' }}>
        {/* Left notification stack */}
        <div
          style={{
            width: '28%',
            padding: '18px 12px 18px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              color: '#52525B',
              fontSize: 9.5,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 4,
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            }}
          >
            Inbox · 4
          </div>
          {[
            { from: 'Anna Becker', preview: 'Vertrag Q4 — habe Markup angefügt', kind: 'mail', tint: '#E8B86D' },
            { from: '#projekt-fleet-os', preview: 'Niklas: ist die Migration durch?', kind: 'channel', tint: '#7B92E8' },
            { from: 'Müller GmbH', preview: 'Übergabe Mo um 09:00 — passt das?', kind: 'mail', tint: '#A1A1AA' },
            { from: 'Sunsama', preview: 'Calendar invite · Demo um 14:00', kind: 'event', tint: '#52525B' },
          ].map((n, i) => (
            <div
              key={i}
              style={{
                background: i === 0 ? '#161618' : 'rgba(22,22,24,0.6)',
                border: '1px solid ' + (i === 0 ? '#1F1F23' : '#161618'),
                borderLeft: '2px solid ' + n.tint,
                borderRadius: 6,
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                <span style={{ color: '#FAFAFA', fontSize: 10.5, fontWeight: 500, letterSpacing: '-0.005em' }}>
                  {n.from}
                </span>
                <span style={{ color: '#52525B', fontSize: 9, marginLeft: 'auto' }}>
                  {['12m', '38m', '1h', '2h'][i]}
                </span>
              </div>
              <div style={{ color: '#A1A1AA', fontSize: 10, lineHeight: 1.4 }}>{n.preview}</div>
            </div>
          ))}
        </div>

        {/* Center column: greeting + briefing card */}
        <div
          style={{
            flex: 1,
            padding: '36px 28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            position: 'relative',
          }}
        >
          {/* Ambient light bloom — single subtle radial, no animation */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -40,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 360,
              height: 160,
              background:
                'radial-gradient(50% 50% at 50% 50%, rgba(232,184,109,0.06) 0%, rgba(232,184,109,0) 70%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ color: '#52525B', fontSize: 11, marginBottom: 8, letterSpacing: '-0.01em' }}>
            Mittwoch, 12:42
          </div>
          <div
            style={{
              color: '#FAFAFA',
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              marginBottom: 6,
              textAlign: 'center',
            }}
          >
            Guten Tag, Pascal.
          </div>
          <div
            style={{
              color: '#A1A1AA',
              fontSize: 12.5,
              maxWidth: 280,
              textAlign: 'center',
              lineHeight: 1.55,
              marginBottom: 22,
            }}
          >
            3 Todos heute. 2 Termine. Anna wartet seit gestern auf eine Antwort.
          </div>

          {/* Briefing card */}
          <div
            style={{
              width: '100%',
              maxWidth: 340,
              background: 'rgba(255,255,255,0.015)',
              border: '1px solid #1F1F23',
              borderRadius: 8,
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                color: '#71717A',
                fontSize: 9.5,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 8,
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              }}
            >
              Heute
            </div>
            {[
              { t: '09:00', label: 'Übergabe Müller GmbH', dot: '#E8B86D' },
              { t: '14:00', label: 'Demo · Schmidt+Partner', dot: '#A1A1AA' },
              { t: '—', label: 'Anna anrufen wegen Q1 Roadmap', dot: '#52525B' },
            ].map((row, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 0',
                  borderTop: i === 0 ? 'none' : '1px solid #161618',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: row.dot,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    color: '#A1A1AA',
                    fontSize: 10.5,
                    width: 38,
                    fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                  }}
                >
                  {row.t}
                </span>
                <span style={{ color: '#FAFAFA', fontSize: 11.5 }}>{row.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: sparse */}
        <div
          style={{
            width: '20%',
            borderLeft: '1px solid #161618',
            padding: '18px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div>
            <div
              style={{
                color: '#71717A',
                fontSize: 9.5,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 6,
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              }}
            >
              Diese Woche
            </div>
            <div style={{ color: '#A1A1AA', fontSize: 11, lineHeight: 1.6 }}>
              7 Todos offen · 3 Verträge auslaufend
            </div>
          </div>
          <div
            style={{
              height: 1,
              background: '#161618',
            }}
          />
          <div>
            <div
              style={{
                color: '#71717A',
                fontSize: 9.5,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 6,
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              }}
            >
              Ruhig
            </div>
            <div style={{ color: '#52525B', fontSize: 10.5, lineHeight: 1.6 }}>
              Keine Notification-Storms.
              <br />
              Kein Badge-Pressing.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
