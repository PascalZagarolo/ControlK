# Design Doc

Design tokens extracted from the CSS shipped with the captured page (`public/Raycast - Your shortcut to everything_files/*.css`). Aesthetic: dark-first product marketing site, neutral grey scale with a single accent on yellow/blue/red/green semantic states, generous spacing, type-led hierarchy, soft inset highlights on interactive chrome.

---

## 1. Fonts

Three families are registered. Inter is the workhorse, JetBrains Mono is the secondary monospace, GeistMono is used only inside the keyboard/key-cap visuals.

| Token                  | Value                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| `--font-inter`         | `"Inter", "Inter Fallback"`                                            |
| `--font-jetbrains-mono`| `"JetBrains Mono", "JetBrains Mono Fallback"`                          |
| `--font-geist-mono`    | `"GeistMono", ui-monospace, SFMono-Regular, "Roboto Mono", Menlo, …`  |
| `--main-font`          | `var(--font-inter), sans-serif`                                        |
| `--monospace-font`     | `var(--font-jetbrains-mono), Menlo, Monaco, Courier, monospace`        |

Each face ships in variable-axis form (`@font-face` declares `font-weight: 100 900` for Inter, `100 800` for JetBrains Mono). `SF Pro` appears once as a fallback inside macOS-themed kbd visuals.

### Weights actually used in the stylesheet
`300, 400, 500, 550, 600, 650, 700`. The three carrying real semantic load are **400** (body), **500** (UI labels / nav / buttons), **600** (headings, emphasis). `650` and `550` are reserved for fine-tuned numeric labels in the keyboard graphic.

### Type scale
Discrete pixel sizes observed in source order — no `rem` scale, sizes are literal `px`.

| Role               | Size        | Line-height        | Letter-spacing |
| ------------------ | ----------- | ------------------ | -------------- |
| Display / hero     | 48 / 40     | 84px / 51px        | `-0.05px`      |
| Section heading    | 32 / 24     | 1.3 – 1.35         | `0.01em`       |
| Sub-heading        | 20 / 18     | 1.4 – 1.6          | `0.1px`        |
| Body               | 16          | 24px / 160%        | `0.2px`        |
| Body-small         | 14          | 20–22px / 150%     | `0.2px`        |
| Caption / micro    | 12 / 13     | 16–18px            | `0.3px`        |
| Key-cap numerics   | 5 / 6 / 7 / 8 / 9 / 11 | n/a       | n/a            |

Letter-spacing convention: **negative** (`-0.05px`) on display sizes for tighter optical fit, **positive** (`+0.1 → +0.3px`) on small/caps text to keep it legible on dark backgrounds.

---

## 2. Color system

### Greyscale (the spine)
| Token        | Hex      |
| ------------ | -------- |
| `Base-White` | `#ffffff`|
| `grey-50`    | `#e6e6e6`|
| `grey-100`   | `#cdcece`|
| `grey-200`   | `#9c9c9d`|
| `grey-300`   | `#6a6b6c`|
| `grey-400`   | `#434345`|
| `grey-500`   | `#2f3031`|
| `grey-600`   | `#1b1c1e`|
| `grey-700`   | `#111214`|
| `grey-800`   | `#0c0d0f`|
| `grey-900`   | `#07080a` *(default `--background`)* |
| `Base-Black` | `#000000`|

### Semantic surface / foreground aliases
| Token                | Value                       |
| -------------------- | --------------------------- |
| `--background`       | `var(--grey-900)`           |
| `--reverse-background` | `#ffffff`                 |
| `--color-bg`         | `var(--grey-900)`           |
| `--color-bg-100`     | `rgb(16,17,17)`             |
| `--color-bg-200`     | `rgb(24,25,26)`             |
| `--color-bg-300`     | `rgb(49,49,51)`             |
| `--color-bg-400`     | `rgb(73,75,77)`             |
| `--color-fg`         | `hsl(240,11%,96%)`          |
| `--color-fg-200`     | `rgb(194,199,202)`          |
| `--color-fg-300`     | `#78787c`                   |
| `--color-fg-400`     | `rgb(94,99,102)`            |
| `--color-border`     | `hsl(195,5%,15%)`           |
| `--font-color-rgb`   | `255,255,255`               |
| `--lines-color-rgb`  | `255,255,255`               |

### Semantic accents
| Token              | Value                       | Transparent variant (15% alpha) |
| ------------------ | --------------------------- | ------------------------------- |
| `--color-yellow`   | `hsl(43,100%,60%)`          | `--color-yellow-transparent`    |
| `--color-red`      | `hsl(0,100%,69%)`           | `--color-red-transparent`       |
| `--color-blue`     | `hsl(202,100%,67%)`         | `--color-blue-transparent`      |
| `--color-green`    | `hsl(151,59%,59%)`          | `--color-green-transparent`     |
| `--blue-dark`      | `#56c2ff`                   | —                               |
| `--red-dark`       | `rgba(255,99,99,1)`         | —                               |

### "Step" palette (used in storytelling / charts)
`--color-step-1` = yellow → `--color-step-2` = `#d3b2ff` → `step-3/4` = red-dark → `step-5` = blue.

### Button colors
| Token                      | Value                       |
| -------------------------- | --------------------------- |
| `--color-button-bg`        | `hsla(0,0%,100%,0.815)`     |
| `--color-button-bg-hover`  | `hsl(0,0%,100%)`            |
| `--color-button-fg`        | `rgb(24,25,26)`             |

Buttons invert (white surface, near-black text) and brighten on hover — the inverse of the dark page chrome.

### Decorative palettes (key-cap / indicator graphics)
These are scoped to specific components and not part of the global system.

- **Blue indicator** — `base #02193b`, `top #01204d`, `stroke #143ca3`, top-indicator `#63a1ff`, body `#2e6fcf`.
- **Dark indicator** — `base #07080a`, `top #181a1e`, `stroke #545454`, top-indicator `#181a1e`, body `#0f1013`.
- **Key-cap fills** — gradient `rgb(18,18,18) → rgb(13,13,13)` (default), `rgb(21,21,21) → rgb(13,13,13)` (active), `#161616 → #222` (highlight).

---

## 3. Spacing scale

Unitless multiples on an 8-px base; non-linear at the top end to support large vertical rhythm in marketing sections.

| Token            | Value  |
| ---------------- | ------ |
| `--spacing-none` | `0px`  |
| `--spacing-0-5`  | `4px`  |
| `--spacing-1`    | `8px`  |
| `--spacing-1-5`  | `12px` |
| `--spacing-2`    | `16px` |
| `--spacing-2-5`  | `20px` |
| `--spacing-3`    | `24px` |
| `--spacing-4`    | `32px` |
| `--spacing-5`    | `40px` |
| `--spacing-6`    | `48px` |
| `--spacing-7`    | `56px` |
| `--spacing-8`    | `64px` |
| `--spacing-9`    | `80px` |
| `--spacing-10`   | `96px` |
| `--spacing-11`   | `112px`|
| `--spacing-12`   | `168px`|
| `--spacing-13`   | `224px`|

Grid gap defaults: **32px** at desktop, **24px** at narrow.

---

## 4. Layout, containers, breakpoints

| Token                  | Value    |
| ---------------------- | -------- |
| `--container-xs-width` | `746px`  |
| `--container-sm-width` | `1064px` |
| `--container-width`    | `1204px` *(default)* |
| `--container-lg-width` | `1280px` |
| `--navbar-width`       | `var(--container-width)` |
| `--navbar-height`      | `58px` mobile / `76px` desktop |
| `--navbar-container-padding-top` | `var(--spacing-2)` (16px) |

Breakpoints discovered in `@media (min-width: …)` rules:
`375, 530, 548, 720, 768, 784, 900, 1024, 1050, 1200, 1204`.

The dominant trio is **720 / 768 / 1024**, with **1200 / 1204** for full desktop. The smaller values (375, 530, 548) are scoped to specific components (calculator, emoji picker).

---

## 5. Radius scale

| Token              | Value  |
| ------------------ | ------ |
| `--rounding-none`  | `0px`  |
| `--rounding-xs`    | `4px`  |
| `--rounding-sm`    | `6px`  |
| `--rounding-normal`| `8px`  |
| `--rounding-md`    | `12px` |
| `--rounding-lg`    | `16px` |
| `--rounding-xl`    | `20px` |
| `--rounding-xxl`   | `24px` |
| `--rounding-full`  | `100%` |
| `--radius-md`      | `6px` *(alias, used by inputs / chips)* |

Section "card" surfaces use `--radius: 20px` with a `--border: 2px`. Reel/scroll graphics nest a `--radius: 8px` interior with `--border: 2.5px`.

---

## 6. Motion

### Durations
`80ms · 150ms · 200ms · 250ms · 300ms · 400ms · 700ms · 1s · 1.5s · 2s`. The page uses two narrative tempos:
- **UI feedback** — `150–300ms`, mostly `ease` / `ease-in-out`.
- **Scroll-tied / storytelling animations** — `1s – 2s`, all on `cubic-bezier(.165, .84, .44, 1)` (an aggressively decelerating curve).

### Easing curves observed
| Curve                              | Role                                                  |
| ---------------------------------- | ----------------------------------------------------- |
| `cubic-bezier(.165, .84, .44, 1)`  | Scroll-tied transforms (the marquee curve)            |
| `cubic-bezier(.23, 1, .32, 1)`     | Layered transitions (keys, fades, color sweeps)       |
| `cubic-bezier(.215, .61, .355, 1)` | Slide-ins (extension highlight)                       |
| `cubic-bezier(.34, 1.56, .64, 1)`  | Overshoot pop (emoji picker key-press)                |
| `ease`, `ease-out`, `ease-in-out`, `step-end` | General-purpose UI |

### Pattern
Long-running showcases use **staggered** transitions: each property gets `1.5s var(--delay) cubic-bezier(.23,1,.32,1)`, with `--delay` set per-element so a row of keys flows in cascade.

### Standalone animations
`fadeInScaleUp` (.3s ease forwards), `blink` (1.1s step-end infinite), `slideIn` (.7s cubic-bezier forwards), `--rotation-period: 180s` for slow background ornaments.

---

## 7. Elevation / shadow vocabulary

There is no single "elevation scale"; instead shadows are composed from a small grammar:

1. **Ambient drop** — `0 4px 16–40px rgba(0,0,0, .25–.4)` for floating cards.
2. **Hairline outline** — `0 0 0 .5px rgba(0,0,0, .8)` to sharpen edges over busy backgrounds.
3. **Inset top highlight** — `inset 0 .5–1px 0 0 rgba(255,255,255, .1–.3)` to fake a beveled top edge — the signature look of every keyboard cap and chip.
4. **Glow ring** (focus / status) — `0 0 1–2px 1px rgba(50,145,255, .25–.8)` for blue focus, `0 0 10px 5px rgba(255,67,7, .1)` for orange/alert glow.

Cards therefore typically read as `drop + hairline + inset-highlight`, e.g.:

```
box-shadow:
  0 4px 40px 8px rgba(0,0,0,.4),
  0 0 0 .5px rgba(0,0,0,.8),
  inset 0 .5px 0 0 rgba(255,255,255,.3);
```

Borders are routinely "faked" with `box-shadow: 0 0 0 1px ...` rather than `border` so layout boxes never gain width.

---

## 8. Component patterns

| Pattern              | Token signature                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| **Card / Frame**     | `--card-padding: 32px`, `--radius: 20px`, `--border: 2px`, dark surface + inset highlight       |
| **Plan tile**        | `--plan-padding: 32–48px`, scaled per breakpoint, `--border: 1–2px`                            |
| **Reel / showcase**  | `--reel-gap: var(--spacing-7)` (56px), `--graphic-width: 270px`, parallax via `--scroll-progress: 0..1` |
| **Keyboard key**     | gradient fill (`--key-bg-start-color → --key-bg-end-color`), CSS-variable transition on the gradient stops, monospace numeric label |
| **Indicator dot**    | Pair of tokens (`--indicator-top`, `--indicator-body`, `--indicator-stroke`) so the same shape can be re-themed blue / dark |
| **Section padding**  | `--padding: 64px` mobile → `96px` desktop, with `--split: 50%` for two-column hero rows         |

---

## 9. Icons & raster assets

The `_files` directory contains **166** assets: 20 CSS chunks, ~140 JS chunks, and a set of PNG/SVG glyphs (e.g. `1password-icon.png`, `1password-web.png`) used for integration logos. No icon font is loaded — icons are inline SVG inside the JS bundle.

---

## 10. Rules of thumb for new work in this codebase

1. **Dark first.** All component states must be designed against `--grey-900`. Light-mode tokens (`--reverse-background`) exist but are only used inside inverted CTA buttons.
2. **Use the token, not the literal.** Reach for `--grey-700` / `--spacing-4` / `--rounding-md` rather than re-typing the underlying value.
3. **Color = meaning.** Yellow, red, blue, green are reserved for status. Don't decorate with them.
4. **Borders via box-shadow.** Use `0 0 0 1px …` so hover/focus rings don't reflow layout.
5. **Two motion tempos.** UI feedback ≤ 300ms on a soft `ease`; storytelling 1–2s on `cubic-bezier(.165,.84,.44,1)` or `(.23,1,.32,1)`. Mixing tempos within one interaction looks wrong.
6. **Type tightens up, micro-text loosens up.** Negative tracking on display sizes (`-0.05px`), positive on captions (`+0.2 → +0.3px`).
7. **Composite shadows over single shadows.** Drop + hairline + inset-highlight is the house style; a lone `box-shadow: 0 2px 8px black` looks foreign.
