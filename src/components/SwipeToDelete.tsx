import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

const REVEAL_PX = 72;
const DELETE_THRESHOLD_PX = 130;
const AXIS_LOCK_PX = 8;

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: ReactNode;
}

/**
 * Swipe-left-to-reveal-delete for a list row, consistent with the drag
 * gesture already used for Modal's swipe-to-dismiss. Only commits to the
 * horizontal axis once the drag clearly leans that way, so it coexists with
 * a vertical pull-to-refresh on the same page.
 */
export function SwipeToDelete({ onDelete, children }: SwipeToDeleteProps) {
  const [open, setOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<'horizontal' | 'vertical' | null>(null);

  const baseX = open ? -REVEAL_PX : 0;

  const onPointerDown = (e: ReactPointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    axis.current = null;
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (axis.current === null) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      if (axis.current === 'horizontal') setDragging(true);
    }

    if (axis.current !== 'horizontal') return;
    const next = Math.max(-DELETE_THRESHOLD_PX - 40, Math.min(REVEAL_PX, dx));
    setDragX(next);
  };

  const onPointerEnd = () => {
    if (axis.current === 'horizontal') {
      const finalX = baseX + dragX;
      if (finalX < -DELETE_THRESHOLD_PX) {
        onDelete();
      } else {
        setOpen(finalX < -REVEAL_PX / 2);
      }
    }
    start.current = null;
    axis.current = null;
    setDragging(false);
    setDragX(0);
  };

  const translateX = dragging ? baseX + dragX : baseX;

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: REVEAL_PX }}>
        <button
          onClick={onDelete}
          className="flex-1 bg-red-500 text-white flex items-center justify-center active:bg-red-600 transition-colors"
          aria-label="Delete"
        >
          <Trash2 size={18} />
        </button>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="relative bg-white dark:bg-gray-900 touch-pan-y"
        style={{
          transform: translateX ? `translateX(${translateX}px)` : undefined,
          transition: dragging ? 'none' : 'transform .2s ease',
        }}
      >
        {children}
      </div>
    </div>
  );
}
