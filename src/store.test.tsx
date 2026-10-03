import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { toKey } from '@/lib/dateUtils';
import type { MealEntry, WeightEntry, Settings, Profile, PinnedMeal } from '@/types';
import type { BackupPayload } from '@/lib/storage';

const TEST_USER_ID = 'test-user';

let authStatus: 'pending' | 'verified' | 'offline' = 'verified';

vi.mock('@/auth', () => ({
  useAuth: () => ({
    user: { id: TEST_USER_ID },
    status: authStatus,
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
  pinned: PinnedMeal[];
}

let db: FakeDb;

function resetDb() {
  db = { meals: [], weights: [], settings: { ...DEFAULT_SETTINGS }, profile: { ...DEFAULT_PROFILE }, pinned: [] };
}
resetDb();

vi.mock('@/lib/storage', () => ({
  DEFAULT_SETTINGS,
  DEFAULT_PROFILE,
  storage: {
    // Like the real query: meals come back without their photo columns.
    getMeals: vi.fn(async () => db.meals.map(({ imageData: _a, imageDatas: _b, ...rest }) => rest)),
    getMealPhotos: vi.fn(async (_userId: string, ids: string[]) => db.meals
      .filter((m) => ids.includes(m.id) && (m.imageData || m.imageDatas))
      .map((m) => ({ id: m.id, imageData: m.imageData, imageDatas: m.imageDatas }))),
    insertMeal: vi.fn(async (_userId: string, meal: MealEntry) => {
      db.meals = [meal, ...db.meals.filter((m) => m.id !== meal.id)];
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
    getPinnedMeals: vi.fn(async (): Promise<PinnedMeal[] | null> => db.pinned),
    upsertPinnedMeal: vi.fn(async (_userId: string, pin: PinnedMeal) => {
      db.pinned = [pin, ...db.pinned.filter((p) => p.id !== pin.id)];
      return true;
    }),
    replaceMealPhotos: vi.fn(async (_userId: string, id: string, refs: string[]) => {
      db.meals = db.meals.map((m) => (m.id === id ? { ...m, imageData: undefined, imageDatas: refs } : m));
      return true;
    }),
    deletePinnedMeal: vi.fn(async (_userId: string, id: string) => {
      db.pinned = db.pinned.filter((p) => p.id !== id);
      return true;
    }),
    importBackup: vi.fn(async (_userId: string, payload: BackupPayload) => {
      db.meals = payload.meals ?? [];
      db.weights = payload.weights ?? [];
      db.settings = { ...DEFAULT_SETTINGS, ...payload.settings };
      db.profile = { ...DEFAULT_PROFILE, ...payload.profile };
      return true;
    }),
    clearAll: vi.fn(async () => {
      db.meals = [];
      db.weights = [];
      db.settings = { ...DEFAULT_SETTINGS };
      db.profile = { ...DEFAULT_PROFILE };
      return true;
    }),
  },
}));

const storeInlinePhotos = vi.fn(async (_uid: string, photos: string[]) => photos.map((p) => (p.startsWith('data:') ? `sb:${p.slice(5)}` : p)));
const photoToDataUrl = vi.fn(async (src: string) => (src.startsWith('sb:') ? `data:${src.slice(3)}` : src));
vi.mock('@/lib/photoStorage', () => ({
  isDataUrl: (s: string) => s.startsWith('data:'),
  isStorageRef: (s: string) => s.startsWith('sb:'),
  photoStorageAvailable: () => true,
  storeInlinePhotos: (uid: string, photos: string[]) => storeInlinePhotos(uid, photos),
  photoToDataUrl: (src: string) => photoToDataUrl(src),
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

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

beforeEach(() => {
  resetDb();
  vi.clearAllMocks();
  localStorage.clear();
  // Photo migration has its own tests; elsewhere it's already done.
  localStorage.setItem(`calorie_tracker_photos_migrated_${TEST_USER_ID}`, '1');
  setOnline(true);
  authStatus = 'verified';
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

  it('still loads meals/settings/profile and stops loading when only the weights fetch fails', async () => {
    db.meals = [{ id: 'seed', date: '2026-01-01', mealType: 'Snack', items: [], calories: 42, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '', createdAt: 1 }];
    vi.mocked(storage.getWeights).mockRejectedValueOnce(new Error('boom'));

    const { result } = await renderStore();

    expect(result.current.loading).toBe(false);
    expect(result.current.meals).toEqual(db.meals);
    expect(result.current.weights).toEqual([]);
    expect(result.current.syncError).toMatch(/couldn't load your weight history/i);
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
    // Queued writes go out one at a time, in order.
    await waitFor(() => expect(storage.updateMeal).toHaveBeenCalledWith(TEST_USER_ID, id, { calories: 250 }));
  });

  it('deletes a meal by id', async () => {
    const { result } = await renderStore();
    act(() => { result.current.addMeal(emptyMeal()); });
    const id = result.current.meals[0].id;
    act(() => { result.current.deleteMeal(id); });
    expect(result.current.meals).toEqual([]);
    // Queued writes go out one at a time, in order.
    await waitFor(() => expect(storage.deleteMeal).toHaveBeenCalledWith(TEST_USER_ID, id));
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
    // Queued writes go out one at a time, in order.
    await waitFor(() => expect(storage.upsertWeight).toHaveBeenCalledWith(TEST_USER_ID, expect.objectContaining({ date: toKey(new Date()) })));
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
    // Queued writes go out one at a time, in order.
    await waitFor(() => expect(storage.deleteWeight).toHaveBeenCalledWith(TEST_USER_ID, '2026-01-05'));
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

describe('syncError', () => {
  it('starts null and stays null after a successful write', async () => {
    const { result } = await renderStore();
    expect(result.current.syncError).toBeNull();
    act(() => { result.current.logWeightForDate(70, '2026-01-05'); });
    expect(result.current.syncError).toBeNull();
  });

  it('is set when a weight write fails, without reverting the optimistic UI update', async () => {
    vi.mocked(storage.upsertWeight).mockResolvedValueOnce(false);
    const { result } = await renderStore();

    await act(async () => { result.current.logWeightForDate(70, '2026-01-05'); });

    expect(result.current.weights).toHaveLength(1); // still shown in the UI
    expect(result.current.syncError).toMatch(/couldn't save your weight/i);
  });

  it('is set when a meal write fails', async () => {
    vi.mocked(storage.insertMeal).mockResolvedValueOnce(false);
    const { result } = await renderStore();

    await act(async () => { result.current.addMeal(emptyMeal()); });

    expect(result.current.syncError).toMatch(/couldn't save your meal/i);
  });

  it('is cleared by dismissSyncError', async () => {
    vi.mocked(storage.upsertWeight).mockResolvedValueOnce(false);
    const { result } = await renderStore();

    await act(async () => { result.current.logWeightForDate(70, '2026-01-05'); });
    expect(result.current.syncError).not.toBeNull();

    act(() => { result.current.dismissSyncError(); });
    expect(result.current.syncError).toBeNull();
  });
});

describe('refresh', () => {
  it('sets lastSyncedAt after a successful initial load', async () => {
    const { result } = await renderStore();
    expect(result.current.lastSyncedAt).toBeGreaterThan(0);
  });

  it('re-fetches on demand, toggling refreshing and updating lastSyncedAt', async () => {
    const { result } = await renderStore();
    const firstSync = result.current.lastSyncedAt;
    db.meals = [{ id: 'new', date: '2026-01-01', mealType: 'Snack', items: [], calories: 1, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '', createdAt: 1 }];

    expect(result.current.refreshing).toBe(false);
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.refresh(); });
    expect(result.current.refreshing).toBe(true);
    await act(async () => { await pending; });

    expect(result.current.refreshing).toBe(false);
    expect(result.current.meals).toEqual(db.meals);
    expect(result.current.lastSyncedAt).toBeGreaterThanOrEqual(firstSync!);
  });

  it('surfaces a syncError and leaves lastSyncedAt unchanged when the refresh fails', async () => {
    const { result } = await renderStore();
    const firstSync = result.current.lastSyncedAt;
    vi.mocked(storage.getWeights).mockRejectedValueOnce(new Error('boom'));

    await act(async () => { await result.current.refresh(); });

    expect(result.current.syncError).toMatch(/couldn't load your weight history/i);
    expect(result.current.lastSyncedAt).toBe(firstSync);
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

describe('offline logging', () => {
  it('keeps changes on the device while offline and sends them when the connection returns', async () => {
    const { result } = await renderStore();
    setOnline(false);

    act(() => { result.current.addMeal(emptyMeal({ calories: 444 })); });

    expect(result.current.meals[0].calories).toBe(444);
    expect(result.current.pendingCount).toBe(1);
    expect(result.current.syncError).toBeNull();
    expect(storage.insertMeal).not.toHaveBeenCalled();

    setOnline(true);
    await act(async () => { window.dispatchEvent(new Event('online')); });

    await waitFor(() => expect(result.current.pendingCount).toBe(0));
    expect(storage.insertMeal).toHaveBeenCalledWith(TEST_USER_ID, expect.objectContaining({ calories: 444 }));
    expect(db.meals).toHaveLength(1);
  });

  it('survives closing the app before the changes were sent', async () => {
    const first = await renderStore();
    setOnline(false);
    act(() => { first.result.current.logWeightForDate(81, '2026-02-01'); });
    first.unmount();

    vi.mocked(storage.getWeights).mockRejectedValueOnce(new Error('offline'));
    const second = await renderStore();

    expect(second.result.current.weights.map((w) => w.weight)).toEqual([81]);
    expect(second.result.current.pendingCount).toBe(1);
    // Being offline is not an error; the offline indicator covers it.
    expect(second.result.current.syncError).toBeNull();
  });

  it('a refresh never drops changes that are still waiting to be sent', async () => {
    const { result } = await renderStore();
    setOnline(false);
    act(() => { result.current.addMeal(emptyMeal({ calories: 555 })); });

    await act(async () => { await result.current.refresh(); });

    expect(result.current.meals.map((m) => m.calories)).toEqual([555]);
  });

  it('retries a failed save and clears the error once it goes through', async () => {
    vi.mocked(storage.upsertWeight).mockResolvedValueOnce(false);
    const { result } = await renderStore();

    await act(async () => { result.current.logWeightForDate(70, '2026-01-05'); });
    expect(result.current.syncError).toMatch(/retry automatically/i);
    expect(result.current.pendingCount).toBe(1);

    await act(async () => { await result.current.refresh(); });

    expect(result.current.pendingCount).toBe(0);
    expect(result.current.syncError).toBeNull();
    expect(db.weights).toHaveLength(1);
  });

  it('opens instantly from the last cached state, before the server answers', async () => {
    db.meals = [{ ...emptyMeal({ calories: 321 }), id: 'cached', createdAt: 1 }];
    const first = await renderStore();
    // The cache is written shortly after changes settle.
    await waitFor(() => expect(localStorage.getItem(`calorie_tracker_cache_${TEST_USER_ID}`)).not.toBeNull(), { timeout: 2000 });
    first.unmount();

    vi.mocked(storage.getMeals).mockReturnValueOnce(new Promise(() => {}));
    const second = renderHook(() => useStore(), {
      wrapper: ({ children }) => <StoreProvider>{children}</StoreProvider>,
    });

    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.meals.map((m) => m.id)).toEqual(['cached']);
  });
});

describe('auto-sync', () => {
  it('re-syncs when the app comes back to the foreground', async () => {
    await renderStore();
    expect(storage.getMeals).toHaveBeenCalledTimes(1);
    const realNow = Date.now;
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 60_000);

    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });

    await waitFor(() => expect(storage.getMeals).toHaveBeenCalledTimes(2));
    vi.mocked(Date.now).mockRestore();
  });

  it('does not re-sync on a quick app switch', async () => {
    await renderStore();
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(storage.getMeals).toHaveBeenCalledTimes(1);
  });
});

describe('pinned meals', () => {
  const oats = { name: 'Oats', mealType: 'Breakfast' as const, items: [{ name: 'Oats (80g)', calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 8 }], calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 8 };

  it('pins a meal and syncs it', async () => {
    const { result } = await renderStore();
    act(() => { result.current.pinMeal(oats); });
    expect(result.current.pinned.map((p) => p.name)).toEqual(['Oats']);
    await waitFor(() => expect(db.pinned).toHaveLength(1));
  });

  it('never pins the same meal twice', async () => {
    const { result } = await renderStore();
    let second!: { alreadyPinned: boolean };
    act(() => { result.current.pinMeal(oats); });
    act(() => {
      second = result.current.pinMeal({ ...oats, items: [{ ...oats.items[0], name: 'Oats (100g)' }], calories: 310 });
    });
    expect(second.alreadyPinned).toBe(true);
    expect(result.current.pinned).toHaveLength(1);
  });

  it('unpins and restores a pin', async () => {
    const { result } = await renderStore();
    act(() => { result.current.pinMeal(oats); });
    const pin = result.current.pinned[0];
    act(() => { result.current.unpinMeal(pin.id); });
    expect(result.current.pinned).toEqual([]);
    act(() => { result.current.restorePin(pin); });
    expect(result.current.pinned).toEqual([pin]);
  });

  it('renames/edits a pin and syncs the change', async () => {
    const { result } = await renderStore();
    act(() => { result.current.pinMeal(oats); });
    const id = result.current.pinned[0].id;

    act(() => { result.current.updatePin(id, { name: 'Usual oats', calories: 250 }); });

    expect(result.current.pinned[0]).toMatchObject({ id, name: 'Usual oats', calories: 250, mealType: 'Breakfast' });
    await waitFor(() => expect(db.pinned[0]).toMatchObject({ name: 'Usual oats', calories: 250 }));
  });

  it('keeps pins on the device when the pinned_meals table has not been created', async () => {
    vi.mocked(storage.getPinnedMeals).mockResolvedValue(null);
    const { result } = await renderStore();
    expect(result.current.pinsSyncEnabled).toBe(false);
    expect(result.current.syncError).toBeNull();
    vi.mocked(storage.getPinnedMeals).mockReset();
  });
});

describe('meal photos', () => {
  const photoMeal = (id: string, daysAgo: number): MealEntry => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return { ...emptyMeal({ date: toKey(d) }), id, imageDatas: [`data:${id}`], createdAt: 1 };
  };

  it('loads meals first, then fills in photos for recent meals in the background', async () => {
    db.meals = [photoMeal('recent', 2), photoMeal('old', 90)];
    const { result } = await renderStore();

    await waitFor(() => expect(result.current.meals.find((m) => m.id === 'recent')?.imageDatas).toEqual(['data:recent']));
    expect(storage.getMealPhotos).toHaveBeenCalledWith(TEST_USER_ID, ['recent']);
    // Older photos aren't downloaded until that day is opened.
    expect(result.current.meals.find((m) => m.id === 'old')?.imageDatas).toBeUndefined();

    await act(async () => { await result.current.loadPhotos(['old']); });
    expect(result.current.meals.find((m) => m.id === 'old')?.imageDatas).toEqual(['data:old']);
  });

  it('does not download photos again on the next sync', async () => {
    db.meals = [photoMeal('recent', 1)];
    const { result } = await renderStore();
    await waitFor(() => expect(result.current.meals[0].imageDatas).toBeDefined());

    await act(async () => { await result.current.refresh(); });

    expect(storage.getMealPhotos).toHaveBeenCalledTimes(1);
    expect(result.current.meals[0].imageDatas).toEqual(['data:recent']);
  });

  it('keeps photos of a meal added on this device across a sync', async () => {
    const { result } = await renderStore();
    act(() => { result.current.addMeal(emptyMeal({ imageDatas: ['data:new'] })); });
    await act(async () => { await result.current.refresh(); });
    expect(result.current.meals[0].imageDatas).toEqual(['data:new']);
  });

  it('includes every photo in a backup export, fetching any not loaded yet', async () => {
    db.meals = [photoMeal('recent', 1), photoMeal('old', 200)];
    const { result } = await renderStore();

    let exported!: Awaited<ReturnType<typeof result.current.prepareExport>>;
    await act(async () => { exported = await result.current.prepareExport(); });

    expect(exported.missingPhotos).toBe(false);
    expect(exported.payload.meals.map((m) => m.imageDatas)).toEqual([['data:recent'], ['data:old']]);
  });

  it('reports missing photos when they cannot be fetched for an export', async () => {
    db.meals = [photoMeal('old', 200)];
    const { result } = await renderStore();
    vi.mocked(storage.getMealPhotos).mockRejectedValueOnce(new Error('offline'));

    let exported!: Awaited<ReturnType<typeof result.current.prepareExport>>;
    await act(async () => { exported = await result.current.prepareExport(); });
    expect(exported.missingPhotos).toBe(true);
  });
});

describe('before the session is confirmed', () => {
  it('shows the cache but does not touch the server until verified', async () => {
    db.meals = [{ ...emptyMeal({ calories: 321 }), id: 'cached', createdAt: 1 }];
    const first = await renderStore();
    await waitFor(() => expect(localStorage.getItem(`calorie_tracker_cache_${TEST_USER_ID}`)).not.toBeNull(), { timeout: 2000 });
    first.unmount();
    vi.clearAllMocks();

    authStatus = 'pending';
    const second = renderHook(() => useStore(), { wrapper: ({ children }) => <StoreProvider>{children}</StoreProvider> });

    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.meals.map((m) => m.id)).toEqual(['cached']);
    act(() => { second.result.current.addMeal(emptyMeal({ calories: 50 })); });
    expect(storage.getMeals).not.toHaveBeenCalled();
    expect(storage.insertMeal).not.toHaveBeenCalled();
    expect(second.result.current.pendingCount).toBe(1);

    authStatus = 'verified';
    second.rerender();
    await waitFor(() => expect(storage.insertMeal).toHaveBeenCalled());
    await waitFor(() => expect(storage.getMeals).toHaveBeenCalled());
  });
});

describe('moving inline photos to Storage', () => {
  it('uploads older inline photos in the background and points the rows at the files', async () => {
    localStorage.removeItem(`calorie_tracker_photos_migrated_${TEST_USER_ID}`);
    db.meals = [
      { ...emptyMeal(), id: 'inline', imageDatas: ['data:old-photo'], createdAt: 1 },
      { ...emptyMeal(), id: 'already', imageDatas: ['sb:u/x.jpg'], createdAt: 2 },
    ];
    await renderStore();

    await waitFor(() => expect(storage.replaceMealPhotos).toHaveBeenCalled(), { timeout: 6000 });
    expect(storage.replaceMealPhotos).toHaveBeenCalledTimes(1);
    expect(storage.replaceMealPhotos).toHaveBeenCalledWith(TEST_USER_ID, 'inline', ['sb:old-photo']);
    await waitFor(() => expect(localStorage.getItem(`calorie_tracker_photos_migrated_${TEST_USER_ID}`)).not.toBeNull());
  }, 10_000);

  it('stops on a failed upload and tries again next time', async () => {
    localStorage.removeItem(`calorie_tracker_photos_migrated_${TEST_USER_ID}`);
    db.meals = [{ ...emptyMeal(), id: 'inline', imageDatas: ['data:old-photo'], createdAt: 1 }];
    storeInlinePhotos.mockResolvedValueOnce(null as never);
    await renderStore();

    await waitFor(() => expect(storeInlinePhotos).toHaveBeenCalled(), { timeout: 6000 });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(storage.replaceMealPhotos).not.toHaveBeenCalled();
    expect(localStorage.getItem(`calorie_tracker_photos_migrated_${TEST_USER_ID}`)).toBeNull();
  }, 10_000);
});

describe('backup export with stored photos', () => {
  it('embeds stored photos back into the file as data URLs, like before', async () => {
    db.meals = [{ ...emptyMeal(), id: 'm', imageDatas: ['sb:jpeg-bytes'], createdAt: 1 }];
    const { result } = await renderStore();

    let exported!: Awaited<ReturnType<typeof result.current.prepareExport>>;
    await act(async () => { exported = await result.current.prepareExport(); });

    expect(exported.payload.meals[0].imageDatas).toEqual(['data:jpeg-bytes']);
    expect(exported.missingPhotos).toBe(false);
  });

  it('flags photos that could not be downloaded', async () => {
    db.meals = [{ ...emptyMeal(), id: 'm', imageDatas: ['sb:jpeg-bytes'], createdAt: 1 }];
    const { result } = await renderStore();
    photoToDataUrl.mockResolvedValueOnce(null as never);

    let exported!: Awaited<ReturnType<typeof result.current.prepareExport>>;
    await act(async () => { exported = await result.current.prepareExport(); });
    expect(exported.missingPhotos).toBe(true);
  });
});
