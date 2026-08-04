import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { toKey } from '@/lib/dateUtils';
import type { MealEntry, WeightEntry, Settings, Profile } from '@/types';
import type { BackupPayload } from '@/lib/storage';

const TEST_USER_ID = 'test-user';

vi.mock('@/auth', () => ({
  useAuth: () => ({
    user: { id: TEST_USER_ID },
    session: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

const DEFAULT_SETTINGS: Settings = {
  calorieGoal: 2200,
  goalWeight: 75,
  weeklyWeightTarget: -0.3,
  weightUnit: 'kg',
  geminiApiKey: '',
};
const DEFAULT_PROFILE: Profile = { name: '' };

interface FakeDb {
  meals: MealEntry[];
  weights: WeightEntry[];
  settings: Settings;
  profile: Profile;
}

let db: FakeDb;

function resetDb() {
  db = { meals: [], weights: [], settings: { ...DEFAULT_SETTINGS }, profile: { ...DEFAULT_PROFILE } };
}
resetDb();

vi.mock('@/lib/storage', () => ({
  DEFAULT_SETTINGS,
  DEFAULT_PROFILE,
  storage: {
    getMeals: vi.fn(async () => db.meals),
    insertMeal: vi.fn(async (_userId: string, meal: MealEntry) => {
      db.meals = [meal, ...db.meals];
      return true;
    }),
    updateMeal: vi.fn(async (_userId: string, id: string, patch: Partial<MealEntry>) => {
      db.meals = db.meals.map((m) => (m.id === id ? { ...m, ...patch } : m));
      return true;
    }),
    deleteMeal: vi.fn(async (_userId: string, id: string) => {
      db.meals = db.meals.filter((m) => m.id !== id);
      return true;
    }),
    getWeights: vi.fn(async () => db.weights),
    upsertWeight: vi.fn(async (_userId: string, entry: WeightEntry) => {
      db.weights = [...db.weights.filter((w) => w.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date));
      return true;
    }),
    deleteWeight: vi.fn(async (_userId: string, dateKey: string) => {
      db.weights = db.weights.filter((w) => w.date !== dateKey);
      return true;
    }),
    getSettings: vi.fn(async () => db.settings),
    setSettings: vi.fn(async (_userId: string, s: Settings) => {
      db.settings = s;
      return true;
    }),
    getProfile: vi.fn(async () => db.profile),
    setProfile: vi.fn(async (_userId: string, p: Profile) => {
      db.profile = p;
      return true;
    }),
    importBackup: vi.fn(async (_userId: string, payload: BackupPayload) => {
      db.meals = payload.meals ?? [];
      db.weights = payload.weights ?? [];
      db.settings = { ...DEFAULT_SETTINGS, ...payload.settings };
      db.profile = { ...DEFAULT_PROFILE, ...payload.profile };
    }),
    clearAll: vi.fn(async () => {
      db.meals = [];
      db.weights = [];
      db.settings = { ...DEFAULT_SETTINGS };
      db.profile = { ...DEFAULT_PROFILE };
    }),
  },
}));

const { StoreProvider, useStore } = await import('@/store');
const { storage } = await import('@/lib/storage');

async function renderStore() {
  const rendered = renderHook(() => useStore(), {
    wrapper: ({ children }) => <StoreProvider>{children}</StoreProvider>,
  });
  await waitFor(() => expect(rendered.result.current.loading).toBe(false));
  return rendered;
}

function emptyMeal(overrides: Partial<Omit<MealEntry, 'id' | 'createdAt'>> = {}): Omit<MealEntry, 'id' | 'createdAt'> {
  return {
    date: '2026-01-01',
    mealType: 'Breakfast',
    items: [],
    calories: 100,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    reasoning: '',
    ...overrides,
  };
}

beforeEach(() => {
  resetDb();
  vi.clearAllMocks();
});

describe('useStore outside a provider', () => {
  it('throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useStore())).toThrow(/must be used within StoreProvider/);
    spy.mockRestore();
  });
});

describe('initial load', () => {
  it('starts in a loading state and hydrates from storage', async () => {
    db.meals = [{ id: 'seed', date: '2026-01-01', mealType: 'Snack', items: [], calories: 42, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '', createdAt: 1 }];
    const { result } = await renderStore();
    expect(result.current.loading).toBe(false);
    expect(result.current.meals).toEqual(db.meals);
    expect(storage.getMeals).toHaveBeenCalledWith(TEST_USER_ID);
  });
});

describe('meals', () => {
  it('starts empty and adds a meal with a generated id and createdAt', async () => {
    const { result } = await renderStore();
    expect(result.current.meals).toEqual([]);

    act(() => {
      result.current.addMeal(emptyMeal({ calories: 200, protein: 10, carbs: 20, fat: 5, fiber: 2 }));
    });

    expect(result.current.meals).toHaveLength(1);
    expect(result.current.meals[0].id).toBeTruthy();
    expect(result.current.meals[0].createdAt).toBeGreaterThan(0);
    expect(result.current.meals[0].calories).toBe(200);
    expect(storage.insertMeal).toHaveBeenCalledWith(TEST_USER_ID, expect.objectContaining({ calories: 200 }));
  });

  it('prepends new meals (most recent first)', async () => {
    const { result } = await renderStore();
    act(() => { result.current.addMeal(emptyMeal({ calories: 100 })); });
    act(() => { result.current.addMeal(emptyMeal({ date: '2026-01-02', calories: 200 })); });
    expect(result.current.meals[0].calories).toBe(200);
    expect(result.current.meals[1].calories).toBe(100);
  });

  it('updates a meal by id, preserving other fields', async () => {
    const { result } = await renderStore();
    act(() => { result.current.addMeal(emptyMeal()); });
    const id = result.current.meals[0].id;
    act(() => { result.current.updateMeal(id, { calories: 250 }); });
    expect(result.current.meals[0].calories).toBe(250);
    expect(result.current.meals[0].date).toBe('2026-01-01');
    expect(storage.updateMeal).toHaveBeenCalledWith(TEST_USER_ID, id, { calories: 250 });
  });

  it('deletes a meal by id', async () => {
    const { result } = await renderStore();
    act(() => { result.current.addMeal(emptyMeal()); });
    const id = result.current.meals[0].id;
    act(() => { result.current.deleteMeal(id); });
    expect(result.current.meals).toEqual([]);
    expect(storage.deleteMeal).toHaveBeenCalledWith(TEST_USER_ID, id);
  });
});

describe('weights', () => {
  it('logs a weight for today converting from the display unit to kg', async () => {
    const { result } = await renderStore();
    act(() => { result.current.updateSettings({ weightUnit: 'lb' }); });
    act(() => { result.current.logWeight(220.462262); });
    expect(result.current.weights).toHaveLength(1);
    expect(result.current.weights[0].weight).toBeCloseTo(100, 5);
    expect(result.current.weights[0].date).toBe(toKey(new Date()));
    expect(storage.upsertWeight).toHaveBeenCalledWith(TEST_USER_ID, expect.objectContaining({ date: toKey(new Date()) }));
  });

  it('replaces an existing entry for the same date instead of duplicating it', async () => {
    const { result } = await renderStore();
    act(() => { result.current.logWeightForDate(70, '2026-01-05'); });
    act(() => { result.current.logWeightForDate(72, '2026-01-05'); });
    expect(result.current.weights).toHaveLength(1);
    expect(result.current.weights[0].weight).toBe(72);
  });

  it('keeps weights sorted by date ascending', async () => {
    const { result } = await renderStore();
    act(() => { result.current.logWeightForDate(70, '2026-01-10'); });
    act(() => { result.current.logWeightForDate(69, '2026-01-05'); });
    expect(result.current.weights.map((w) => w.date)).toEqual(['2026-01-05', '2026-01-10']);
  });

  it('deletes a weight entry by date', async () => {
    const { result } = await renderStore();
    act(() => { result.current.logWeightForDate(70, '2026-01-05'); });
    act(() => { result.current.deleteWeight('2026-01-05'); });
    expect(result.current.weights).toEqual([]);
    expect(storage.deleteWeight).toHaveBeenCalledWith(TEST_USER_ID, '2026-01-05');
  });
});

describe('getDay', () => {
  it('aggregates totals across all meals for the given date', async () => {
    const { result } = await renderStore();
    act(() => { result.current.addMeal(emptyMeal({ protein: 10, carbs: 5, fat: 2, fiber: 1 })); });
    act(() => { result.current.addMeal(emptyMeal({ calories: 300, protein: 20, carbs: 15, fat: 8, fiber: 3 })); });
    act(() => { result.current.addMeal(emptyMeal({ date: '2026-01-02', calories: 999, protein: 99, carbs: 99, fat: 99, fiber: 9 })); });

    const day = result.current.getDay('2026-01-01');
    expect(day.meals).toHaveLength(2);
    expect(day.totalCalories).toBe(400);
    expect(day.totalProtein).toBe(30);
    expect(day.totalCarbs).toBe(20);
    expect(day.totalFat).toBe(10);
    expect(day.totalFiber).toBe(4);
  });

  it('includes the matching weight entry for the date, if any', async () => {
    const { result } = await renderStore();
    act(() => { result.current.logWeightForDate(80, '2026-01-01'); });
    expect(result.current.getDay('2026-01-01').weight?.weight).toBe(80);
    expect(result.current.getDay('2026-01-02').weight).toBeUndefined();
  });

  it('returns zeroed totals for a day with no meals', async () => {
    const { result } = await renderStore();
    const day = result.current.getDay('2099-12-31');
    expect(day.meals).toEqual([]);
    expect(day.totalCalories).toBe(0);
  });
});

describe('clearAll', () => {
  it('resets meals, weights, settings, and profile to defaults', async () => {
    const { result } = await renderStore();
    act(() => {
      result.current.addMeal(emptyMeal());
      result.current.logWeightForDate(70, '2026-01-01');
      result.current.updateProfile({ name: 'Alex' });
    });

    act(() => { result.current.clearAll(); });

    expect(result.current.meals).toEqual([]);
    expect(result.current.weights).toEqual([]);
    expect(result.current.profile).toEqual({ name: '' });
    expect(storage.clearAll).toHaveBeenCalledWith(TEST_USER_ID);
  });
});

describe('importBackup', () => {
  it('replaces store state with the backup payload contents', async () => {
    const { result } = await renderStore();
    const payload: BackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      meals: [
        { id: 'm1', date: '2026-02-01', mealType: 'Snack', items: [], calories: 50, protein: 1, carbs: 1, fat: 1, fiber: 1, reasoning: '', createdAt: 1 },
      ],
      weights: [{ date: '2026-02-01', weight: 65, createdAt: 1 }],
      settings: { calorieGoal: 1700, goalWeight: 60, weeklyWeightTarget: -0.2, weightUnit: 'kg', geminiApiKey: '' },
      profile: { name: 'Restored' },
    };

    act(() => { result.current.importBackup(payload); });

    expect(result.current.meals).toHaveLength(1);
    expect(result.current.meals[0].id).toBe('m1');
    expect(result.current.weights).toHaveLength(1);
    expect(result.current.settings.calorieGoal).toBe(1700);
    expect(result.current.profile).toEqual({ name: 'Restored' });
    expect(storage.importBackup).toHaveBeenCalledWith(TEST_USER_ID, payload);
  });
});

describe('exportBackup', () => {
  it('packages the current in-memory state without a network round-trip', async () => {
    const { result } = await renderStore();
    act(() => { result.current.addMeal(emptyMeal({ calories: 321 })); });
    act(() => { result.current.logWeightForDate(88, '2026-01-01'); });
    act(() => { result.current.updateProfile({ name: 'Alex' }); });

    const backup = result.current.exportBackup();

    expect(backup.version).toBe(1);
    expect(typeof backup.exportedAt).toBe('string');
    expect(backup.meals).toHaveLength(1);
    expect(backup.meals[0].calories).toBe(321);
    expect(backup.weights).toHaveLength(1);
    expect(backup.profile).toEqual({ name: 'Alex' });
  });
});

describe('persistence to the backing storage layer', () => {
  it('rehydrates from the backing store on a fresh mount without dropping existing data', async () => {
    const first = await renderStore();
    act(() => {
      first.result.current.addMeal(emptyMeal({ calories: 321 }));
      first.result.current.logWeightForDate(88, '2026-01-01');
    });
    first.unmount();

    const second = await renderStore();
    expect(second.result.current.meals).toHaveLength(1);
    expect(second.result.current.meals[0].calories).toBe(321);
    expect(second.result.current.weights).toHaveLength(1);
    expect(second.result.current.weights[0].weight).toBe(88);
  });
});

describe('updateSettings / updateProfile', () => {
  it('merges a partial patch into settings and persists it', async () => {
    const { result } = await renderStore();
    act(() => { result.current.updateSettings({ calorieGoal: 2500 }); });
    expect(result.current.settings.calorieGoal).toBe(2500);
    expect(result.current.settings.weightUnit).toBe('kg');
    expect(storage.setSettings).toHaveBeenCalledWith(TEST_USER_ID, expect.objectContaining({ calorieGoal: 2500 }));
  });

  it('merges a partial patch into profile and persists it', async () => {
    const { result } = await renderStore();
    act(() => { result.current.updateProfile({ name: 'Jamie' }); });
    expect(result.current.profile.name).toBe('Jamie');
    expect(storage.setProfile).toHaveBeenCalledWith(TEST_USER_ID, expect.objectContaining({ name: 'Jamie' }));
  });
});
