import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyPending, loadOutbox, saveOutbox, loadSnapshot, saveSnapshot, type Snapshot, type QueuedOp, type OutboxOp } from '@/lib/offline';
import type { MealEntry, Settings } from '@/types';

const settings: Settings = { calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: 0, weightUnit: 'kg', geminiApiKey: 'k' };

function meal(id: string, calories = 100, photo?: string): MealEntry {
  return {
    id, date: '2026-10-01', mealType: 'Lunch', items: [], calories, protein: 0, carbs: 0, fat: 0, fiber: 0,
    reasoning: '', createdAt: 1, ...(photo ? { imageDatas: [photo] } : {}),
  };
}

const empty: Snapshot = { meals: [], weights: [], settings, profile: { name: '' }, pinned: [] };
const q = (op: OutboxOp): QueuedOp => ({ qid: Math.random().toString(), op, attempts: 0 });

beforeEach(() => localStorage.clear());

describe('applyPending', () => {
  it('lays unsent writes over freshly loaded server data, in order', () => {
    const server: Snapshot = { ...empty, meals: [meal('a'), meal('b')] };
    const result = applyPending(server, [
      q({ kind: 'insertMeal', meal: meal('c', 300) }),
      q({ kind: 'updateMeal', id: 'a', patch: { calories: 999 } }),
      q({ kind: 'deleteMeal', id: 'b' }),
      q({ kind: 'upsertWeight', entry: { date: '2026-10-02', weight: 80, createdAt: 1 } }),
      q({ kind: 'upsertWeight', entry: { date: '2026-10-01', weight: 81, createdAt: 1 } }),
      q({ kind: 'setSettings', settings: { ...settings, calorieGoal: 1800 } }),
    ]);
    expect(result.meals.map((m) => [m.id, m.calories])).toEqual([['c', 300], ['a', 999]]);
    expect(result.weights.map((w) => w.date)).toEqual(['2026-10-01', '2026-10-02']);
    expect(result.settings.calorieGoal).toBe(1800);
  });

  it('does not duplicate an insert that already reached the server', () => {
    const server: Snapshot = { ...empty, meals: [meal('a')] };
    expect(applyPending(server, [q({ kind: 'insertMeal', meal: meal('a', 200) })]).meals).toHaveLength(1);
  });
});

describe('outbox storage', () => {
  it('round-trips the queue per user and clears the key when empty', () => {
    const queue = [q({ kind: 'deleteMeal', id: 'x' })];
    expect(saveOutbox('u1', queue)).toBe(true);
    expect(loadOutbox('u1')).toEqual(queue);
    expect(loadOutbox('u2')).toEqual([]);
    saveOutbox('u1', []);
    expect(localStorage.getItem('calorie_tracker_outbox_u1')).toBeNull();
  });

  it('reports when the queue could not be stored', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(saveOutbox('u1', [q({ kind: 'deleteMeal', id: 'x' })])).toBe(false);
    spy.mockRestore();
  });
});

describe('snapshot storage', () => {
  it('round-trips the last known state, leaving out inline photos but keeping stored ones', () => {
    saveSnapshot('u1', { ...empty, meals: [meal('a', 100, 'data:photo'), meal('b', 100, 'sb:u1/b.jpg')] });
    const loaded = loadSnapshot('u1')!;
    expect(loaded.meals.map((m) => m.id)).toEqual(['a', 'b']);
    expect(loaded.meals[0].imageDatas).toBeUndefined();
    expect(loaded.meals[1].imageDatas).toEqual(['sb:u1/b.jpg']);
    expect(loaded.settings).toEqual(settings);
  });
});
