import { Plus, Sparkles } from 'lucide-react';

export function FAB({ onClick, onCoachClick }: { onClick: () => void; onCoachClick: () => void }) {
  return (
    <div className="fixed right-5 bottom-24 z-50 flex flex-col items-center gap-3">
      <button
        onClick={onCoachClick}
        aria-label="Open AI Coach"
        className="w-12 h-12 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center active:scale-95 transition-transform hover:bg-emerald-700"
      >
        <Sparkles size={20} />
      </button>
      <button
        onClick={onClick}
        aria-label="Add entry"
        className="w-14 h-14 rounded-full bg-gray-900 text-white shadow-lg shadow-black/30 flex items-center justify-center active:scale-95 transition-transform hover:bg-gray-800"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
    </div>
  );
}
