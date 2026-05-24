import { ImageResponse } from 'next/og';

// Root-level favicon. Applies to every route the landing tree doesn't
// shadow (sign-in, magic-link, foyer, inbox, /settings, share pages…).
// Landing has its own icon.tsx with identical content, kept side-by-
// side rather than removed so the marketing tree stays self-contained.

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0A0A0C',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: '#E8B86D',
            letterSpacing: '-0.04em',
            fontFamily: 'sans-serif',
            lineHeight: 1,
          }}
        >
          K
        </div>
      </div>
    ),
    { ...size }
  );
}
