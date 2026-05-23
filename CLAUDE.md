# controlK

Next.js 15 (App Router) + React 19 + TypeScript + Tailwind. The root route (`/`) serves a captured static HTML page from `public/raycast.html` via a `beforeFiles` rewrite in `next.config.js`; its assets live in `public/Raycast - Your shortcut to everything_files/`.

## Design system

**Authoritative reference: [`DESIGN.md`](./DESIGN.md)** — read it before touching any UI code in this project.

It contains the full token catalogue extracted from the bundled stylesheets:

- Fonts (Inter, JetBrains Mono, GeistMono), weight rules, type scale
- Color system — 12-step grey ramp, semantic fg/bg aliases, status accents, button + decorative palettes
- Spacing scale (`--spacing-0-5` … `--spacing-13`)
- Container widths and breakpoints
- Radius scale and card/border defaults
- Motion — the two tempo bands, the four bezier curves, named keyframes
- Shadow grammar (ambient drop + hairline + inset highlight + glow)
- Component patterns (Card, Plan, Reel, Key, Indicator, Section)
- Rules of thumb at the bottom — match the project's house style before inventing

When the global design system in `~/.claude/CLAUDE.md` ("Workstation Aesthetic") conflicts with `DESIGN.md`, **`DESIGN.md` wins for this project** — this codebase is dark-first with composite shadows and 20px card radii, not the cream/ink workstation language.

## Scripts

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` / `npm start` — production build & serve
- `npm run lint` — Next.js lint
