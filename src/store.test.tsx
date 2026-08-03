import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { StoreProvider, useStore } from '@/store';
import { toKey } from '@/lib/dateUtils';
import { storage } from '@/lib/storage';

function renderStore() {
  return renderHook(() => useStore(), {
    wrapper: ({ children }) => <StoreProvider>{children}</StoreProvider>,
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe('useStore outside a provider', () => {
  it('throws', () => {
    // React logs the thrown render error to console; silence that expected noise.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useStore())).toThrow(/must be used within StoreProvider/);
    spy.mockRestore();
  });
});

describe('meals', () => {
  it('starts empty and adds a meal with a generated id and createdAt', () => {
    const { result } = renderStore();
    expect(result.current.meals).toEqual([]);

    act(() => {
      result.current.addMeal({
        date: '2026-01-01',
        mealType: 'Breakfast',
        items: [],
        calories: 200,
        protein: 10,
        carbs: 20,
        fat: 5,
        fiber: 2,
        reasoning: '',
      });
    });

    expect(result.current.meals).toHaveLength(1);
    expect(result.current.meals[0].id).toBeTruthy();
    expect(result.current.meals[0].createdAt).toBeGreaterThan(0);
    expect(result.current.meals[0].calories).toBe(200);
  });

  it('prepends new meals (most recent first)', () => {
    const { result } = renderStore();
    act(() => {
      result.current.addMeal({ date: '2026-01-01', mealType: 'Breakfast', items: [], calories: 100, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '' });
    });
    act(() => {
      result.current.addMeal({ date: '2026-01-02', mealType: 'Lunch', items: [], calories: 200, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '' });
    });
    expect(result.current.meals[0].calories).toBe(200);
    expect(result.current.meals[1].calories).toBe(100);
  });

  it('updates a meal by id, preserving other fields', () => {
    const { result } = renderStore();
    act(() => {
      result.current.addMeal({ date: '2026-01-01', mealType: 'Breakfast', items: [], calories: 100, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '' });
    });
    const id = result.current.meals[0].id;
    act(() => {
      result.current.updateMeal(id, { calories: 250 });
    });
    expect(result.current.meals[0].calories).toBe(250);
    expect(result.current.meals[0].date).toBe('2026-01-01');
  });

  it('deletes a meal by id', () => {
    const { result } = renderStore();
    act(() => {
      result.current.addMeal({ date: '2026-01-01', mealType: 'Breakfast', items: [], calories: 100, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '' });
    });
    const id = result.current.meals[0].id;
    act(() => {
      result.current.deleteMeal(id);
    });
    expect(result.current.meals).toEqual([]);
  });
});

describe('weights', () => {
  it('logs a weight for today converting from the display unit to kg', () => {
    const { result } = renderStore();
    act(() => {
      result.current.updateSettings({ weightUnit: 'lb' });
    });
    act(() => {
      result.current.logWeight(220.462262);
    });
    expect(result.current.weights).toHaveLength(1);
    expect(result.current.weights[0].weight).toBeCloseTo(100, 5);
    expect(result.current.weights[0].date).toBe(toKey(new Date()));
  });

  it('replaces an existing entry for the same date instead of duplicating it', () => {
    const { result } = renderStore();
    act(() => {
      result.current.logWeightForDate(70, '2026-01-05');
    });
    act(() => {
      result.current.logWeightForDate(72, '2026-01-05');
    });
    expect(result.current.weights).toHaveLength(1);
    expect(result.current.weights[0].weight).toBe(72);
  });

  it('keeps weights sorted by date ascending', () => {
    const { result } = renderStore();
    act(() => {
      result.current.logWeightForDate(70, '2026-01-10');
    });
    act(() => {
      result.current.logWeightForDate(69, '2026-01-05');
    });
    expect(result.current.weights.map((w) => w.date)).toEqual(['2026-01-05', '2026-01-10']);
  });

  it('deletes a weight entry by date', () => {
    const { result } = renderStore();
    act(() => {
      result.current.logWeightForDate(70, '2026-01-05');
    });
    act(() => {
      result.current.deleteWeight('2026-01-05');
    });
    expect(result.current.weights).toEqual([]);
  });
});

describe('getDay', () => {
  it('aggregates totals across all meals for the given date', () => {
    const { result } = renderStore();
    act(() => {
      result.current.addMeal({ date: '2026-01-01', mealType: 'Breakfast', items: [], calories: 100, protein: 10, carbs: 5, fat: 2, fiber: 1, reasoning: '' });
    });
    act(() => {
      result.current.addMeal({ date: '2026-01-01', mealType: 'Lunch', items: [], calories: 300, protein: 20, carbs: 15, fat: 8, fiber: 3, reasoning: '' });
    });
    act(() => {
      result.current.addMeal({ date: '2026-01-02', mealType: 'Dinner', items: [], calories: 999, protein: 99, carbs: 99, fat: 99, fiber: 9, reasoning: '' });
    });

    const day = result.current.getDay('2026-01-01');
    expect(day.meals).toHaveLength(2);
    expect(day.totalCalories).toBe(400);
    expect(day.totalProtein).toBe(30);
    expect(day.totalCarbs).toBe(20);
    expect(day.totalFat).toBe(10);
    expect(day.totalFiber).toBe(4);
  });

  it('includes the matching weight entry for the date, if any', () => {
    const { result } = renderStore();
    act(() => {
      result.current.logWeightForDate(80, '2026-01-01');
    });
    expect(result.current.getDay('2026-01-01').weight?.weight).toBe(80);
    expect(result.current.getDay('2026-01-02').weight).toBeUndefined();
  });

  it('returns zeroed totals for a day with no meals', () => {
    const { result } = renderStore();
    const day = result.current.getDay('2099-12-31');
    expect(day.meals).toEqual([]);
    expect(day.totalCalories).toBe(0);
  });
});

describe('clearAll', () => {
  it('resets meals, weights, settings, and profile to defaults', () => {
    const { result } = renderStore();
    act(() => {
      result.current.addMeal({ date: '2026-01-01', mealType: 'Breakfast', items: [], calories: 100, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '' });
      result.current.logWeightForDate(70, '2026-01-01');
      result.current.updateProfile({ name: 'Alex' });
    });

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.meals).toEqual([]);
    expect(result.current.weights).toEqual([]);
    expect(result.current.profile).toEqual({ name: '' });
  });
});

describe('importBackup', () => {
  it('replaces store state with the backup payload contents', () => {
    const { result } = renderStore();
    act(() => {
      result.current.importBackup({
        version: 1,
        exportedAt: new Date().toISOString(),
        meals: [
          { id: 'm1', date: '2026-02-01', mealType: 'Snack', items: [], calories: 50, protein: 1, carbs: 1, fat: 1, fiber: 1, reasoning: '', createdAt: 1 },
        ],
        weights: [{ date: '2026-02-01', weight: 65, createdAt: 1 }],
        settings: { calorieGoal: 1700, goalWeight: 60, weeklyWeightTarget: -0.2, weightUnit: 'kg', geminiApiKey: '' },
        profile: { name: 'Restored' },
      });
    });

    expect(result.current.meals).toHaveLength(1);
    expect(result.current.meals[0].id).toBe('m1');
    expect(result.current.weights).toHaveLength(1);
    expect(result.current.settings.calorieGoal).toBe(1700);
    expect(result.current.profile).toEqual({ name: 'Restored' });
  });
});

describe('persistence to localStorage', () => {
  it('writes to storage as soon as addMeal is called', () => {
    const { result } = renderStore();
    act(() => {
      result.current.addMeal({ date: '2026-01-01', mealType: 'Breakfast', items: [], calories: 100, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '' });
    });
    expect(storage.getMeals()).toHaveLength(1);
    expect(storage.getMeals()[0].calories).toBe(100);
  });

  it('writes to storage as soon as updateMeal is called', () => {
    const { result } = renderStore();
    act(() => {
      result.current.addMeal({ date: '2026-01-01', mealType: 'Breakfast', items: [], calories: 100, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '' });
    });
    const id = result.current.meals[0].id;
    act(() => {
      result.current.updateMeal(id, { calories: 999 });
    });
    expect(storage.getMeals()[0].calories).toBe(999);
  });

  it('writes to storage as soon as deleteMeal is called', () => {
    const { result } = renderStore();
    act(() => {
      result.current.addMeal({ date: '2026-01-01', mealType: 'Breakfast', items: [], calories: 100, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '' });
    });
    const id = result.current.meals[0].id;
    act(() => {
      result.current.deleteMeal(id);
    });
    expect(storage.getMeals()).toEqual([]);
  });

  it('writes to storage as soon as logWeight is called', () => {
    const { result } = renderStore();
    act(() => {
      result.current.logWeight(70);
    });
    expect(storage.getWeights()).toHaveLength(1);
    expect(storage.getWeights()[0].weight).toBe(70);
  });

  it('writes to storage as soon as logWeightForDate is called', () => {
    const { result } = renderStore();
    act(() => {
      result.current.logWeightForDate(70, '2026-01-05');
    });
    expect(storage.getWeights()).toEqual([{ date: '2026-01-05', weight: 70, createdAt: expect.any(Number) }]);
  });

  it('writes to storage as soon as deleteWeight is called', () => {
    const { result } = renderStore();
    act(() => {
      result.current.logWeightForDate(70, '2026-01-05');
    });
    act(() => {
      result.current.deleteWeight('2026-01-05');
    });
    expect(storage.getWeights()).toEqual([]);
  });

  it('rehydrates from localStorage on a fresh mount without dropping existing data', () => {
    const first = renderStore();
    act(() => {
      first.result.current.addMeal({ date: '2026-01-01', mealType: 'Breakfast', items: [], calories: 321, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '' });
      first.result.current.logWeightForDate(88, '2026-01-01');
    });
    first.unmount();

    const second = renderStore();
    expect(second.result.current.meals).toHaveLength(1);
    expect(second.result.current.meals[0].calories).toBe(321);
    expect(second.result.current.weights).toHaveLength(1);
    expect(second.result.current.weights[0].weight).toBe(88);
  });
});

describe('updateSettings / updateProfile', () => {
  it('merges a partial patch into settings', () => {
    const { result } = renderStore();
    act(() => {
      result.current.updateSettings({ calorieGoal: 2500 });
    });
    expect(result.current.settings.calorieGoal).toBe(2500);
    expect(result.current.settings.weightUnit).toBe('kg');
  });

  it('merges a partial patch into profile', () => {
    const { result } = renderStore();
    act(() => {
      result.current.updateProfile({ name: 'Jamie' });
    });
    expect(result.current.profile.name).toBe('Jamie');
  });
});
