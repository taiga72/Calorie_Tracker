import { useState } from 'react';
import { useStore } from '@/store';
import { fromKey, formatHeaderDate, isToday } from '@/lib/dateUtils';
import { fmtWeight } from '@/lib/units';
import { Modal } from '@/components/Modal';
import { MealCard } from '@/components/MealCard';
import { LogModal } from '@/modals/LogModal';
import { Flame, Beef, Wheat, Droplet, Sparkles, Scale, Plus } from 'lucide-react';
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
      <Modal open={open} onClose={onClose} title={dateKey ? formatHeaderDate(fromKey(dateKey)) : ''}>
        {day && (
          <div>
            <p className="text-xs text-gray-400 mb-3">{isToday(dateKey!) ? 'Today' : ''}</p>

            {/* Weight stat */}
            {day.weight ? (
              <div className="flex items-center gap-3 bg-blue-50 rounded-2xl p-3 mb-4">
                <Scale size={18} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Weight</span>
                <span className="ml-auto text-lg font-bold text-blue-700">
                  {fmtWeight(day.weight.weight, settings.weightUnit, 1)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3 mb-4">
                <Scale size={18} className="text-gray-300" />
                <span className="text-sm text-gray-400">No weight logged this day</span>
              </div>
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
              <div className="space-y-2.5">
                {day.meals.map((m) => <MealCard key={m.id} meal={m} onDelete={deleteMeal} onEdit={(meal) => setEditing(meal)} />)}
              </div>
            )}
          </div>
        )}
      </Modal>

      {dateKey && (
        <LogModal open={logOpen} onClose={() => setLogOpen(false)} targetDate={dateKey} />
      )}
      <LogModal open={editing !== null} onClose={() => setEditing(null)} editMeal={editing} />
    </>
  );
}
