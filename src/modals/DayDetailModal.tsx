import { useState } from 'react';
import { useStore } from '@/store';
import { fromKey, formatHeaderDate, isToday } from '@/lib/dateUtils';
import { fmtWeight } from '@/lib/units';
import { Modal } from '@/components/Modal';
import { LogModal } from '@/modals/LogModal';
import { Flame, Beef, Wheat, Droplet, Sparkles, Scale, Plus, Pencil, Trash2, Coffee, Sun, Moon, Cookie, Utensils } from 'lucide-react';
import type { MealEntry } from '@/types';

const MEAL_ORDER = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const MEAL_ICON: Record<string, typeof Coffee> = {
  Breakfast: Coffee, Lunch: Sun, Dinner: Moon, Snack: Cookie,
};

interface DayDetailModalProps {
  dateKey: string | null;
  onClose: () => void;
}

export function DayDetailModal({ dateKey, onClose }: DayDetailModalProps) {
  const { getDay, settings, deleteMeal } = useStore();
  const [logOpen, setLogOpen] = useState(false);
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const open = dateKey !== null;
  const day = dateKey ? getDay(dateKey) : null;
  const mealsByType = day ? MEAL_ORDER.map((type) => ({
    type, meals: day.meals.filter((m) => m.mealType === type),
  })).filter((g) => g.meals.length > 0) : [];

  return (
    <>
      <Modal open={open} onClose={onClose} title={dateKey ? formatHeaderDate(fromKey(dateKey)) : ''}>
        {day && (
          <div>
            <p className="text-xs text-gray-400 mb-3">{isToday(dateKey!) ? 'Today' : ''}</p>

            {/* Weight stat - interactive */}
            {day.weight ? (
              <div className="flex items-center gap-3 bg-blue-50 rounded-2xl p-3 mb-4">
                <Scale size={18} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Weight</span>
                <span className="ml-auto text-lg font-bold text-blue-700">
                  {fmtWeight(day.weight.weight, settings.weightUnit, 1)}
                </span>
                <button
                  onClick={() => setWeightOpen(true)}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-blue-600 hover:bg-blue-100 transition-colors"
                  aria-label="Edit weight"
                >
                  <Pencil size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setWeightOpen(true)}
                className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-3 mb-4 active:scale-[.99] transition-transform"
              >
                <Scale size={18} className="text-gray-400" />
                <span className="text-sm text-gray-400">No weight logged this day</span>
                <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600">
                  <Plus size={14} /> Add weight
                </span>
              </button>
            )}

            {/* Stat pills */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { label: 'Calories', val: String(Math.round(day.totalCalories)), Icon: Flame, color: 'text-orange-500 bg-orange-50' },
                { label: 'Protein', val: `${day.totalProtein.toFixed(1)}g`, Icon: Beef, color: 'text-emerald-600 bg-emerald-50' },
                { label: 'Carbs', val: `${day.totalCarbs.toFixed(0)}g`, Icon: Wheat, color: 'text-orange-400 bg-orange-50' },
                { label: 'Fat', val: `${day.totalFat.toFixed(1)}g`, Icon: Droplet, color: 'text-amber-500 bg-amber-50' },
                { label: 'Fiber', val: `${day.totalFiber.toFixed(1)}g`, Icon: Sparkles, color: 'text-purple-500 bg-purple-50' },
              ].map(({ label, val, Icon, color }) => (
                <div key={label} className={`rounded-2xl p-3 flex flex-col items-center ${color}`}>
                  <Icon size={16} />
                  <span className="text-base font-bold mt-1">{val}</span>
                  <span className="text-[10px] font-medium opacity-80">{label}</span>
                </div>
              ))}
            </div>

            {/* Meal cards */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Meals ({day.meals.length})
              </h3>
              <button
                onClick={() => setLogOpen(true)}
                className="flex items-center gap-1 bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full active:scale-95 transition-transform"
              >
                <Plus size={14} /> Log Meal
              </button>
            </div>
            {day.meals.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No meals logged this day.</p>
            ) : (
              <div className="space-y-3">
                {mealsByType.map(({ type, meals }) => {
                  const Icon = MEAL_ICON[type];
                  const typeCals = meals.reduce((a, b) => a + b.calories, 0);
                  return (
                    <div key={type} className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                        <Icon size={15} className="text-gray-400" />
                        <span className="text-sm font-bold text-gray-900">{type}</span>
                        <span className="text-xs text-gray-400 ml-auto">• {Math.round(typeCals).toLocaleString()} kcal</span>
                      </div>
                      <div className="px-4 divide-y divide-gray-50">
                        {meals.map((m) => {
                          const itemNames = m.items.map((i) => i.name).join(', ');
                          const thumb = m.imageDatas?.[0] || m.imageData;
                          return (
                            <div key={m.id} className="flex items-center gap-3 py-2.5">
                              {thumb ? (
                                <div className="relative flex-shrink-0">
                                  <img src={thumb} alt="meal" className="w-11 h-11 rounded-2xl object-cover" />
                                  {m.imageDatas && m.imageDatas.length > 1 && (
                                    <span className="absolute -bottom-1 -right-1 bg-black/60 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">+{m.imageDatas.length - 1}</span>
                                  )}
                                </div>
                              ) : (
                                <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <Utensils size={16} className="text-gray-300" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{itemNames || m.mealType}</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  <span className="text-orange-500 font-semibold">{Math.round(m.calories)} kcal</span>
                                  {' · P '}{m.protein.toFixed(0)}g · C {m.carbs.toFixed(0)}g · F {m.fat.toFixed(0)}g
                                </p>
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button onClick={() => setEditing(m)} className="text-gray-300 hover:text-emerald-600 transition-colors p-1" aria-label="Edit meal">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => deleteMeal(m.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1" aria-label="Delete meal">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>

      {dateKey && (
        <LogModal open={logOpen} onClose={() => setLogOpen(false)} targetDate={dateKey} />
      )}
      <LogModal open={editing !== null} onClose={() => setEditing(null)} editMeal={editing} />
      {dateKey && (
        <LogModal open={weightOpen} onClose={() => setWeightOpen(false)} weightDate={dateKey} initialMode="weight" />
      )}
    </>
  );
}
