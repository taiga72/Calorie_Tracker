import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
}

const DISMISS_THRESHOLD_PX = 100;
// A quick flick down closes too, even if it didn't travel far.
const FLICK_PX_PER_MS = 0.6;
const FLICK_MIN_PX = 40;
const AXIS_LOCK_PX = 8;
// Dragging that starts in these keeps its normal behavior (typing, selecting
// text, scrubbing a chart).
const NO_DRAG = 'input, textarea, select, [contenteditable="true"], [data-chart]';

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Swipe down anywhere on the sheet to close it — when it's scrolled to the
  // top, so scrolling a long sheet still works. Touch events, not pointer
  // events: on iPhone a vertical drag in a scrollable area is otherwise taken
  // over by the browser's scrolling.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!open || !sheet) return;
    let start: { x: number; y: number; t: number } | null = null;
    let mode: 'undecided' | 'dismiss' | 'other' = 'undecided';
    let current = 0;

    const onStart = (e: TouchEvent) => {
      const target = e.target as Element | null;
      if (e.touches.length !== 1 || target?.closest?.(NO_DRAG)) { start = null; return; }
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
      mode = 'undecided';
      current = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (mode === 'undecided') {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        mode = dy > 0 && Math.abs(dy) > Math.abs(dx) && sheet.scrollTop <= 0 ? 'dismiss' : 'other';
        if (mode === 'dismiss') setDragging(true);
      }
      if (mode !== 'dismiss') return;
      if (e.cancelable) e.preventDefault();
      current = Math.max(0, dy);
      setDragY(current);
    };
    const onEnd = () => {
      if (start && mode === 'dismiss') {
        const speed = current / Math.max(1, Date.now() - start.t);
        if (current > DISMISS_THRESHOLD_PX || (current > FLICK_MIN_PX && speed > FLICK_PX_PER_MS)) onCloseRef.current();
      }
      start = null;
      mode = 'undecided';
      current = 0;
      setDragging(false);
      setDragY(0);
    };
    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', onEnd);
    sheet.addEventListener('touchcancel', onEnd);
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', onEnd);
      sheet.removeEventListener('touchcancel', onEnd);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) { setDragY(0); setDragging(false); dragStartY.current = null; }
  }, [open]);

  if (!open) return null;

  // The grab handle, for mouse and pen; touch drags are handled for the
  // whole sheet above.
  const onDragStart = (e: ReactPointerEvent) => {
    if (e.pointerType === 'touch') return;
    dragStartY.current = e.clientY;
    setDragging(true);
  };
  const onDragMove = (e: ReactPointerEvent) => {
    if (dragStartY.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStartY.current));
  };
  const onDragEnd = () => {
    if (dragY > DISMISS_THRESHOLD_PX) onClose();
    setDragY(0);
    setDragging(false);
    dragStartY.current = null;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        style={{ opacity: 1 - Math.min(dragY / 300, 0.6) }}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={`relative w-full ${maxWidth} bg-[#F8F9FA] dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto overflow-x-hidden overscroll-contain animate-[slideUp_.25s_ease]`}
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : 'transform .2s ease',
        }}
      >
        <div
          className="flex justify-center pt-2.5 pb-1 cursor-grab touch-none sm:hidden"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <div className="w-9 h-1.5 rounded-full bg-gray-300" />
        </div>
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-[#F8F9FA]/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400" aria-label="Close">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
