import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import type { MealType, PinnedMeal } from '@/types';

const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

type Macros = { protein: string; carbs: string; fat: string; fiber: string };

const num = (v: string) => Math.max(0, Number(v) || 0);
const round1 = (v: number) => Math.round(v * 10) / 10;

interface PinEditorProps {
  pin: PinnedMeal;
  onSave: (patch: Partial<Omit<PinnedMeal, 'id' | 'createdAt'>>) => void;
  onDelete: () => void;
  onCancel: () => void;
}

/**
 * Rename a pin and adjust its nutrition. Changing calories scales the
 * macros (and the item breakdown) to match, the same way the meal editor's
 * total-calorie override does; macros can then be fine-tuned individually.
 */
export function PinEditor({ pin, onSave, onDelete, onCancel }: PinEditorProps) {
  const [name, setName] = useState(pin.name);
  const [mealType, setMealType] = useState<MealType>(pin.mealType);
  const [calories, setCalories] = useState(String(Math.round(pin.calories)));
  const [macros, setMacros] = useState<Macros>({
    protein: String(round1(pin.protein)),
    carbs: String(round1(pin.carbs)),
    fat: String(round1(pin.fat)),
    fiber: String(round1(pin.fiber)),
  });
  // Calories the macros currently correspond to, for proportional scaling.
  const [macrosBasis, setMacrosBasis] = useState(pin.calories);

  const applyCalories = () => {
    const next = num(calories);
    setCalories(String(Math.round(next)));
    if (macrosBasis <= 0 || next === macrosBasis) return;
    const ratio = next / macrosBasis;
    setMacros((m) => ({
      protein: String(round1(num(m.protein) * ratio)),
      carbs: String(round1(num(m.carbs) * ratio)),
      fat: String(round1(num(m.fat) * ratio)),
      fiber: String(round1(num(m.fiber) * ratio)),
    }));
    setMacrosBasis(next);
  };

  const save = () => {
    const kcal = Math.round(num(calories));
    const ratio = pin.calories > 0 ? kcal / pin.calories : 1;
    onSave({
      name: name.trim() || pin.name,
      mealType,
      calories: kcal,
      protein: num(macros.protein),
      carbs: num(macros.carbs),
      fat: num(macros.fat),
      fiber: num(macros.fiber),
      items: ratio === 1 ? pin.items : pin.items.map((it) => ({
        ...it,
        calories: Math.round(it.calories * ratio),
        protein: round1(it.protein * ratio),
        carbs: round1(it.carbs * ratio),
        fat: round1(it.fat * ratio),
        fiber: round1(it.fiber * ratio),
      })),
    });
  };

  return (
    <div>
      <label className="text-xs font-semibold text-gray-400 mb-1.5 block" htmlFor="pin-name">Name</label>
      <input
        id="pin-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        className="w-full bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 ring-accent-500/30"
      />

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-3">
        {MEAL_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setMealType(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              mealType === t ? 'bg-gray-900 dark:bg-accent-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <label className="text-xs font-semibold text-gray-400 mt-4 mb-1.5 block" htmlFor="pin-calories">Calories</label>
      <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
        <input
          id="pin-calories"
          type="number"
          inputMode="numeric"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          onBlur={applyCalories}
          className="flex-1 bg-transparent text-lg font-bold text-gray-900 dark:text-white outline-none"
        />
        <span className="text-xs text-gray-400">kcal</span>
      </div>
      <p className="text-11 text-gray-400 mt-1">Changing calories scales the macros to match.</p>

      <div className="grid grid-cols-4 gap-2 mt-3">
        {([
          ['protein', 'Protein', 'text-emerald-600'],
          ['carbs', 'Carbs', 'text-orange-500'],
          ['fat', 'Fat', 'text-amber-500'],
          ['fiber', 'Fiber', 'text-purple-500'],
        ] as const).map(([key, label, color]) => (
          <label key={key} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
            <input
              type="number"
              inputMode="decimal"
              aria-label={`${label} (g)`}
              value={macros[key]}
              onChange={(e) => setMacros((m) => ({ ...m, [key]: e.target.value }))}
              className={`w-full bg-transparent text-center text-sm font-bold outline-none ${color}`}
            />
            <span className="text-10 text-gray-400">{label} g</span>
          </label>
        ))}
      </div>

      <div className="flex gap-2 mt-5">
        <button
          onClick={onDelete}
          aria-label="Delete pin"
          className="w-12 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-950 text-red-500 active:scale-95 transition-transform"
        >
          <Trash2 size={16} />
        </button>
        <button onClick={onCancel} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold py-3 rounded-xl text-sm">
          Cancel
        </button>
        <button onClick={save} className="flex-1 bg-accent-600 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
          <Check size={16} /> Save pin
        </button>
      </div>
    </div>
  );
}
