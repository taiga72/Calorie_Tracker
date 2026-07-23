import { useState } from 'react';
import { useStore } from '@/store';
import { fromKey, formatHeaderDate, isToday } from '@/lib/dateUtils';
import { fmtWeight } from '@/lib/units';
import { Modal } from '@/components/Modal';
import { MealCard } from '@/components/MealCard';
import { LogModal } from '@/modals/LogModal';
import { Flame, Beef, Wheat, Droplet, Scale, Plus } from 'lucide-react';
import type { MealEntry } from '@/types';

interface DayDetailModalProps {
  dateKey: string | null;
  onClose: () => void;
}

export function DayDetailModal({ dateKey, onClose }: DayDetailModalProps) {
  const { getDay, settings, deleteMeal } = useStore();
  const [logOpen, setLogOpen] = useState(false);
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const open = dateKey !== null;
  const day = dateKey ? getDay(dateKey) : null;

  return (
    <>
      <Modal open={open} onClose={onClose} title={dateKey ? formatHeaderDate(dateKey) : ''}>
        {day && (
          <div>
            {/* Macro summary */}
            <div className="bg-gray-900 rounded-2xl p-4 text-white mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-300">Total</span>
                <span className="text-2xl font-bold">{Math.round(day.totalCalories)} <span className="text-sm font-medium text-gray-400">kcal</span></span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { l: 'Protein', v: day.totalProtein, c: 'text-emerald-400', Icon: Beef },
                  { l: 'Carbs', v: day.totalCarbs, c: 'text-orange-400', Icon: Wheat },
                  { l: 'Fat', v: day.totalFat, c: 'text-amber-400', Icon: Droplet },
                  { l: 'Cal', v: day.totalCalories, c: 'text-red-400', Icon: Flame },
                ].map((m) => (
                  <div key={m.l} className="flex flex-col items-center">
                    <m.Icon size={15} className={m.c} />
                    <p className={`text-sm font-bold mt-1 ${m.c}`}>{m.v.toFixed(m.l === 'Carbs' ? 0 : 1)}g</p>
                    <p className="text-[10px] text-gray-400">{m.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {day.weight && (
              <div className="flex items-center gap-2 bg-blue-50 text-blue-700 text-xs rounded-xl p-3 mb-4">
                <Scale size={16} className="flex-shrink-0" />
                <span>Logged weight: <strong>{fmtWeight(day.weight.weight, settings.weightUnit)}</strong></span>
              </div>
            )}

            {/* Meals */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-900">Meals ({day.meals.length})</h3>
              {!isToday(dateKey!) && (
                <button onClick={() => setLogOpen(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                  <Plus size={14} /> Add meal
                </button>
              )}
            </div>

            {day.meals.length === 0 ? (
              <div className="text-center py-8 text-gray-300 text-sm">No meals logged this day.</div>
            ) : (
              <div className="space-y-2.5">
                {day.meals.map((m) => (
                  <MealCard key={m.id} meal={m} onDelete={deleteMeal} onEdit={(meal) => setEditing(meal)} />
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {dateKey && <LogModal open={logOpen} onClose={() => setLogOpen(false)} targetDate={dateKey} />}
      <LogModal open={editing !== null} onClose={() => setEditing(null)} editMeal={editing} />
    </>
  );
}
