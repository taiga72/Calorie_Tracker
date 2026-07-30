import { Modal } from '@/components/Modal';
import { Flame } from 'lucide-react';
import { getEncouragingMessage } from '@/lib/streakUtils';

interface StreakModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  streak: number;
}

export function StreakModal({ open, onClose, name, streak }: StreakModalProps) {
  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center py-6">
        <div className="relative mb-5">
          <div className="absolute inset-0 rounded-full bg-orange-400/40 blur-2xl animate-ping" />
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/40">
            <Flame size={52} className="text-white animate-pulse" />
          </div>
        </div>

        <p className="text-sm font-semibold text-gray-400 tracking-wide">
          {streak} day{streak === 1 ? '' : 's'} streak
        </p>
        <h2 className="text-2xl font-bold text-gray-900 mt-1">
          {name.trim() || 'Friend'}, you're on fire!
        </h2>

        <p className="text-sm text-gray-500 leading-relaxed mt-3 px-2">
          {getEncouragingMessage(streak)}
        </p>

        <button
          onClick={onClose}
          className="w-full mt-7 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold py-3.5 rounded-2xl text-sm active:scale-[.99] transition-transform shadow-md shadow-orange-500/30"
        >
          Keep it going
        </button>
      </div>
    </Modal>
  );
}
