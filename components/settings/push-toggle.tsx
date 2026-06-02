'use client';

import { useEffect, useState } from 'react';
import { savePushSubscription, removePushSubscription } from '@/lib/actions/push';
import { toast } from '@/lib/stores/toast-store';

// Opt-in toggle for the daily Web-Push nudge. Honest: only fires for real
// due/overdue commitments + waiting customers, once a morning. Needs a service
// worker (registered in prod) + the user granting notification permission.

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = 'loading' | 'unsupported' | 'off' | 'on' | 'denied';

export function PushToggle() {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !VAPID_PUBLIC
    ) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState(perm === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast: lib.dom types applicationServerKey as BufferSource<ArrayBuffer>,
        // our Uint8Array is structurally compatible at runtime.
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
      });
      const json = sub.toJSON();
      const keys = json.keys ?? {};
      if (!json.endpoint || !keys.p256dh || !keys.auth) {
        toast('Konnte nicht abonnieren.', 'danger');
        return;
      }
      const res = await savePushSubscription({
        endpoint: json.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: navigator.userAgent,
      });
      if (res.ok) {
        setState('on');
        toast('Benachrichtigungen aktiviert', 'success');
      } else {
        toast(res.error ?? 'Fehlgeschlagen', 'danger');
      }
    } catch {
      toast('Aktivieren fehlgeschlagen.', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setState('off');
      toast('Benachrichtigungen aus', 'success');
    } catch {
      toast('Deaktivieren fehlgeschlagen.', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-[12px] border border-white/[0.08] bg-white/[0.02] p-5">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-medium leading-tight text-ink-50">Benachrichtigungen</h2>
          <p className="mt-0.5 text-[12.5px] leading-[1.55] text-ink-300">
            Ein kurzer Hinweis am Morgen, wenn eine <span className="text-ink-100">Zusage fällig</span> ist
            oder ein <span className="text-ink-100">Kunde zu lange wartet</span>. Nur wenn wirklich etwas
            ansteht — kein Spam, einmal früh am Tag.
          </p>
        </div>
        {state === 'on' && (
          <span className="shrink-0 rounded-md bg-[#5ee08a]/[0.10] px-2.5 py-1 text-[11.5px] font-medium leading-none text-[#5ee08a]">
            ✓ Aktiv
          </span>
        )}
      </header>

      {state === 'unsupported' && (
        <p className="text-[12.5px] text-ink-300">
          Dein Browser unterstützt keine Push-Benachrichtigungen (oder sie sind hier nicht
          konfiguriert). In der installierten App / im Browser auf der Live-Seite funktioniert es.
        </p>
      )}
      {state === 'denied' && (
        <p className="text-[12.5px] text-[#ff8a8a]">
          Benachrichtigungen sind im Browser blockiert — bitte in den Website-Einstellungen erlauben.
        </p>
      )}
      {state === 'off' && (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="inline-flex w-fit items-center gap-1.5 rounded-md bg-[#E8B86D] px-3.5 py-2 text-[13px] font-medium leading-none text-[#0A0A0C] transition-colors hover:bg-[#F0C079] disabled:opacity-60"
        >
          {busy ? 'Aktiviere …' : 'Benachrichtigungen aktivieren'}
        </button>
      )}
      {state === 'on' && (
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className="inline-flex w-fit items-center gap-1.5 rounded-md border border-white/[0.10] px-3.5 py-2 text-[13px] font-medium leading-none text-ink-100 transition-colors hover:border-white/[0.20] disabled:opacity-60"
        >
          {busy ? 'Deaktiviere …' : 'Ausschalten'}
        </button>
      )}
    </section>
  );
}
