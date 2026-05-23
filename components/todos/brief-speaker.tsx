'use client';

import { useEffect, useRef, useState } from 'react';

type State = 'idle' | 'speaking' | 'paused';

export function BriefSpeaker({ script, aiUrl }: { script: string; aiUrl?: string }) {
  const [state, setState] = useState<State>('idle');
  const [supported, setSupported] = useState(true);
  const [enhanced, setEnhanced] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSupported('speechSynthesis' in window);
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    u.rate = 1.05;
    u.pitch = 1.0;
    // Pick the best german voice we have
    const voices = window.speechSynthesis.getVoices();
    const de = voices.find((v) => v.lang?.startsWith('de'));
    if (de) u.voice = de;
    u.onend = () => setState('idle');
    u.onerror = () => setState('idle');
    utterRef.current = u;
    window.speechSynthesis.speak(u);
    setState('speaking');
  };

  const onPlay = async () => {
    if (state === 'speaking') {
      window.speechSynthesis.pause();
      setState('paused');
      return;
    }
    if (state === 'paused') {
      window.speechSynthesis.resume();
      setState('speaking');
      return;
    }
    // idle → fetch enhanced text if AI is enabled, otherwise fall back to script
    if (aiUrl && !enhanced) {
      try {
        setLoadingAI(true);
        const res = await fetch(aiUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ script }),
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.text === 'string' && data.text.length > 0) {
            setEnhanced(data.text);
            speak(data.text);
            return;
          }
        }
      } catch {
        // fall through to script
      } finally {
        setLoadingAI(false);
      }
    }
    speak(enhanced ?? script);
  };

  const onStop = () => {
    window.speechSynthesis.cancel();
    setState('idle');
  };

  if (!supported) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPlay}
        disabled={loadingAI}
        className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-ink-100 transition-colors hover:border-white/[0.16] hover:bg-white/[0.06] disabled:opacity-50"
      >
        <span aria-hidden>
          {loadingAI ? (
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#5eb6ff]" />
          ) : state === 'speaking' ? (
            '⏸'
          ) : state === 'paused' ? (
            '▶'
          ) : (
            '▶'
          )}
        </span>
        <span>
          {loadingAI
            ? 'Schreibe Brief …'
            : state === 'speaking'
              ? 'Pausieren'
              : state === 'paused'
                ? 'Fortsetzen'
                : 'Brief vorlesen'}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">~90s</span>
      </button>
      {state !== 'idle' && (
        <button
          type="button"
          onClick={onStop}
          className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[11.5px] text-ink-300 transition-colors hover:bg-white/[0.05] hover:text-ink-100"
        >
          Stop
        </button>
      )}
      {enhanced && (
        <span className="font-mono text-[9.5px] uppercase tracking-[0.4px] text-[#5eb6ff]">
          AI ✓
        </span>
      )}
    </div>
  );
}
