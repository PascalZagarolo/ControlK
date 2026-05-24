// Dev-only email template gallery. Renders every Ctrl K mail template
// with realistic sample data so the design is reviewable without sending.
// Returns 404 in production builds.

import { notFound } from 'next/navigation';
import {
  verifyEmailTemplate,
  resetPasswordTemplate,
  magicLinkTemplate,
  emailChangeConfirmTemplate,
  totpEnabledTemplate,
  totpDisabledTemplate,
  backupCodesRegeneratedTemplate,
  newDeviceLoginTemplate,
  passwordChangedTemplate,
  suspiciousActivityTemplate,
  welcomeTemplate,
  workspaceInviteTemplate,
  dataExportReadyTemplate,
  waitlistConfirmTemplate,
} from '@/lib/email/send';

export const dynamic = 'force-dynamic';

const SAMPLE_LINK = 'https://ctrlk.de/api/example?token=xxxxxxxx';
const SAMPLE_DEVICE = 'Chrome 142 · macOS 15.2';
const SAMPLE_IP = '93.184.216.34';
const SAMPLE_WHEN = '24. Mai 2026, 14:32 Uhr (Europe/Berlin)';

const TEMPLATES = [
  ['verifyEmail', () => verifyEmailTemplate(SAMPLE_LINK)],
  ['resetPassword', () => resetPasswordTemplate(SAMPLE_LINK)],
  ['magicLink', () => magicLinkTemplate(SAMPLE_LINK)],
  [
    'emailChangeConfirm',
    () =>
      emailChangeConfirmTemplate({
        link: SAMPLE_LINK,
        oldEmail: 'old@ctrlk.de',
        newEmail: 'new@ctrlk.de',
      }),
  ],
  [
    'totpEnabled',
    () => totpEnabledTemplate({ when: SAMPLE_WHEN, ip: SAMPLE_IP, device: SAMPLE_DEVICE }),
  ],
  [
    'totpDisabled',
    () => totpDisabledTemplate({ when: SAMPLE_WHEN, ip: SAMPLE_IP, device: SAMPLE_DEVICE }),
  ],
  ['backupCodesRegenerated', () => backupCodesRegeneratedTemplate({ when: SAMPLE_WHEN, ip: SAMPLE_IP })],
  [
    'newDeviceLogin',
    () =>
      newDeviceLoginTemplate({
        when: SAMPLE_WHEN,
        ip: SAMPLE_IP,
        device: SAMPLE_DEVICE,
        location: 'Köln, Deutschland (ungefähr)',
      }),
  ],
  [
    'passwordChanged',
    () => passwordChangedTemplate({ when: SAMPLE_WHEN, ip: SAMPLE_IP, device: SAMPLE_DEVICE }),
  ],
  [
    'suspiciousActivity',
    () =>
      suspiciousActivityTemplate({
        when: SAMPLE_WHEN,
        ip: SAMPLE_IP,
        activity: '12 fehlgeschlagene Login-Versuche innerhalb von 60 Sekunden',
      }),
  ],
  ['welcome', () => welcomeTemplate({ name: 'Pascal' })],
  [
    'workspaceInvite',
    () =>
      workspaceInviteTemplate({
        inviterName: 'Pascal Zagarolo',
        inviterEmail: 'pascal@ctrlk.de',
        workspaceName: 'Mountain Industries',
        acceptLink: SAMPLE_LINK,
      }),
  ],
  [
    'dataExportReady',
    () =>
      dataExportReadyTemplate({
        downloadLink: SAMPLE_LINK,
        expiresAt: '25. Mai 2026, 14:32 Uhr (24 Stunden Restzeit)',
      }),
  ],
  ['waitlistConfirm', () => waitlistConfirmTemplate(SAMPLE_LINK)],
] as const;

export default function EmailGalleryPage({
  searchParams,
}: {
  searchParams?: Promise<{ t?: string; mode?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Gallery searchParams={searchParams} />;
}

async function Gallery({
  searchParams,
}: {
  searchParams?: Promise<{ t?: string; mode?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const selectedName = params.t ?? TEMPLATES[0][0];
  const mode = params.mode === 'text' ? 'text' : 'html';

  const selected = TEMPLATES.find(([name]) => name === selectedName) ?? TEMPLATES[0];
  const [, build] = selected;
  const mail = build();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        background: '#0c0d0f',
        color: '#e6e6e6',
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <aside
        style={{
          borderRight: '1px solid #1F1F23',
          padding: '24px 0',
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #1F1F23' }}>
          <div style={{ fontSize: 11, color: '#52525B', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Dev · Email Gallery
          </div>
          <div style={{ fontSize: 14, color: '#FAFAFA' }}>Ctrl K Mail Templates</div>
        </div>
        <nav style={{ padding: '12px 0' }}>
          {TEMPLATES.map(([name]) => {
            const active = name === selectedName;
            return (
              <a
                key={name}
                href={`/dev/emails?t=${name}${mode === 'text' ? '&mode=text' : ''}`}
                style={{
                  display: 'block',
                  padding: '8px 20px',
                  fontSize: 13,
                  color: active ? '#FAFAFA' : '#A1A1AA',
                  background: active ? 'rgba(232,184,109,0.06)' : 'transparent',
                  borderLeft: active ? '2px solid #E8B86D' : '2px solid transparent',
                  textDecoration: 'none',
                }}
              >
                {name}
              </a>
            );
          })}
        </nav>
      </aside>

      <main style={{ padding: '24px 32px', overflow: 'auto' }}>
        <header style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
            <h1 style={{ fontSize: 18, fontWeight: 500, margin: 0, color: '#FAFAFA' }}>{selectedName}</h1>
            <span style={{ fontSize: 13, color: '#52525B' }}>{mail.subject}</span>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 13 }}>
            <a
              href={`/dev/emails?t=${selectedName}`}
              style={{
                color: mode === 'html' ? '#E8B86D' : '#A1A1AA',
                textDecoration: 'none',
                borderBottom: mode === 'html' ? '1px solid #E8B86D' : '1px solid transparent',
                paddingBottom: 2,
              }}
            >
              HTML
            </a>
            <a
              href={`/dev/emails?t=${selectedName}&mode=text`}
              style={{
                color: mode === 'text' ? '#E8B86D' : '#A1A1AA',
                textDecoration: 'none',
                borderBottom: mode === 'text' ? '1px solid #E8B86D' : '1px solid transparent',
                paddingBottom: 2,
              }}
            >
              Plain Text
            </a>
          </div>
        </header>

        {mode === 'html' ? (
          <iframe
            srcDoc={mail.html}
            title={selectedName}
            style={{
              width: '100%',
              height: 'calc(100vh - 120px)',
              border: '1px solid #1F1F23',
              borderRadius: 8,
              background: '#0A0A0C',
            }}
          />
        ) : (
          <pre
            style={{
              width: '100%',
              minHeight: 'calc(100vh - 120px)',
              padding: 20,
              background: '#0A0A0C',
              border: '1px solid #1F1F23',
              borderRadius: 8,
              fontFamily:
                '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
              fontSize: 13,
              color: '#E6E6E6',
              whiteSpace: 'pre-wrap',
              margin: 0,
              lineHeight: 1.7,
            }}
          >
            {mail.text}
          </pre>
        )}
      </main>
    </div>
  );
}
