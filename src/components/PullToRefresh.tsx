import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { RefreshCw, Check, CloudOff } from 'lucide-react';

const PULL_THRESHOLD_PX = 72;
const MAX_PULL_PX = 120;
const SETTLED_HEIGHT_PX = 64;
const DRAG_RESISTANCE = 0.5;
const AXIS_LOCK_PX = 8;
const RESULT_VISIBLE_MS = 1100;

const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

type Phase = 'idle' | 'syncing' | 'done' | 'failed';

interface PullToRefreshProps {
  /** May resolve to false to show "Couldn't sync" instead of "Up to date". */
  onRefresh: () => void | Promise<boolean | void>;
  refreshing: boolean;
  children: ReactNode;
}

/**
 * Pull down (from the top of the page) to re-sync with the server. A ring
 * fills as you pull, the arrow turns, and once released it spins while
 * syncing and then confirms the result before tucking away. Only activates
 * on a mostly vertical drag, so it coexists with horizontal gestures (like
 * swipe-to-delete) on nested rows.
 */
export function PullToRefresh({ onRefresh, refreshing, children }: PullToRefreshProps) {
  const [pullY, setPullY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<'vertical' | 'horizontal' | null>(null);
  const pull = useRef(0);
  const wasReady = useRef(false);
  const mounted = useRef(true);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { mounted.current = false; }, []);

  const busy = refreshing || phase === 'syncing';

  const runRefresh = async () => {
    setPhase('syncing');
    let ok = true;
    try {
      ok = (await onRefresh()) !== false;
    } catch {
      ok = false;
    }
    if (!mounted.current) return;
    setPhase(ok ? 'done' : 'failed');
    setTimeout(() => { if (mounted.current) setPhase('idle'); }, RESULT_VISIBLE_MS);
  };

  // The gesture itself, shared by touch (phones) and mouse/pen.
  const begin = (x: number, y: number) => {
    if (busy || window.scrollY > 0) return;
    start.current = { x, y };
    axis.current = null;
  };

  /** Returns true while this is a pull, so the browser's own scroll is held off. */
  const move = (x: number, y: number): boolean => {
    if (!start.current) return false;
    const dx = x - start.current.x;
    const dy = y - start.current.y;

    if (axis.current === null) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return false;
      // Only a downward drag starts a pull; scrolling up the page is left alone.
      axis.current = Math.abs(dy) > Math.abs(dx) && dy > 0 ? 'vertical' : 'horizontal';
      if (axis.current === 'vertical') setDragging(true);
    }

    if (axis.current !== 'vertical') return false;
    const next = dy <= 0 ? 0 : Math.min(dy * DRAG_RESISTANCE, MAX_PULL_PX);
    const ready = next > PULL_THRESHOLD_PX;
    // A tiny tick when crossing the threshold, where supported (Android).
    if (ready && !wasReady.current) navigator.vibrate?.(8);
    wasReady.current = ready;
    pull.current = next;
    setPullY(next);
    return true;
  };

  const end = () => {
    if (axis.current === 'vertical' && pull.current > PULL_THRESHOLD_PX) void runRefresh();
    start.current = null;
    axis.current = null;
    wasReady.current = false;
    pull.current = 0;
    setDragging(false);
    setPullY(0);
  };

  const gesture = useRef({ begin, move, end });
  gesture.current = { begin, move, end };

  // On iPhone a vertical drag is taken over by the browser's own scrolling
  // (pointer events get cancelled), so touches are handled directly, with a
  // non-passive listener that can claim the drag once it's clearly a pull.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      gesture.current.begin(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (gesture.current.move(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault();
    };
    const onEnd = () => gesture.current.end();
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  // Mouse and pen; touch is handled above.
  const onPointerDown = (e: ReactPointerEvent) => { if (e.pointerType !== 'touch') begin(e.clientX, e.clientY); };
  const onPointerMove = (e: ReactPointerEvent) => { if (e.pointerType !== 'touch') move(e.clientX, e.clientY); };
  const onPointerEnd = (e: ReactPointerEvent) => { if (e.pointerType !== 'touch') end(); };

  const syncing = refreshing || phase === 'syncing';
  const showResult = phase === 'done' || phase === 'failed';
  const progress = Math.min(pullY / PULL_THRESHOLD_PX, 1);
  const ready = pullY > PULL_THRESHOLD_PX;
  const height = syncing || showResult ? SETTLED_HEIGHT_PX : pullY;

  const label = syncing ? 'Syncing…'
    : phase === 'done' ? 'Up to date'
    : phase === 'failed' ? (navigator.onLine === false ? 'Offline — changes are saved on this device' : "Couldn't sync — try again")
    : ready ? 'Release to sync' : 'Pull to sync';

  return (
    <div
      ref={rootRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      className={dragging ? 'select-none' : undefined}
    >
      <div
        className="flex flex-col items-center justify-end overflow-hidden"
        style={{ height, transition: dragging ? 'none' : 'height .3s cubic-bezier(.2,.8,.2,1)' }}
        aria-hidden={height === 0}
      >
        <div
          className="flex flex-col items-center pb-2"
          style={{ opacity: syncing || showResult ? 1 : Math.min(1, progress * 1.4), transform: `scale(${syncing || showResult ? 1 : 0.6 + progress * 0.4})` }}
        >
          <div className="relative w-9 h-9 rounded-full bg-white dark:bg-gray-900 shadow-md border border-gray-100 dark:border-gray-800 flex items-center justify-center">
            <svg viewBox="0 0 36 36" className={`absolute inset-0 w-9 h-9 -rotate-90 ${syncing ? 'animate-spin [animation-duration:900ms]' : ''}`}>
              <circle cx="18" cy="18" r={RING_R} fill="none" strokeWidth="2.5" className="stroke-gray-100 dark:stroke-gray-800" />
              <circle
                cx="18" cy="18" r={RING_R} fill="none" strokeWidth="2.5" strokeLinecap="round"
                className={phase === 'failed' ? 'stroke-amber-500' : 'stroke-emerald-500'}
                strokeDasharray={RING_C}
                strokeDashoffset={syncing ? RING_C * 0.7 : showResult ? 0 : RING_C * (1 - progress)}
                style={{ transition: dragging ? 'none' : 'stroke-dashoffset .3s ease' }}
              />
            </svg>
            {phase === 'done' ? (
              <Check size={16} strokeWidth={3} className="text-emerald-600 animate-[popIn_.3s_ease-out]" />
            ) : phase === 'failed' ? (
              <CloudOff size={15} className="text-amber-500 animate-[popIn_.3s_ease-out]" />
            ) : (
              <RefreshCw
                size={15}
                className={ready || syncing ? 'text-emerald-600' : 'text-gray-400'}
                style={{ transform: syncing ? undefined : `rotate(${progress * 270}deg)` }}
              />
            )}
          </div>
          <span className={`text-[10px] font-semibold mt-1.5 ${phase === 'failed' ? 'text-amber-600' : ready || syncing || phase === 'done' ? 'text-emerald-600' : 'text-gray-400'}`}>
            {label}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
