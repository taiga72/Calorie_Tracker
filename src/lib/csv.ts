import type { MealEntry } from '@/types';

export function downloadCsv(meals: MealEntry[]): void {
  const header = ['Date', 'Meal Type', 'Food', 'Calories (kcal)', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Fiber (g)'];
  const rows = meals.map((m) => {
    const food = m.items.map((i) => i.name).join('; ');
    return [
      m.date,
      m.mealType,
      `"${food.replace(/"/g, '""')}"`,
      Math.round(m.calories),
      m.protein.toFixed(1),
      m.carbs.toFixed(1),
      m.fat.toFixed(1),
      m.fiber.toFixed(1),
    ];
  });
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const today = new Date().toISOString().slice(0, 10);
  a.download = `meal-log-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
