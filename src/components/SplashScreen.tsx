import { useEffect, useState, type ReactNode } from 'react';
import { SplashContext, useSplashReady } from '@/lib/splash';

// Long enough for the logo animation to read as intentional rather than a
// flash; counted from page load, so a slow network adds no extra wait.
const MIN_VISIBLE_MS = 400;
const FADE_MS = 350;

/**
 * Shows the launch splash over the app until a screen reports it's ready
 * (useSplashReady), then fades it out. Its markup and CSS (in index.html)
 * match the static copy painted before any JS loads, so there's no jump.
 */
export function SplashProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [minElapsed, setMinElapsed] = useState(() => performance.now() >= MIN_VISIBLE_MS);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    if (minElapsed) return;
    const t = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS - performance.now());
    return () => clearTimeout(t);
  }, [minElapsed]);

  const visible = !(ready && minElapsed);

  useEffect(() => {
    if (visible) {
      setRemoved(false);
      return;
    }
    const t = setTimeout(() => setRemoved(true), FADE_MS);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <SplashContext.Provider value={setReady}>
      {children}
      {!removed && <SplashScreen leaving={!visible} />}
    </SplashContext.Provider>
  );
}

export function SplashReady() {
  useSplashReady(true);
  return null;
}

export function SplashScreen({ leaving = false }: { leaving?: boolean }) {
  return (
    <div className={`splash${leaving ? ' splash-out' : ''}`} aria-label="Loading Calorie Tracker" role="status" aria-hidden={leaving}>
      <div className="splash-logo">
        <div className="splash-glow" />
        <svg className="splash-ring" viewBox="0 0 132 132" width="132" height="132" aria-hidden="true">
          <circle cx="66" cy="66" r="62" fill="none" stroke="rgba(16,185,129,.15)" strokeWidth="4" />
          <circle className="arc" cx="66" cy="66" r="62" fill="none" stroke="#F97316" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <svg className="splash-icon" viewBox="0 0 512 512" aria-hidden="true">
          <rect width="512" height="512" rx="112" fill="#059669" />
          <g className="splash-flame">
            <path d="M256 120c-18 38-46 58-46 98 0 28 20 50 46 50s46-22 46-50c0-18-8-30-20-48 0 16-8 26-20 26 0-30 20-56-6-76z" fill="#F97316" />
            <path d="M196 286c-12 18-20 34-20 56 0 44 36 80 80 80s80-36 80-80c0-22-8-38-20-56-4 24-18 40-38 40 0-28-40-40-82-40z" fill="#FB923C" opacity="0.9" />
          </g>
        </svg>
      </div>
      <div className="splash-title">Calorie Tracker</div>
      <div className="splash-sub">
        Getting your day ready<span className="splash-dots"><i /><i /><i /></span>
      </div>
    </div>
  );
}
