import type { MealEntry, WeightLog } from '@/types';

function csvEscape(val: string | number | null | undefined): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportToCsv(meals: MealEntry[], weights: WeightLog[], userName: string) {
  const lines: string[] = [];

  lines.push(`# MacroFlow Export - ${userName}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Meals');
  lines.push('Date,Time,Meal Type,Calories,Protein (g),Carbs (g),Fat (g),Fiber (g),Food Items,Reasoning');
  for (const m of meals) {
    const d = new Date(m.logged_at);
    const itemsStr = m.food_items.map((i) => `${i.name} (${i.calories}kcal)`).join('; ');
    lines.push(
      [
        d.toLocaleDateString(),
        d.toLocaleTimeString(),
        m.meal_type,
        m.calories,
        m.protein,
        m.carbs,
        m.fat,
        m.fiber,
        itemsStr,
        m.reasoning,
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  lines.push('');
  lines.push('## Weight History');
  lines.push('Date,Weight (kg)');
  for (const w of weights) {
    lines.push([new Date(w.logged_at).toLocaleDateString(), w.weight_kg].map(csvEscape).join(','));
  }

  lines.push('');
  lines.push('## Daily Macro Totals');
  lines.push('Date,Total Calories,Total Protein (g),Total Carbs (g),Total Fat (g),Total Fiber (g),Meal Count');
  const byDay = new Map<string, { c: number; p: number; cb: number; f: number; fi: number; n: number }>();
  for (const m of meals) {
    const key = new Date(m.logged_at).toLocaleDateString();
    const cur = byDay.get(key) || { c: 0, p: 0, cb: 0, f: 0, fi: 0, n: 0 };
    cur.c += m.calories;
    cur.p += m.protein;
    cur.cb += m.carbs;
    cur.f += m.fat;
    cur.fi += m.fiber;
    cur.n += 1;
    byDay.set(key, cur);
  }
  for (const [date, t] of byDay) {
    lines.push([date, t.c, t.p, t.cb, t.f, t.fi, t.n].join(','));
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `macroflow-${userName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
