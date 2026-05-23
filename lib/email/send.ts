import 'server-only';

const resendEnabled = () => !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_EMAIL;

let _resend: import('resend').Resend | null = null;

async function getResend() {
  if (!resendEnabled()) return null;
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

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

const baseStyle =
  'font-family: Inter, -apple-system, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #0c0d0f; color: #e6e6e6;';

const buttonStyle =
  'display: inline-block; padding: 12px 20px; background: #ffffff; color: #000000; text-decoration: none; border-radius: 10px; font-weight: 500; font-size: 14px;';

export function verifyEmailTemplate(link: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Bestätige deine E-Mail-Adresse',
    text: `Klicke hier zur Bestätigung: ${link}`,
    html: `<div style="${baseStyle}">
      <h1 style="font-size: 22px; margin: 0 0 12px;">E-Mail bestätigen</h1>
      <p style="color: #9c9c9d; line-height: 1.6; font-size: 14px;">Willkommen bei uRent. Klicke auf den Button unten, um deine E-Mail zu bestätigen.</p>
      <p style="margin: 24px 0;"><a href="${link}" style="${buttonStyle}">E-Mail bestätigen</a></p>
      <p style="color: #6a6b6c; font-size: 12px; line-height: 1.5;">Wenn du dich nicht registriert hast, ignoriere diese E-Mail.</p>
    </div>`,
  };
}

export function resetPasswordTemplate(link: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Passwort zurücksetzen',
    text: `Setze dein Passwort hier zurück: ${link}`,
    html: `<div style="${baseStyle}">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Passwort zurücksetzen</h1>
      <p style="color: #9c9c9d; line-height: 1.6; font-size: 14px;">Du hast ein neues Passwort angefordert. Der Link ist 60 Minuten gültig.</p>
      <p style="margin: 24px 0;"><a href="${link}" style="${buttonStyle}">Neues Passwort setzen</a></p>
      <p style="color: #6a6b6c; font-size: 12px; line-height: 1.5;">Wenn du keine Anfrage gestellt hast, ignoriere diese E-Mail.</p>
    </div>`,
  };
}

export function magicLinkTemplate(link: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Dein Login-Link für uRent',
    text: `Klick zum Anmelden: ${link}`,
    html: `<div style="${baseStyle}">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Anmelden bei uRent</h1>
      <p style="color: #9c9c9d; line-height: 1.6; font-size: 14px;">Klicke auf den Button, um dich anzumelden. Der Link ist 15 Minuten gültig.</p>
      <p style="margin: 24px 0;"><a href="${link}" style="${buttonStyle}">Anmelden</a></p>
    </div>`,
  };
}

export { appUrl };
