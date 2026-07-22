import { Trash2, Utensils, Pencil } from 'lucide-react';
import type { MealEntry } from '@/types';

const MEAL_ICON: Record<string, string> = {
  Breakfast: '🌅',
  Lunch: '☀️',
  Dinner: '🌙',
  Snack: '🍪',
};

interface MealCardProps {
  meal: MealEntry;
  onDelete?: (id: string) => void;
  onEdit?: (meal: MealEntry) => void;
}

export function MealCard({ meal, onDelete, onEdit }: MealCardProps) {
  const itemNames = meal.items.map((i) => i.name).join(', ');
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
      <div className="flex gap-3">
        {meal.imageData ? (
          <img
            src={meal.imageData}
            alt="meal"
            className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Utensils size={22} className="text-gray-300" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-gray-900">{meal.mealType}</span>
            <div className="flex items-center gap-1.5">
              {onEdit && (
                <button
                  onClick={() => onEdit(meal)}
                  className="text-gray-300 hover:text-emerald-600 transition-colors p-1"
                  aria-label="Edit meal"
                >
                  <Pencil size={16} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(meal.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1"
                  aria-label="Delete meal"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{itemNames || '—'}</p>
          <p className="text-[11px] font-semibold text-orange-500 mt-1.5">
            {Math.round(meal.calories)} kcal · P {meal.protein.toFixed(1)}g · C {meal.carbs.toFixed(0)}g · F {meal.fat.toFixed(1)}g
          </p>
        </div>
      </div>
      {meal.reasoning && (
        <p className="mt-2.5 pt-2.5 border-t border-gray-50 text-[11px] text-gray-400 italic leading-relaxed">
          {meal.reasoning}
        </p>
      )}
    </div>
  );
}

export { MEAL_ICON };