import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#e6e6e6',
          200: '#9c9c9d',
          300: '#78787c',
          500: '#2f3031',
          700: '#111214',
          900: '#07080a',
        },
        line: 'hsl(195,5%,15%)',
        // Marketing landing accents (Ctrl+K brand). Indigo-violet is the
        // primary accent; yellow is reserved for a single highlight detail.
        accent: {
          DEFAULT: '#8B7FFF',
          soft: 'rgba(139,127,255,0.12)',
          line: 'rgba(139,127,255,0.28)',
        },
        'accent-yellow': '#FFD84D',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'Menlo', 'monospace'],
        // Landing typography: Inter Tight for headlines, Geist for body.
        // Variables are applied on the marketing page wrapper, so these
        // tokens only resolve there and never affect the app shell.
        display: ['var(--font-inter-tight)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        body: ['var(--font-geist-sans)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel:
          '0 12px 44px rgba(0,0,0,.5), 0 0 0 .5px rgba(0,0,0,.7), inset 0 .5px 0 0 rgba(255,255,255,.07)',
        key: '0 1px 0 0 rgba(0,0,0,.2), inset 0 1px 0 0 rgba(255,255,255,.18)',
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(.23,1,.32,1)',
      },
    },
  },
  plugins: [],
};

export default config;
