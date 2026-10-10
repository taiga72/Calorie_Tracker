import { Pin } from 'lucide-react';
import { useStore } from '@/store';
import { useUndoToast } from '@/components/UndoToastProvider';
import { findDuplicatePin, pinFromItem, pinFromMeal } from '@/lib/pinnedMeals';
import type { FoodItem, MealEntry } from '@/types';

type PinTarget =
  | { meal: Pick<MealEntry, 'mealType' | 'items' | 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber'>; item?: undefined; mealType?: undefined }
  | { item: FoodItem; mealType: MealEntry['mealType']; meal?: undefined };

/**
 * Pins/unpins a logged meal — or one food from it — for one-tap re-logging
 * from Quick log and the Quick add card.
 */
export function PinMealButton(props: PinTarget & { size?: number }) {
  const { pinned, pinMeal, unpinMeal, restorePin } = useStore();
  const { requestUndo } = useUndoToast();
  const candidate = props.item ? pinFromItem(props.item, props.mealType) : pinFromMeal(props.meal);
  const existing = findDuplicatePin(pinned, candidate);
  const what = props.item ? props.item.name || 'item' : 'meal';

  const onClick = () => {
    if (existing) {
      unpinMeal(existing.id);
      requestUndo(props.item ? `Unpinned ${what}` : 'Meal unpinned', () => restorePin(existing));
    } else {
      const { pin } = pinMeal(candidate);
      requestUndo(props.item ? `Pinned ${what}` : 'Pinned for one-tap logging', () => unpinMeal(pin.id));
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={props.item ? `${existing ? 'Unpin' : 'Pin'} ${what}` : existing ? 'Unpin meal' : 'Pin meal'}
      aria-pressed={!!existing}
      className={`flex-shrink-0 p-1 transition-colors ${existing ? 'text-accent-600' : 'text-gray-300 hover:text-accent-600'}`}
    >
      <Pin size={props.size ?? 14} className={existing ? 'fill-current' : ''} />
    </button>
  );
}
