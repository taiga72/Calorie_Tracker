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
  const wasReady = useRef(false);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const reset = () => {
    start.current = null;
    axis.current = null;
    wasReady.current = false;
    setDragging(false);
    setPullY(0);
  };

  const busy = refreshing || phase === 'syncing';

  const onPointerDown = (e: ReactPointerEvent) => {
    if (busy || window.scrollY > 0) return;
    start.current = { x: e.clientX, y: e.clientY };
    axis.current = null;
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (axis.current === null) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      axis.current = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';
      if (axis.current === 'vertical') setDragging(true);
    }

    if (axis.current !== 'vertical') return;
    const next = dy <= 0 ? 0 : Math.min(dy * DRAG_RESISTANCE, MAX_PULL_PX);
    const ready = next > PULL_THRESHOLD_PX;
    // A tiny tick when crossing the threshold, where supported (Android).
    if (ready && !wasReady.current) navigator.vibrate?.(8);
    wasReady.current = ready;
    setPullY(next);
  };

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

  const onPointerEnd = () => {
    if (axis.current === 'vertical' && pullY > PULL_THRESHOLD_PX) void runRefresh();
    reset();
  };

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
