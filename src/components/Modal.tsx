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

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);

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

  const onDragStart = (e: ReactPointerEvent) => {
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
        className={`relative w-full ${maxWidth} bg-[#F8F9FA] rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-[slideUp_.25s_ease]`}
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
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-[#F8F9FA]/95 backdrop-blur border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500" aria-label="Close">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
