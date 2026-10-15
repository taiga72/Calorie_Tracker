import type { MealEntry, WeightEntry, WeightUnit, Workout } from '@/types';
import { kgToUnit } from '@/lib/units';
import { groupSets } from '@/lib/workouts';
import { fromKey } from '@/lib/dateUtils';

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function mealsToCsv(meals: MealEntry[]): string {
  const header = ['Date', 'Meal Type', 'Food Items', 'Calories (kcal)', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Fiber (g)'];
  const rows: string[] = [header.join(',')];

  const sorted = [...meals].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.createdAt - b.createdAt;
  });

  for (const m of sorted) {
    const dateLabel = (() => {
      const d = fromKey(m.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const foodItems = m.items.map((it) => `${it.name} (${Math.round(it.calories)} kcal)`).join('; ');
    const row = [
      csvEscape(dateLabel),
      csvEscape(m.mealType),
      csvEscape(foodItems),
      Math.round(m.calories),
      m.protein.toFixed(1),
      m.carbs.toFixed(1),
      m.fat.toFixed(1),
      m.fiber.toFixed(1),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\r\n');
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function downloadText(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCsv(meals: MealEntry[]): void {
  downloadText(mealsToCsv(meals), `meal-log-${todayStamp()}.csv`);
}

export function weightsToCsv(weights: WeightEntry[], unit: WeightUnit): string {
  const rows = [['Date', `Weight (${unit})`].join(',')];
  for (const w of [...weights].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([csvEscape(w.date), kgToUnit(w.weight, unit).toFixed(1)].join(','));
  }
  return rows.join('\r\n');
}

/** One row per workout; strength sets summed up per exercise ("Bench press 8×60, 8×60"). */
export function workoutsToCsv(workouts: Workout[], unit: WeightUnit): string {
  const rows = [['Date', 'Type', 'Name', 'Minutes', 'Calories burned (kcal)', `Sets (reps×${unit})`, 'Notes'].join(',')];
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  for (const w of sorted) {
    const sets = groupSets(w.sets ?? [])
      .map((g) => `${g.exercise} ${g.sets.map((s) => (s.weight ? `${s.reps}×${+kgToUnit(s.weight, unit).toFixed(1)}` : `${s.reps}`)).join(', ')}`)
      .join('; ');
    rows.push([csvEscape(w.date), csvEscape(w.kind), csvEscape(w.name), w.minutes, Math.round(w.calories), csvEscape(sets), csvEscape(w.notes ?? '')].join(','));
  }
  return rows.join('\r\n');
}

export function downloadWeightsCsv(weights: WeightEntry[], unit: WeightUnit): void {
  downloadText(weightsToCsv(weights, unit), `weight-log-${todayStamp()}.csv`);
}

export function downloadWorkoutsCsv(workouts: Workout[], unit: WeightUnit): void {
  downloadText(workoutsToCsv(workouts, unit), `workout-log-${todayStamp()}.csv`);
}
