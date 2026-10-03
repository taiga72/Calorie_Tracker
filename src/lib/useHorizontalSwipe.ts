import { useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

const AXIS_LOCK_PX = 8;
const SWIPE_THRESHOLD_PX = 50;

interface Options {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  /** Gestures starting on matching elements are left alone (e.g. swipe-to-delete rows). */
  ignoreSelector?: string;
}

/**
 * Detects a horizontal swipe, committing to an axis only once the drag clearly
 * leans one way so vertical gestures (scrolling, pull-to-refresh) pass through.
 * The click that ends a swipe is swallowed so it doesn't also activate
 * whatever element the finger lifted off of.
 */
export function useHorizontalSwipe({ onSwipeLeft, onSwipeRight, ignoreSelector }: Options) {
  const [dragX, setDragX] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<'horizontal' | 'vertical' | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (ignoreSelector && (e.target as Element | null)?.closest?.(ignoreSelector)) {
      start.current = null;
      return;
    }
    start.current = { x: e.clientX, y: e.clientY };
    axis.current = null;
    suppressClick.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (axis.current === null) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }
    if (axis.current === 'horizontal') setDragX(dx);
  };

  const onPointerEnd = () => {
    if (axis.current === 'horizontal') {
      suppressClick.current = true;
      if (dragX <= -SWIPE_THRESHOLD_PX) onSwipeLeft();
      else if (dragX >= SWIPE_THRESHOLD_PX) onSwipeRight();
    }
    start.current = null;
    axis.current = null;
    setDragX(0);
  };

  const onClickCapture = (e: ReactMouseEvent) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  return {
    dragX,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onClickCapture,
    },
  };
}
