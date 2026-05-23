# ControlK / uRent

Next.js 15 (App Router) + React 19 + TypeScript + Drizzle ORM workspace / CRM / rental-management platform with native auth.

## Stack

- **Framework:** Next.js 15, React 19, TypeScript, Tailwind
- **Database:** Neon Postgres via Drizzle ORM
- **Auth:** Native (scrypt + sessions + 2FA-ready)
- **Realtime:** Pusher Channels (presence, typing indicators, live message refresh)
- **Email:** Resend (optional, falls back to console log)
- **Rate-Limit:** Upstash Redis (optional, no-op without)
- **Storage:** Vercel Blob (optional)

## Quickstart

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL etc.
npm run db:migrate           # apply migrations to your Neon DB
npm run dev                  # http://localhost:3000
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | Next.js lint |
| `npm run db:generate` | Generate a new Drizzle migration |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema (skip migrations, dev only) |
| `npm run db:studio` | Open Drizzle Studio |

## Required environment variables

See [`.env.example`](./.env.example) for the full list. The minimum for a running app:

- `DATABASE_URL` — Neon Postgres connection string
- `NEXT_PUBLIC_APP_URL` — public app URL (e.g. `https://controlk.vercel.app`)

Pusher livechat requires `PUSHER_APP_ID`, `PUSHER_API_KEY`, `PUSHER_API_SECRET`, `PUSHER_CLUSTER`.

## Project structure

- `app/` — Next.js App Router routes (`/todos`, `/kunden`, `/flotte`, `/kalender`, `/vertraege`, `/channels`, `/workspaces`)
- `components/` — UI components grouped by feature
- `lib/actions/` — Server actions
- `lib/db/` — Drizzle schema, queries, migrations
- `lib/realtime/` — Pusher server + client glue
- `lib/auth/` — Native auth (sessions, password, 2FA, permissions)

## Design system

See [`DESIGN.md`](./DESIGN.md) — dark-first workstation aesthetic with composite shadows, 20px card radii, JetBrains Mono for numerics.

## License

Proprietary — all rights reserved.
