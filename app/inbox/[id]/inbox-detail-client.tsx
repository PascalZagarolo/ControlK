'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  archiveInboxItem,
  createTodoFromInboxItem,
  markInboxItemRead,
  snoozeInboxItem,
} from '@/lib/actions/inbox-actions';
import { toast } from '@/lib/stores/toast-store';
import { InboxAiPanel } from '@/components/inbox/inbox-ai-panel';
import { LinkCustomerButton } from '@/components/inbox/link-customer-button';
import { TagClientButton } from '@/components/inbox/tag-client-button';
import type { GmailFullBody } from '@/lib/google/gmail';

type ItemSummary = {
  id: string;
  sourceType: string;
  sourceId: string;
  senderName: string;
  senderEmail: string | null;
  subject: string | null;
  receivedAt: string;
  isRead: boolean;
  preview: string | null;
  direction: 'inbox' | 'sent' | string;
};

export function InboxDetailClient({
  item,
  body,
  canSend = false,
  threadStrip,
  alreadyCustomer = false,
  senderTagged = false,
}: {
  item: ItemSummary;
  body: GmailFullBody | null;
  /** True when gmail.send is granted — enables in-app reply sending. */
  canSend?: boolean;
  /** Pre-rendered server component (or null when thread has only this message). */
  threadStrip?: React.ReactNode;
  /** True when this sender already resolves to a customer — hides the
   *  manual "mit Kunde verknüpfen" action (Schritt 4b). */
  alreadyCustomer?: boolean;
  /** True when this sender is already a lightweight client-tag OR CRM
   *  customer — sets the "als Kunde markieren" toggle's initial state. */
  senderTagged?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  // Auto-mark-read on mount when the item was unread. Fire-and-forget;
  // if the network fails the read state stays false locally + the next
  // cron sync will pick it up. Skips when already read so we don't
  // pointlessly POST on every refresh.
  useEffect(() => {
    if (item.isRead) return;
    markInboxItemRead(item.id).catch(() => {});
    // No router.refresh — the read state is incidental on this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAction = (
    fn: () => Promise<{ ok: boolean }>,
    successMsg: string,
    redirectAfter = '/'
  ) => {
    setSnoozeOpen(false);
    start(() =>
      fn()
        .then((res) => {
          if (res.ok) toast(successMsg, 'success');
          else toast('Aktion fehlgeschlagen', 'danger');
          router.push(redirectAfter);
        })
        .catch(() => {
          toast('Aktion fehlgeschlagen', 'danger');
        })
    );
  };

  const gmailUrl =
    item.sourceType === 'email_gmail'
      ? `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(item.sourceId)}`
      : null;

  const subject = body?.subject || item.subject || '(kein Betreff)';
  const sender = body?.from || item.senderName;
  const dateIso = body ? body.date.toISOString() : item.receivedAt;

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between gap-3 border-b border-[#1F1F23]">
        <Link
          href="/"
          className="flex items-center gap-1 text-[13px] text-[#A1A1AA] transition-colors hover:text-[#FAFAFA]"
        >
          <span aria-hidden>←</span>
          <span>Inbox</span>
        </Link>
        <div className="relative flex items-center gap-1">
          <ToolbarButton
            label="Archivieren"
            shortcut="E"
            onClick={() =>
              runAction(() => archiveInboxItem(item.id), 'Archiviert')
            }
            disabled={pending}
          />
          <ToolbarButton
            label="Snooze"
            shortcut="S"
            onClick={() => setSnoozeOpen((o) => !o)}
            disabled={pending}
          />
          <ToolbarButton
            label="→ Todo"
            shortcut="T"
            onClick={() =>
              runAction(
                () => createTodoFromInboxItem(item.id),
                '→ Todo erstellt'
              )
            }
            disabled={pending}
          />
          {gmailUrl && (
            <a
              href={gmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 flex h-7 items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 text-[11.5px] text-ink-300 transition-colors hover:border-white/[0.16] hover:text-ink-50"
            >
              In Gmail
              <span aria-hidden className="text-[10px]">↗</span>
            </a>
          )}

          {/* Lightweight client tagging (Schritt 5) — one tap, no CRM record
              needed; tags this address or the whole domain per-user. */}
          {item.senderEmail && (
            <TagClientButton
              senderEmail={item.senderEmail}
              senderName={item.senderName}
              initiallyTagged={senderTagged || alreadyCustomer}
            />
          )}

          {/* Manual CRM link (Schritt 4b) — only when this sender isn't
              already a known CRM customer and we have an address to link. */}
          {item.senderEmail && !alreadyCustomer && (
            <LinkCustomerButton senderEmail={item.senderEmail} senderName={item.senderName} />
          )}

          {snoozeOpen && (
            <SnoozeMenu
              onPick={(preset) =>
                runAction(
                  () => snoozeInboxItem(item.id, preset),
                  snoozeLabel(preset)
                )
              }
              onClose={() => setSnoozeOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Thread strip — chronological list of all messages in the same
          Gmail thread. Only rendered when there's actually a thread
          (>1 message); the page passes null otherwise. */}
      {threadStrip}

      {/* Email header */}
      <header className="flex flex-col gap-3 pt-2">
        <h1 className="text-[24px] font-medium leading-[1.2] tracking-[-0.015em] text-[#FAFAFA]">
          {subject}
        </h1>
        <div className="flex flex-wrap items-baseline gap-2 text-[13px] text-ink-200">
          <span className="font-medium text-ink-50">{cleanFromLabel(sender)}</span>
          {item.senderEmail && (
            <Link
              href={`/people/${encodeURIComponent(item.senderEmail)}`}
              className="text-[12px] text-ink-300 underline decoration-white/15 underline-offset-2 transition-colors hover:text-[#E8B86D] hover:decoration-[#E8B86D]/40"
              title="Profil dieser Person ansehen"
            >
              &lt;{item.senderEmail}&gt;
            </Link>
          )}
          <span aria-hidden className="text-ink-300">·</span>
          <span className="text-[12px] text-ink-300">{formatDateTime(dateIso)}</span>
          {item.senderEmail && (
            <>
              <span aria-hidden className="text-ink-300">·</span>
              <Link
                href={`/people/${encodeURIComponent(item.senderEmail)}`}
                className="text-[12px] text-[#E8B86D] transition-colors hover:text-[#F0C079]"
              >
                Profil →
              </Link>
            </>
          )}
        </div>
      </header>

      {/* AI helpers — summarize / thread-aware draft + send */}
      <InboxAiPanel
        itemId={item.id}
        subject={subject}
        from={sender}
        replyTo={item.senderEmail}
        canReply={item.direction !== 'sent' && !!item.senderEmail}
        canSend={canSend}
        bodyText={body?.plain ?? item.preview ?? null}
      />

      {/* Body */}
      <article className="flex flex-col gap-4">
        {body?.plain ? (
          <pre className="whitespace-pre-wrap break-words font-sans text-[14.5px] leading-[1.7] text-[#D4D4D8]">
            {body.plain}
          </pre>
        ) : body && body.hasHtml ? (
          <BodyFallback
            kind="html-only"
            snippet={item.preview ?? ''}
            gmailUrl={gmailUrl}
          />
        ) : body === null && item.sourceType === 'email_gmail' ? (
          <BodyFallback
            kind="no-token"
            snippet={item.preview ?? ''}
            gmailUrl={gmailUrl}
          />
        ) : (
          <BodyFallback
            kind="empty"
            snippet={item.preview ?? ''}
            gmailUrl={gmailUrl}
          />
        )}

        {body?.attachments && body.attachments.length > 0 && (
          <div className="rounded-[8px] border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300">
              {body.attachments.length} Anhang{body.attachments.length === 1 ? '' : 'änge'}
            </p>
            <ul className="flex flex-col gap-1">
              {body.attachments.map((a, i) => (
                <li key={i} className="flex items-baseline gap-2 text-[12.5px]">
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-300">
                    {a.mimeType.split('/')[1] || a.mimeType}
                  </span>
                  <span className="truncate text-ink-100">{a.filename}</span>
                  <span className="ml-auto font-mono text-[10px] text-ink-300">
                    {formatSize(a.size)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11.5px] leading-[1.5] text-ink-300">
              Anhänge öffnest du derzeit direkt in Gmail.
            </p>
          </div>
        )}
      </article>
    </div>
  );
}

function ToolbarButton({
  label,
  shortcut,
  onClick,
  disabled,
}: {
  label: string;
  shortcut: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${label} (${shortcut})`}
      className="flex h-7 items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 text-[12px] text-ink-200 transition-colors hover:border-white/[0.16] hover:text-ink-50 disabled:opacity-50"
    >
      <span>{label}</span>
      <kbd className="rounded-sm bg-white/[0.05] px-1 font-mono text-[9.5px] text-ink-300">
        {shortcut}
      </kbd>
    </button>
  );
}

function SnoozeMenu({
  onPick,
  onClose,
}: {
  onPick: (preset: 'three_hours' | 'tomorrow' | 'monday') => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-[calc(100%+6px)] z-30 flex flex-col rounded-md border border-white/[0.08] bg-[rgba(20,21,23,0.96)] p-1 text-[12px] shadow-[0_8px_28px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <SnoozeRow label="3 Stunden" onClick={() => onPick('three_hours')} />
      <SnoozeRow label="Morgen 09:00" onClick={() => onPick('tomorrow')} />
      <SnoozeRow label="Montag 09:00" onClick={() => onPick('monday')} />
      <button
        type="button"
        onClick={onClose}
        className="mt-0.5 border-t border-white/[0.05] px-2.5 py-1.5 text-left text-[11px] text-[#52525B] hover:text-[#A1A1AA]"
      >
        Abbrechen
      </button>
    </div>
  );
}

function SnoozeRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-sm px-2.5 py-1.5 text-left text-[#cdcece] transition-colors hover:bg-white/[0.05] hover:text-white"
    >
      {label}
    </button>
  );
}

function BodyFallback({
  kind,
  snippet,
  gmailUrl,
}: {
  kind: 'html-only' | 'no-token' | 'empty';
  snippet: string;
  gmailUrl: string | null;
}) {
  const note =
    kind === 'html-only'
      ? 'Diese Mail enthält nur HTML — Vorschau eingeschränkt.'
      : kind === 'no-token'
        ? 'Vollständiger Inhalt nicht abrufbar (Gmail-Verbindung getrennt).'
        : 'Keine Inhalt-Vorschau verfügbar.';
  return (
    <div className="flex flex-col gap-3">
      {snippet && (
        <p className="whitespace-pre-wrap text-[14.5px] leading-[1.7] text-[#D4D4D8]">
          {snippet}
        </p>
      )}
      <p className="text-[12.5px] italic leading-[1.6] text-ink-300">{note}</p>
      {gmailUrl && (
        <a
          href={gmailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start rounded-md border border-[#E8B86D]/30 bg-[#E8B86D]/[0.06] px-3 py-1.5 text-[12px] text-[#E8B86D] transition-colors hover:bg-[#E8B86D]/[0.12]"
        >
          In Gmail öffnen ↗
        </a>
      )}
    </div>
  );
}

// "Anna Hoffmann <anna@x.de>" → "Anna Hoffmann". Bare addresses pass
// through unchanged. Used only when we don't already have a separate
// senderEmail to render in muted form.
function cleanFromLabel(raw: string): string {
  const m = raw.match(/^(.*)<[^>]+>\s*$/);
  if (m) {
    return m[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '') || raw;
  }
  return raw;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function snoozeLabel(preset: 'three_hours' | 'tomorrow' | 'monday'): string {
  if (preset === 'three_hours') return 'Bis in 3 Stunden gesnoozed';
  if (preset === 'tomorrow') return 'Bis morgen früh gesnoozed';
  return 'Bis Montag gesnoozed';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
