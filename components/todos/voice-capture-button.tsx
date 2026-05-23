'use client';

import { useEffect, useRef, useState } from 'react';

type Recognition = any;

function getSpeechRecognition(): { Constructor: any; supported: boolean } {
  if (typeof window === 'undefined') return { Constructor: null, supported: false };
  const Ctor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  return { Constructor: Ctor, supported: !!Ctor };
}

export function VoiceCaptureButton({
  onTranscript,
  lang = 'de-DE',
}: {
  onTranscript: (text: string) => void;
  lang?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);

  useEffect(() => {
    const { supported } = getSpeechRecognition();
    setSupported(supported);
  }, []);

  const start = () => {
    const { Constructor, supported } = getSpeechRecognition();
    if (!supported) {
      setError('Spracherkennung wird nur in Chrome/Edge unterstützt.');
      return;
    }
    setError(null);
    setInterim('');
    const rec: Recognition = new Constructor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let finalText = '';
    rec.onresult = (event: any) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText || finalText);
    };
    rec.onerror = (e: any) => {
      setError(e.error === 'not-allowed' ? 'Mikro-Zugriff verweigert.' : 'Fehler: ' + e.error);
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      const txt = (finalText || interim).trim();
      if (txt) onTranscript(txt);
      setInterim('');
    };

    recognitionRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };

  const stop = () => {
    recognitionRef.current?.stop?.();
  };

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        title="Spracherkennung nur in Chrome/Edge verfügbar"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-white/[0.06] bg-white/[0.02] text-ink-300 opacity-50"
      >
        🎙
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={listening ? stop : start}
        title={listening ? 'Stop' : 'Per Sprache erfassen'}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border transition-all ${
          listening
            ? 'border-[#ff8a8a] bg-[#ff8a8a]/15 text-[#ff8a8a] animate-pulse'
            : 'border-white/[0.08] bg-white/[0.02] text-ink-200 hover:border-white/[0.18] hover:bg-white/[0.04]'
        }`}
      >
        🎙
      </button>
      {(listening || interim) && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-[280px] rounded-[10px] border border-white/[0.10] bg-[rgba(20,21,23,0.96)] p-3 shadow-panel">
          <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            {listening ? 'höre zu …' : 'fertig'}
          </p>
          <p className="mt-1 text-[12.5px] leading-[1.45] text-ink-50">
            {interim || (listening ? '…' : '')}
          </p>
        </div>
      )}
      {error && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-[280px] rounded-[10px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.08] p-3">
          <p className="text-[12px] text-[#ff8a8a]">{error}</p>
        </div>
      )}
    </div>
  );
}
