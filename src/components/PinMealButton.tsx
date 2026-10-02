import { Pin } from 'lucide-react';
import { useStore } from '@/store';
import { useUndoToast } from '@/components/UndoToastProvider';
import { findDuplicatePin, pinFromMeal } from '@/lib/pinnedMeals';
import type { MealEntry } from '@/types';

/** Pins/unpins a logged meal for one-tap re-logging from Quick log. */
export function PinMealButton({ meal }: { meal: MealEntry }) {
  const { pinned, pinMeal, unpinMeal, restorePin } = useStore();
  const { requestUndo } = useUndoToast();
  const existing = findDuplicatePin(pinned, meal);

  const onClick = () => {
    if (existing) {
      unpinMeal(existing.id);
      requestUndo('Meal unpinned', () => restorePin(existing));
    } else {
      const { pin } = pinMeal(pinFromMeal(meal));
      requestUndo('Pinned for one-tap logging', () => unpinMeal(pin.id));
    }
  };

  return (
    <button
      onClick={onClick}
      aria-label={existing ? 'Unpin meal' : 'Pin meal'}
      aria-pressed={!!existing}
      className={`flex-shrink-0 p-1 transition-colors ${existing ? 'text-emerald-600' : 'text-gray-300 hover:text-emerald-600'}`}
    >
      <Pin size={14} className={existing ? 'fill-current' : ''} />
    </button>
  );
}
