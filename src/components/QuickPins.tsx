import { useStore } from '@/store';
import { useUndoToast } from '@/components/UndoToastProvider';
import { todayKey } from '@/lib/dateUtils';
import { haptic } from '@/lib/appearance';
import { Pin, Plus } from 'lucide-react';

/** Home card: pinned meals as one-tap buttons that log straight to today (with undo). */
export function QuickPinsCard() {
  const { pinned, addMeal, deleteMeal } = useStore();
  const { requestUndo } = useUndoToast();

  const log = (pinId: string) => {
    const pin = pinned.find((p) => p.id === pinId);
    if (!pin) return;
    const id = addMeal({
      date: todayKey(),
      mealType: pin.mealType,
      items: pin.items.map((i) => ({ ...i })),
      calories: pin.calories,
      protein: pin.protein,
      carbs: pin.carbs,
      fat: pin.fat,
      fiber: pin.fiber,
      reasoning: '',
    });
    haptic('success');
    if (id) requestUndo(`Logged ${pin.name}`, () => deleteMeal(id));
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <Pin size={15} className="text-accent-600" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Quick add</h2>
        <span className="ml-auto text-11 text-gray-400">Tap to log to today</span>
      </div>
      {pinned.length === 0 ? (
        <p className="text-xs text-gray-400">Pin meals you eat often (the pin on any logged meal) and they'll appear here.</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" data-swipe-row>
          {pinned.map((p) => (
            <button
              key={p.id}
              onClick={() => log(p.id)}
              aria-label={`Log ${p.name}`}
              className="flex-shrink-0 flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl pl-2.5 pr-3 py-2 active:scale-95 transition-transform"
            >
              <span className="w-6 h-6 rounded-full bg-accent-600 text-white flex items-center justify-center"><Plus size={14} /></span>
              <span className="text-left">
                <span className="block text-xs font-semibold text-gray-900 dark:text-white max-w-[9rem] truncate">{p.name}</span>
                <span className="block text-10 text-gray-400">{Math.round(p.calories)} kcal · {p.mealType}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
