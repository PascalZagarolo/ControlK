import 'server-only';

// ─── Mailer ─────────────────────────────────────────────────────
// Single entry point. If RESEND_API_KEY + RESEND_FROM_EMAIL aren't set,
// we log to stdout instead — handy in dev so flows still work without
// a Resend account. Production must have both set.

let _resend: import('resend').Resend | null = null;

async function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (_resend) return _resend;
  const { Resend } = await import('resend');
  _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const hasKey = !!process.env.RESEND_API_KEY;
  const hasFrom = !!process.env.RESEND_FROM_EMAIL;

  if (!hasKey || !hasFrom) {
    const why = !hasKey ? 'RESEND_API_KEY missing' : 'RESEND_FROM_EMAIL missing';
    console.log(
      `\n[email/dev] ${opts.to} — ${opts.subject}   (fallback reason: ${why})\n${opts.text ?? opts.html}\n`
    );
    return { ok: true as const, dev: true as const, reason: why };
  }

  const r = await getResend();
  if (!r) return { ok: false as const, error: 'Resend init failed.' };

  try {
    const res = await r.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (res.error) {
      console.error('[email/resend] send error:', res.error);
      return { ok: false as const, error: `${res.error.name}: ${res.error.message}` };
    }
    console.log(`[email/resend] sent → ${opts.to}  id=${res.data?.id}`);
    return { ok: true as const, dev: false as const, id: res.data?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[email/resend] threw:', msg);
    return { ok: false as const, error: msg };
  }
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

// ─── Compose helper ─────────────────────────────────────────────
// Every Ctrl K mail follows the same anatomy:
//   [kicker]
//   Title
//   Body paragraph(s)
//   [optional code/token block]
//   [optional primary CTA]
//   [optional secondary CTA — auxiliary action]
//   [optional details rows (key/value)]
//   [optional alert callout — security warnings]
//   ─────────
//   Footer note + branding + support contact
//
// composeMail() takes the structured input and returns subject + html +
// text. Templates below are thin configurations — no inline HTML
// duplication. Style changes happen in one place.

type MailDetail = { label: string; value: string };

type MailComposition = {
  subject: string;
  preheader?: string; // hidden inbox preview text
  kicker?: string;
  title: string;
  body: string[]; // paragraphs, plain text (will be HTML-escaped)
  cta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  code?: { value: string; caption?: string };
  details?: MailDetail[];
  alert?: { title: string; body: string };
  footerNote: string; // why-am-i-getting-this line
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FONT_SANS =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const FONT_MONO =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Mono", monospace';

function renderHtml(c: MailComposition): string {
  const bodyHtml = c.body
    .map(
      (p) =>
        `<p style="margin: 0 0 18px; font-size: 15px; line-height: 1.7; color: #A1A1AA; letter-spacing: -0.005em;">${esc(p)}</p>`
    )
    .join('');

  const codeHtml = c.code
    ? `<div style="margin: 0 0 28px;">
        <div style="background: rgba(255,255,255,0.04); border: 1px solid #1F1F23; border-radius: 8px; padding: 18px 20px; font-family: ${FONT_MONO}; font-size: 15px; color: #FAFAFA; letter-spacing: 0.04em; text-align: center; word-break: break-all;">${esc(c.code.value)}</div>
        ${c.code.caption ? `<p style="margin: 10px 0 0; font-size: 12.5px; color: #52525B; text-align: center;">${esc(c.code.caption)}</p>` : ''}
      </div>`
    : '';

  const ctaHtml = c.cta
    ? `<div style="margin: 0 0 ${c.secondaryCta ? '12px' : '32px'};">
        <a href="${esc(c.cta.href)}" style="display: inline-block; padding: 14px 26px; background: #E8B86D; color: #0A0A0C; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 15px; letter-spacing: -0.005em;">${esc(c.cta.label)}</a>
      </div>`
    : '';

  const secondaryCtaHtml = c.secondaryCta
    ? `<div style="margin: 0 0 32px;">
        <a href="${esc(c.secondaryCta.href)}" style="display: inline-block; padding: 10px 0; color: #A1A1AA; text-decoration: underline; text-decoration-color: #1F1F23; text-underline-offset: 3px; font-size: 14px; letter-spacing: -0.005em;">${esc(c.secondaryCta.label)}</a>
      </div>`
    : '';

  const ctaFallbackHtml = c.cta
    ? `<p style="margin: 0 0 24px; font-size: 12.5px; line-height: 1.6; color: #52525B; word-break: break-all;">
        Falls der Button nicht funktioniert: <a href="${esc(c.cta.href)}" style="color: #A1A1AA;">${esc(c.cta.href)}</a>
      </p>`
    : '';

  const detailsHtml = c.details && c.details.length
    ? `<div style="margin: 0 0 28px; padding: 18px 20px; background: rgba(255,255,255,0.02); border: 1px solid #1F1F23; border-radius: 8px;">
        ${c.details
          .map(
            (d, i) => `<div style="display: block; margin-top: ${i === 0 ? '0' : '12px'};">
              <span style="display: block; font-family: ${FONT_MONO}; font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: #52525B; margin-bottom: 4px;">${esc(d.label)}</span>
              <span style="display: block; font-size: 14px; color: #E6E6E6; letter-spacing: -0.005em; word-break: break-word;">${esc(d.value)}</span>
            </div>`
          )
          .join('')}
      </div>`
    : '';

  const alertHtml = c.alert
    ? `<div style="margin: 0 0 28px; padding: 16px 18px; background: rgba(164,90,90,0.06); border-left: 2px solid #A45A5A; border-radius: 2px;">
        <p style="margin: 0 0 6px; font-size: 14px; color: #D88A8A; font-weight: 500; letter-spacing: -0.005em;">${esc(c.alert.title)}</p>
        <p style="margin: 0; font-size: 13.5px; line-height: 1.6; color: #A1A1AA;">${esc(c.alert.body)}</p>
      </div>`
    : '';

  const kickerHtml = c.kicker
    ? `<p style="margin: 0 0 24px; font-family: ${FONT_MONO}; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #52525B;">${esc(c.kicker)}</p>`
    : '';

  const preheaderHtml = c.preheader
    ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">${esc(c.preheader)}</div>`
    : '';

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark only" />
    <meta name="supported-color-schemes" content="dark only" />
    <title>${esc(c.subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #0A0A0C; color: #E6E6E6; font-family: ${FONT_SANS};">
    ${preheaderHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #0A0A0C;">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%;">
            <tr>
              <td style="padding: 32px 28px 40px;">
                ${kickerHtml}
                <h1 style="margin: 0 0 18px; font-size: 24px; font-weight: 500; letter-spacing: -0.02em; color: #FAFAFA; line-height: 1.25;">${esc(c.title)}</h1>
                ${bodyHtml}
                ${codeHtml}
                ${ctaHtml}
                ${secondaryCtaHtml}
                ${ctaFallbackHtml}
                ${detailsHtml}
                ${alertHtml}
                <hr style="border: none; border-top: 1px solid #1F1F23; margin: 32px 0 24px;" />
                <p style="margin: 0 0 8px; font-size: 12.5px; line-height: 1.6; color: #52525B;">${esc(c.footerNote)}</p>
                <p style="margin: 0 0 8px; font-size: 12.5px; line-height: 1.6; color: #52525B;">
                  Fragen? Antworte einfach auf diese E-Mail oder schreib an <a href="mailto:hello@ctrlk.de" style="color: #A1A1AA;">hello@ctrlk.de</a>.
                </p>
                <p style="margin: 0; font-size: 12.5px; line-height: 1.6; color: #52525B;">
                  Ctrl K · <a href="https://ctrlk.de" style="color: #A1A1AA;">ctrlk.de</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText(c: MailComposition): string {
  const sep = '────────────────────────────────────────────';
  const parts: string[] = [];
  if (c.kicker) parts.push(c.kicker.toUpperCase());
  parts.push(c.title);
  parts.push(sep);
  parts.push(c.body.join('\n\n'));
  if (c.code) {
    parts.push('');
    parts.push(c.code.value);
    if (c.code.caption) parts.push(c.code.caption);
  }
  if (c.cta) {
    parts.push('');
    parts.push(`${c.cta.label}:`);
    parts.push(c.cta.href);
  }
  if (c.secondaryCta) {
    parts.push('');
    parts.push(`${c.secondaryCta.label}: ${c.secondaryCta.href}`);
  }
  if (c.details && c.details.length) {
    parts.push('');
    for (const d of c.details) {
      parts.push(`${d.label}: ${d.value}`);
    }
  }
  if (c.alert) {
    parts.push('');
    parts.push(`! ${c.alert.title}`);
    parts.push(`  ${c.alert.body}`);
  }
  parts.push('');
  parts.push(sep);
  parts.push(c.footerNote);
  parts.push('Fragen? hello@ctrlk.de');
  parts.push('Ctrl K · ctrlk.de');
  return parts.join('\n');
}

export function composeMail(c: MailComposition): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: c.subject,
    html: renderHtml(c),
    text: renderText(c),
  };
}

// ─── Templates ───────────────────────────────────────────────────
// Each function returns { subject, html, text } and accepts only the
// dynamic parts (links, names, device info). Copy lives here, not at
// the call sites. Voice: neutral-system ("Ctrl K hat dir…"), no Pascal
// first-person except in the waitlist confirmation.

// ── Auth: signup / login flows ────────────────────────────────

export function verifyEmailTemplate(link: string) {
  return composeMail({
    subject: 'Bestätige deine E-Mail-Adresse',
    preheader: 'Ein letzter Klick, dann ist dein Ctrl K Konto aktiv.',
    kicker: 'Ctrl K · Konto',
    title: 'Bestätige deine E-Mail-Adresse.',
    body: [
      'Klick den Button, um deine E-Mail-Adresse zu bestätigen und dein Konto zu aktivieren.',
      'Der Link ist 24 Stunden gültig. Wenn du dich nicht bei Ctrl K registriert hast, ignoriere diese Mail einfach.',
    ],
    cta: { label: 'E-Mail bestätigen', href: link },
    footerNote: 'Du bekommst diese E-Mail, weil bei der Registrierung diese Adresse angegeben wurde.',
  });
}

export function resetPasswordTemplate(link: string) {
  return composeMail({
    subject: 'Passwort zurücksetzen',
    preheader: 'Setze ein neues Passwort für deinen Ctrl K Account.',
    kicker: 'Ctrl K · Konto',
    title: 'Setze dein Passwort zurück.',
    body: [
      'Jemand — vermutlich du — hat ein neues Passwort für dein Ctrl K Konto angefordert. Klick den Button, um eines zu setzen.',
      'Der Link ist 60 Minuten gültig. Wenn du keine Anfrage gestellt hast, ignoriere diese E-Mail — dein bestehendes Passwort bleibt unverändert.',
    ],
    cta: { label: 'Neues Passwort setzen', href: link },
    footerNote: 'Du bekommst diese E-Mail, weil für dein Konto ein Passwort-Reset angefordert wurde.',
  });
}

export function magicLinkTemplate(link: string) {
  return composeMail({
    subject: 'Dein Login-Link für Ctrl K',
    preheader: 'Klick hier zur Anmeldung — gültig für 15 Minuten.',
    kicker: 'Ctrl K · Login',
    title: 'Klick zum Anmelden.',
    body: [
      'Hier ist dein Login-Link für Ctrl K. Klick den Button und du bist drin — kein Passwort nötig.',
      'Der Link ist 15 Minuten gültig und nur einmal verwendbar. Wenn du keine Anmeldung angefordert hast, ignoriere diese Mail.',
    ],
    cta: { label: 'Anmelden', href: link },
    footerNote: 'Du bekommst diese E-Mail, weil jemand einen Magic Link für diese Adresse angefordert hat.',
  });
}

export function emailChangeConfirmTemplate(args: { link: string; oldEmail: string; newEmail: string }) {
  return composeMail({
    subject: 'Bestätige deine neue E-Mail-Adresse',
    preheader: 'Klick zur Bestätigung deiner neuen Adresse für Ctrl K.',
    kicker: 'Ctrl K · Konto',
    title: 'Bestätige deine neue E-Mail.',
    body: [
      `Für dein Ctrl K Konto wurde eine Änderung der E-Mail-Adresse angefordert. Klick den Button unten, um die neue Adresse zu bestätigen.`,
      'Der Link ist 24 Stunden gültig. Bis zur Bestätigung bleibt deine bisherige Adresse aktiv.',
    ],
    cta: { label: 'Neue Adresse bestätigen', href: args.link },
    details: [
      { label: 'Bisher', value: args.oldEmail },
      { label: 'Neu', value: args.newEmail },
    ],
    footerNote: 'Du bekommst diese E-Mail, weil diese Adresse als neue Konto-Adresse angegeben wurde.',
  });
}

// ── 2FA / TOTP ────────────────────────────────────────────────

export function totpEnabledTemplate(args: { when: string; ip: string; device: string }) {
  return composeMail({
    subject: 'Zwei-Faktor-Authentifizierung aktiviert',
    preheader: '2FA ist jetzt für dein Ctrl K Konto aktiv.',
    kicker: 'Ctrl K · Sicherheit',
    title: 'Zwei-Faktor-Authentifizierung wurde aktiviert.',
    body: [
      'Dein Ctrl K Konto ist jetzt zusätzlich durch eine Authenticator-App geschützt. Beim nächsten Login wirst du nach einem 6-stelligen Code gefragt.',
      'Wir empfehlen, deine Backup-Codes aus den Konto-Einstellungen an einem sicheren Ort zu speichern — sie sind dein Notfallzugang, falls du dein Gerät verlierst.',
    ],
    details: [
      { label: 'Wann', value: args.when },
      { label: 'Gerät', value: args.device },
      { label: 'IP-Adresse', value: args.ip },
    ],
    alert: {
      title: 'Das warst nicht du?',
      body: 'Ändere sofort dein Passwort und schreib uns an hello@ctrlk.de — wir helfen, das Konto zu sichern.',
    },
    footerNote: 'Du bekommst diese E-Mail, weil deine Sicherheitseinstellungen geändert wurden.',
  });
}

export function totpDisabledTemplate(args: { when: string; ip: string; device: string }) {
  return composeMail({
    subject: 'Zwei-Faktor-Authentifizierung deaktiviert',
    preheader: 'Die 2FA für dein Ctrl K Konto wurde entfernt.',
    kicker: 'Ctrl K · Sicherheit',
    title: 'Zwei-Faktor-Authentifizierung wurde deaktiviert.',
    body: [
      'Die Zwei-Faktor-Authentifizierung für dein Ctrl K Konto wurde gerade entfernt. Beim nächsten Login reicht wieder Passwort allein.',
      'Wenn du das warst, kannst du diese Mail ignorieren. Falls nicht — Achtung: jemand hat dein Passwort und konnte deinen zweiten Faktor entfernen.',
    ],
    details: [
      { label: 'Wann', value: args.when },
      { label: 'Gerät', value: args.device },
      { label: 'IP-Adresse', value: args.ip },
    ],
    alert: {
      title: 'Das warst nicht du?',
      body: 'Setze sofort dein Passwort zurück, aktiviere 2FA wieder und kontaktiere hello@ctrlk.de.',
    },
    footerNote: 'Du bekommst diese E-Mail, weil deine Sicherheitseinstellungen geändert wurden.',
  });
}

export function backupCodesRegeneratedTemplate(args: { when: string; ip: string }) {
  return composeMail({
    subject: 'Neue 2FA-Backup-Codes generiert',
    preheader: 'Deine bisherigen Backup-Codes sind ungültig.',
    kicker: 'Ctrl K · Sicherheit',
    title: 'Neue Backup-Codes wurden generiert.',
    body: [
      'In deinem Ctrl K Konto wurde gerade ein neuer Satz 2FA-Backup-Codes erstellt. Deine bisherigen Codes funktionieren ab sofort nicht mehr.',
      'Aus Sicherheitsgründen versenden wir Backup-Codes niemals per E-Mail. Sieh sie direkt in den Konto-Einstellungen und speichere sie an einem sicheren Ort (Passwort-Manager, ausgedruckt im Schreibtisch).',
    ],
    cta: { label: 'Backup-Codes ansehen', href: `${appUrl()}/settings/security` },
    details: [
      { label: 'Wann', value: args.when },
      { label: 'IP-Adresse', value: args.ip },
    ],
    alert: {
      title: 'Das warst nicht du?',
      body: 'Ändere sofort dein Passwort und kontaktiere hello@ctrlk.de.',
    },
    footerNote: 'Du bekommst diese E-Mail, weil deine Sicherheitseinstellungen geändert wurden.',
  });
}

// ── Security alerts ───────────────────────────────────────────

export function newDeviceLoginTemplate(args: { when: string; ip: string; device: string; location?: string }) {
  return composeMail({
    subject: 'Neue Anmeldung bei Ctrl K',
    preheader: `Ein neues Gerät hat sich gerade angemeldet — ${args.device}.`,
    kicker: 'Ctrl K · Sicherheit',
    title: 'Neue Anmeldung in deinem Konto.',
    body: [
      'Jemand hat sich gerade von einem neuen Gerät bei deinem Ctrl K Konto angemeldet.',
      'Wenn du das warst, ist alles in Ordnung — du kannst diese Mail ignorieren.',
    ],
    details: [
      { label: 'Wann', value: args.when },
      { label: 'Gerät', value: args.device },
      ...(args.location ? [{ label: 'Ort (ungefähr)', value: args.location }] : []),
      { label: 'IP-Adresse', value: args.ip },
    ],
    alert: {
      title: 'Das warst nicht du?',
      body: 'Ändere sofort dein Passwort und melde alle aktiven Sessions ab — beides in den Sicherheitseinstellungen.',
    },
    secondaryCta: { label: 'Sicherheit verwalten', href: `${appUrl()}/settings/security` },
    footerNote: 'Du bekommst diese E-Mail, weil sich erstmals ein neues Gerät bei deinem Konto angemeldet hat.',
  });
}

export function passwordChangedTemplate(args: { when: string; ip: string; device: string }) {
  return composeMail({
    subject: 'Dein Passwort wurde geändert',
    preheader: 'Falls du das warst — alles gut. Falls nicht, lies weiter.',
    kicker: 'Ctrl K · Sicherheit',
    title: 'Dein Passwort wurde geändert.',
    body: [
      'Das Passwort für dein Ctrl K Konto wurde gerade geändert. Beim nächsten Login musst du das neue verwenden.',
      'Wenn du das warst, ist alles in Ordnung — diese Mail ist nur eine Bestätigung.',
    ],
    details: [
      { label: 'Wann', value: args.when },
      { label: 'Gerät', value: args.device },
      { label: 'IP-Adresse', value: args.ip },
    ],
    alert: {
      title: 'Das warst nicht du?',
      body: 'Klick auf "Passwort vergessen" um es zurückzusetzen, und melde alle aktiven Sessions ab. Anschließend bitte hello@ctrlk.de informieren.',
    },
    secondaryCta: { label: 'Passwort zurücksetzen', href: `${appUrl()}/forgot-password` },
    footerNote: 'Du bekommst diese E-Mail, weil dein Konto-Passwort geändert wurde.',
  });
}

export function suspiciousActivityTemplate(args: { when: string; ip: string; activity: string }) {
  return composeMail({
    subject: 'Ungewöhnliche Aktivität in deinem Ctrl K Konto',
    preheader: 'Wir haben etwas Auffälliges entdeckt — bitte kurz prüfen.',
    kicker: 'Ctrl K · Sicherheit',
    title: 'Ungewöhnliche Aktivität entdeckt.',
    body: [
      'In deinem Ctrl K Konto haben wir eine Aktivität bemerkt, die vom üblichen Muster abweicht.',
      'Falls du das selbst warst, kannst du diese Mail ignorieren. Falls nicht, ist jetzt ein guter Moment, dein Konto zu sichern.',
    ],
    details: [
      { label: 'Wann', value: args.when },
      { label: 'Was', value: args.activity },
      { label: 'IP-Adresse', value: args.ip },
    ],
    alert: {
      title: 'Empfohlene nächste Schritte',
      body: 'Passwort ändern, alle Sessions abmelden, 2FA aktivieren falls noch nicht geschehen. Bei Fragen: hello@ctrlk.de.',
    },
    secondaryCta: { label: 'Sicherheit verwalten', href: `${appUrl()}/settings/security` },
    footerNote: 'Du bekommst diese E-Mail, weil eine ungewöhnliche Aktivität in deinem Konto entdeckt wurde.',
  });
}

// ── Lifecycle ─────────────────────────────────────────────────

export function welcomeTemplate(args: { name: string }) {
  return composeMail({
    subject: 'Willkommen bei Ctrl K',
    preheader: 'Dein Workspace ist bereit. So holst du das meiste raus.',
    kicker: 'Ctrl K · Willkommen',
    title: `Willkommen, ${args.name}.`,
    body: [
      'Dein Konto ist aktiv. Ctrl K ist dafür gebaut, ruhig zu bleiben — kein Notification-Storm, keine Badges, keine Widgets die deine Aufmerksamkeit jagen.',
      'Drei Dinge, die sich am Anfang lohnen: drück Cmd+K von überall, um zu jeder Notiz, jedem Todo, jedem Kontakt zu springen. Öffne das Foyer am Morgen für dein Briefing. Lege deine ersten paar Notizen an und vernetze sie mit @-Mentions — die Verknüpfungen werden automatisch zu Kontext.',
    ],
    cta: { label: 'Workspace öffnen', href: `${appUrl()}/` },
    footerNote: 'Du bekommst diese E-Mail, weil du dein Ctrl K Konto erfolgreich eingerichtet hast.',
  });
}

export function workspaceInviteTemplate(args: {
  inviterName: string;
  inviterEmail: string;
  workspaceName: string;
  acceptLink: string;
}) {
  return composeMail({
    subject: `${args.inviterName} hat dich zu "${args.workspaceName}" eingeladen`,
    preheader: `Tritt dem Ctrl K Workspace "${args.workspaceName}" bei.`,
    kicker: 'Ctrl K · Einladung',
    title: `${args.inviterName} hat dich eingeladen.`,
    body: [
      `Du wurdest zum Ctrl K Workspace "${args.workspaceName}" hinzugefügt. Klick den Button, um die Einladung anzunehmen und beizutreten.`,
      'Die Einladung ist 14 Tage gültig. Du brauchst kein Konto — falls du noch keines hast, legst du es im selben Schritt an.',
    ],
    cta: { label: 'Einladung annehmen', href: args.acceptLink },
    details: [
      { label: 'Workspace', value: args.workspaceName },
      { label: 'Eingeladen von', value: `${args.inviterName} (${args.inviterEmail})` },
    ],
    footerNote: `Du bekommst diese E-Mail, weil ${args.inviterName} dich zu einem Workspace eingeladen hat.`,
  });
}

export function dataExportReadyTemplate(args: { downloadLink: string; expiresAt: string }) {
  return composeMail({
    subject: 'Dein Daten-Export ist bereit',
    preheader: 'Download verfügbar — gültig für 24 Stunden.',
    kicker: 'Ctrl K · Datenschutz',
    title: 'Dein Daten-Export ist bereit.',
    body: [
      'Wie angefordert haben wir alle in deinem Ctrl K Konto gespeicherten personenbezogenen Daten als JSON-Archiv zusammengestellt.',
      'Der Download-Link ist 24 Stunden gültig und nur für dich bestimmt. Bewahre die heruntergeladene Datei sicher auf — sie enthält alle deine Konto-Daten im Klartext.',
    ],
    cta: { label: 'Daten herunterladen', href: args.downloadLink },
    details: [
      { label: 'Gültig bis', value: args.expiresAt },
      { label: 'Format', value: 'JSON-Archiv (ZIP)' },
    ],
    footerNote: 'Du bekommst diese E-Mail, weil du gemäß DSGVO Art. 15 einen Daten-Export angefordert hast.',
  });
}

// ── Marketing / Waitlist ──────────────────────────────────────
// Pascal-Voice (first person) — bewusst anders als der Rest.

export function waitlistConfirmTemplate(link: string) {
  return composeMail({
    subject: 'Bestätige deine Anmeldung für Ctrl K',
    preheader: 'Ein Klick, dann bist du auf der Waitlist.',
    kicker: 'Ctrl K · Waitlist',
    title: 'Bestätige deine Anmeldung.',
    body: [
      'Danke für dein Interesse an Ctrl K. Klick den Button, um deine Anmeldung zur Waitlist abzuschließen.',
      'Der Link ist 7 Tage gültig. Wenn du dich nicht angemeldet hast, ignoriere diese Mail einfach.',
    ],
    cta: { label: 'Anmeldung bestätigen', href: link },
    footerNote: 'Du bekommst diese E-Mail, weil sich jemand mit dieser Adresse für die Ctrl K Waitlist angemeldet hat. — Pascal',
  });
}
