import { Plus } from 'lucide-react';

export function FAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Add entry"
      className="fixed right-5 bottom-20 z-40 w-14 h-14 rounded-full bg-gray-900 text-white shadow-lg shadow-black/30 flex items-center justify-center active:scale-95 transition-transform hover:bg-gray-800"
    >
      <Plus size={26} strokeWidth={2.5} />
    </button>
  );
}
