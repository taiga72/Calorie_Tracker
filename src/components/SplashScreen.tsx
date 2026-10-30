import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { SplashContext, useSplashReady } from '@/lib/splash';

// The skeleton has nothing to "finish" (unlike the old logo animation), so
// it goes as soon as the app is ready.
const MIN_VISIBLE_MS = 0;
const FADE_MS = 250;
/**
 * Shows the launch skeleton (the shape of Home) over the app until a screen
 * reports it's ready (useSplashReady), then fades it out. Its markup and CSS
 * (in index.html) match the static copy painted before any JS loads, so
 * there's no jump.
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

const Bar = ({ w, style }: { w: 25 | 40 | 55 | 70 | 85; style?: CSSProperties }) => <div className={`sk sk-line skw${w}`} style={style} />;

function MealRow({ w }: { w: 55 | 70 }) {
  return (
    <div className="sk-meal">
      <div className="sk sk-thumb" />
      <div className="sk-grow"><Bar w={w} /><Bar w={40} /></div>
    </div>
  );
}

/** The launch skeleton: kept in step with the static copy in index.html. */
export function SplashScreen({ leaving = false }: { leaving?: boolean }) {
  return (
    <div className={`splash${leaving ? ' splash-out' : ''}`} aria-label="Loading Calorie Tracker" role="status" aria-hidden={leaving}>
      <div className="sk-page" aria-hidden="true">
        <div className="sk-head">
          <div style={{ flex: 1 }}><Bar w={40} /><div className="sk sk-title" /></div>
          <div className="sk sk-chip" />
        </div>
        <div className="sk-row">
          <div className="sk-card"><Bar w={70} /><div className="sk sk-ring" /><Bar w={55} style={{ margin: '10px auto 0' }} /></div>
          <div className="sk-col">
            <div className="sk-card"><Bar w={55} /><Bar w={85} style={{ height: 20, marginTop: 12 }} /><Bar w={40} /></div>
            <div className="sk-card"><Bar w={55} /><Bar w={85} /><Bar w={70} /><Bar w={85} /></div>
          </div>
        </div>
        <div className="sk-card"><Bar w={40} /><Bar w={85} /></div>
        <div className="sk-card"><Bar w={25} /><MealRow w={70} /><MealRow w={55} /></div>
      </div>
      <div className="sk-nav" aria-hidden="true"><div className="sk" /><div className="sk" /><div className="sk" /><div className="sk" /></div>
    </div>
  );
}

/** A tab that's still downloading: its title and a few card shapes. */
export function ScreenSkeleton() {
  return (
    <div className="sk-page" role="status" aria-label="Loading">
      <div className="sk-head"><div style={{ flex: 1 }}><Bar w={25} /><div className="sk sk-title" style={{ width: '45%' }} /></div></div>
      <div className="sk-card"><Bar w={40} /><Bar w={85} style={{ height: 120, borderRadius: 16, marginTop: 14 }} /></div>
      <div className="sk-card"><Bar w={55} /><Bar w={85} /><Bar w={70} /></div>
      <div className="sk-card"><Bar w={40} /><MealRow w={70} /><MealRow w={55} /></div>
    </div>
  );
}
