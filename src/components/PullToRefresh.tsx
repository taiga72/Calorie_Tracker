import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';

const PULL_THRESHOLD_PX = 64;
const MAX_INDICATOR_PX = 56;
const DRAG_RESISTANCE = 0.5;
const AXIS_LOCK_PX = 8;

interface PullToRefreshProps {
  onRefresh: () => void;
  refreshing: boolean;
  children: ReactNode;
}

/**
 * A pull-down-to-refresh affordance for tabs backed by data that can go
 * stale or fail to load (see the "why is the app not showing the saved
 * weight" investigation). Only activates when the page is scrolled to the
 * top and the drag is primarily vertical, so it coexists with horizontal
 * gestures (like swipe-to-delete) on nested rows.
 */
export function PullToRefresh({ onRefresh, refreshing, children }: PullToRefreshProps) {
  const [pullY, setPullY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<'vertical' | 'horizontal' | null>(null);

  const reset = () => {
    start.current = null;
    axis.current = null;
    setDragging(false);
    setPullY(0);
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (refreshing || window.scrollY > 0) return;
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
    if (dy <= 0) { setPullY(0); return; }
    setPullY(Math.min(dy * DRAG_RESISTANCE, MAX_INDICATOR_PX * 1.6));
  };

  const onPointerEnd = () => {
    if (axis.current === 'vertical' && pullY > PULL_THRESHOLD_PX) onRefresh();
    reset();
  };

  const indicatorHeight = refreshing ? MAX_INDICATOR_PX : Math.min(pullY, MAX_INDICATOR_PX);
  const showIndicator = refreshing || pullY > 0;
  const ready = pullY > PULL_THRESHOLD_PX;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ height: showIndicator ? indicatorHeight : 0, transition: dragging ? 'none' : 'height .2s ease' }}
        aria-hidden={!showIndicator}
      >
        {refreshing ? (
          <Loader2 size={20} className="text-emerald-600 animate-spin" />
        ) : (
          <ArrowDown
            size={18}
            className={`transition-transform ${ready ? 'rotate-180 text-emerald-600' : 'text-gray-300'}`}
          />
        )}
      </div>
      <div style={{ transition: dragging ? 'none' : 'transform .2s ease' }}>
        {children}
      </div>
    </div>
  );
}
