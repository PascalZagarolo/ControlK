# Deployment auf Vercel

Schritt-für-Schritt-Anleitung um uRent / controlK live zu bringen.

## 1. Vercel-Projekt anlegen

```bash
# Lokal: Vercel CLI installieren
npm i -g vercel
vercel login

# Projekt anlegen (idealerweise mit `--git` damit Auto-Deploy via GitHub funktioniert)
vercel link
```

Alternativ: über vercel.com Dashboard das Repo `PascalZagarolo/ControlK` als neues Projekt importieren.

## 2. Environment-Variablen setzen

Mindestens:

| Variable | Notwendig | Wo bekommen |
|---|---|---|
| `DATABASE_URL` | ✅ ja | Neon (Vercel Marketplace) — wenn als Integration installiert, wird die var automatisch gesetzt |
| `NEXT_PUBLIC_APP_URL` | ✅ ja | Deine Vercel-Domain, z.B. `https://controlk.vercel.app` |

Optional (Features werden ohne diese sauber „silently disabled"):

| Variable | Aktiviert |
|---|---|
| `PUSHER_APP_ID` + `PUSHER_API_KEY` + `PUSHER_API_SECRET` + `PUSHER_CLUSTER` | Realtime: Channels-Chat, Typing, Presence in Notes |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | Verify- / Reset- / Magic-Link-Emails |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Rate-Limit (sonst no-op) |
| `BLOB_READ_WRITE_TOKEN` | Image-Uploads in Notes via Vercel Blob |
| `AI_GATEWAY_API_KEY` | Workspace-AI in Notes + AI-Polish im Daily Brief (Vercel AI Gateway) |
| `OPENAI_API_KEY` | Fallback wenn kein AI-Gateway-Key da ist |
| `NOTES_AI_MODEL` | Modell-Override (default `openai/gpt-4o-mini`) |
| `BRIEF_MODEL` | Modell-Override für Daily-Brief AI-Polish |
| `INBOUND_EMAIL_SECRET` | HMAC-Secret für `/api/inbound/email` Webhook |
| `SEED_OWNER_ID` / `SEED_OWNER_EMAIL` / `SEED_OWNER_NAME` | Optional, nur für `db:seed` |

Setzen via CLI:

```bash
vercel env add DATABASE_URL production
vercel env add NEXT_PUBLIC_APP_URL production
# … wiederholen für alle benötigten Variables
```

## 3. Migrations auf Prod-DB ausführen

**Vor dem ersten Deploy** müssen die Migrations 0000–0016 auf der Prod-Neon-DB liegen, sonst crasht der erste Request.

```bash
# Aus dem Repo-Root, mit der Prod-DB-URL
DATABASE_URL='postgres://<prod>' npm run db:migrate
```

Wenn das aus irgendeinem Grund schief geht, kann man die `.sql` Dateien manuell ausführen — sie sind in `lib/db/migrations/` und numerisch geordnet (0000 → 0016). Jede ist idempotent (`IF NOT EXISTS`).

## 4. Erstes Deploy

```bash
vercel --prod
```

Oder via GitHub-Auto-Deploy: jeder push auf `main` triggert ein Production-Deploy.

## 5. Sanity-Checks nach Deploy

- [ ] `/sign-up` funktioniert → neuer User wird angelegt + automatisch eingeloggt
- [ ] `/` zeigt den default-Workspace
- [ ] `/todos`, `/kunden`, `/flotte`, `/kalender`, `/vertraege`, `/channels`, `/notes` laden ohne 500
- [ ] ⌘K öffnet die Suche
- [ ] `/notes/[id]` lädt — wenn BlockNote-Bundle zu groß für deinen Plan, Code-Splitting checken
- [ ] Wenn `AI_GATEWAY_API_KEY` gesetzt: AI-Panel auf `/notes/[id]` funktioniert
- [ ] Wenn `PUSHER_*` gesetzt: Channel-Messages erscheinen live in einem zweiten Tab
- [ ] Wenn `BLOB_READ_WRITE_TOKEN` gesetzt: Bild in Note paste/drop'en funktioniert

## 6. Häufige Probleme

**„column scope does not exist"** → Migration 0013 nicht eingespielt. Siehe Step 3.

**„column document does not exist"** → Migration 0014 nicht eingespielt. Siehe Step 3.

**„relation note_mentions does not exist"** → Migration 0015 nicht eingespielt. Siehe Step 3.

**PWA installiert sich nicht auf iOS** → `/icon-192.png` und `/icon-512.png` fehlen in `public/`. Die Manifest-Refs müssen real existieren, sonst nimmt iOS ein Default-Icon. Workaround: einfach zwei PNGs der Größe 192×192 und 512×512 generieren (z.B. via [favicon.io](https://favicon.io)) und in `public/` ablegen.

**„AI not configured" 503** auf `/api/notes/ai` → weder `AI_GATEWAY_API_KEY` noch `OPENAI_API_KEY` gesetzt.

**Build OOM** → Drizzle + BlockNote zusammen können auf Hobby-Plan eng werden. Falls Build-Memory das Problem ist, in Vercel-Project-Settings den Build-RAM erhöhen.

## 7. Custom Domain

```bash
vercel domains add deine-domain.de
# DNS-Records lt. Vercel-Output setzen
vercel alias deine-domain.de
```

Danach `NEXT_PUBLIC_APP_URL` updaten und re-deployen.

## 8. Email-Inbound (optional, für Channel-Email-Bridge)

1. Resend Inbound oder Postmark Inbound einrichten
2. Webhook auf `https://<deine-domain>/api/inbound/email` zeigen lassen
3. `INBOUND_EMAIL_SECRET` setzen
4. Provider so konfigurieren, dass er `x-urent-signature: <HMAC-SHA256 von raw body mit INBOUND_EMAIL_SECRET>` als Header schickt
5. DNS-MX-Record auf den Provider zeigen lassen
6. Adress-Pattern: `<channelSlug>.<workspaceSlug>@inbox.deine-domain.de` → wird zur Channel-Message
