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
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'Menlo', 'monospace'],
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
