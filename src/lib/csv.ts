import type { MealEntry } from '@/types';
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

export function downloadCsv(meals: MealEntry[]): void {
  const csv = mealsToCsv(meals);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  a.download = `meal-log-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
