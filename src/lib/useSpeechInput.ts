import { useCallback, useEffect, useRef, useState } from 'react';

// The Web Speech API isn't in every TypeScript DOM lib version; just the
// parts used here.
interface RecognitionResultList {
  length: number;
  [i: number]: { isFinal: boolean; 0: { transcript: string } };
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechInputSupported(): boolean {
  return getRecognition() !== null;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow it in your browser settings, or use your keyboard’s mic.',
  'service-not-allowed': 'Voice input isn’t available here — use the mic on your keyboard instead.',
  'audio-capture': 'No microphone was found.',
  network: 'Voice input needs a connection — try your keyboard’s mic instead.',
  'no-speech': 'Didn’t catch that — tap the mic and try again.',
};

/**
 * Dictation into a text field. `onText` gets the full transcript of the
 * current session as it's recognised (interim words included), so the field
 * fills in live; the caller decides how it combines with existing text.
 */
export function useSpeechInput(onText: (transcript: string, final: boolean) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => () => rec.current?.abort(), []);

  const stop = useCallback(() => {
    rec.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    rec.current?.abort();
    const r = new Ctor();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    // One phrase per tap: continuous mode is unreliable on iOS.
    r.continuous = false;
    r.onresult = (e) => {
      let transcript = '';
      let final = true;
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
        if (!e.results[i].isFinal) final = false;
      }
      onTextRef.current(transcript.trim(), final);
    };
    r.onerror = (e) => {
      if (e.error !== 'aborted') setError(ERROR_MESSAGES[e.error] ?? 'Voice input stopped unexpectedly — try again.');
    };
    r.onend = () => {
      setListening(false);
      if (rec.current === r) rec.current = null;
    };
    rec.current = r;
    setError(null);
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
      setError('Voice input couldn’t start — try again.');
    }
  }, []);

  return { supported: speechInputSupported(), listening, error, start, stop };
}
