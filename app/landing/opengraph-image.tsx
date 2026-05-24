import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Ctrl K — One workspace. Many lives.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0A0A0C',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Warm bloom top-left */}
        <div
          style={{
            position: 'absolute',
            top: -200,
            left: -100,
            width: 700,
            height: 600,
            background:
              'radial-gradient(50% 50% at 50% 50%, rgba(232,184,109,0.16) 0%, rgba(232,184,109,0) 70%)',
            display: 'flex',
          }}
        />

        {/* Top brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#E8B86D',
              boxShadow: '0 0 18px rgba(232,184,109,0.5)',
              display: 'flex',
            }}
          />
          <div
            style={{
              fontSize: 24,
              color: '#FAFAFA',
              fontWeight: 500,
              letterSpacing: '-0.02em',
            }}
          >
            Ctrl K
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div
            style={{
              fontSize: 100,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: '-0.035em',
              color: '#FAFAFA',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div>One workspace.</div>
            <div>Many lives.</div>
          </div>
          <div
            style={{
              fontSize: 26,
              color: '#A1A1AA',
              letterSpacing: '-0.005em',
              lineHeight: 1.4,
              maxWidth: 760,
              display: 'flex',
            }}
          >
            Der ruhige Operations-Hub. Ein Cmd+K von überall — Inbox, Notizen, Todos, Kalender,
            dein Tag.
          </div>
        </div>

        {/* Bottom row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#52525B',
            fontSize: 18,
            letterSpacing: '-0.005em',
          }}
        >
          <div style={{ display: 'flex' }}>ctrlk.de</div>
          <div style={{ display: 'flex' }}>Gebaut in der Öffentlichkeit aus Deutschland</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
