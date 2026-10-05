import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MealEntry, WeightEntry, Settings, Profile } from '@/types';

const bucket = {
  upload: vi.fn(async (): Promise<{ error: unknown }> => ({ error: null })),
  list: vi.fn(async (): Promise<{ data: { name: string }[] | null; error: unknown }> => ({ data: [], error: null })),
  remove: vi.fn(async () => ({ error: null })),
  createSignedUrls: vi.fn(),
};

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: vi.fn(), storage: { from: () => bucket } },
}));

// Imported after the mock so `storage` picks up the mocked client.
const { storage } = await import('@/lib/storage');
const { supabase } = await import('@/lib/supabaseClient');
const { resetPhotoStorageState } = await import('@/lib/photoStorage');
const { resetPrefsColumnState } = await import('@/lib/storage');

type Result = { data?: unknown; error?: unknown; status?: number };

/** A chainable node that is itself thenable, so `await x.eq(...).eq(...)` resolves. */
function chainable(result: Result) {
  const node: {
    then: (resolve: (v: Result) => void, reject?: (e: unknown) => void) => Promise<unknown>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  } = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    eq: vi.fn(() => node),
    in: vi.fn(() => node),
    or: vi.fn(() => node),
    order: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return node;
}

function makeFrom(result: Result) {
  const node = chainable(result);
  return {
    from: {
      node,
      select: vi.fn(() => node),
      insert: vi.fn(() => Promise.resolve(result)),
      update: vi.fn(() => node),
      delete: vi.fn(() => node),
      upsert: vi.fn(() => Promise.resolve(result)),
    },
  };
}

const USER_ID = 'user-123';

function meal(id: string): MealEntry {
  return {
    id,
    date: '2026-01-01',
    mealType: 'Breakfast',
    items: [],
    calories: 100,
    protein: 1,
    carbs: 1,
    fat: 1,
    fiber: 1,
    reasoning: '',
    createdAt: 1,
  };
}

const weight: WeightEntry = { date: '2026-01-01', weight: 70, createdAt: 1 };

beforeEach(() => {
  vi.mocked(supabase.from).mockReset();
  bucket.upload.mockReset().mockResolvedValue({ error: null });
  bucket.list.mockReset().mockResolvedValue({ data: [], error: null });
  bucket.remove.mockClear();
  resetPhotoStorageState();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Runs an operation that retries on failure without the test waiting out the real backoff delays. */
async function runWithFakeTimers<T>(operation: () => Promise<T>): Promise<T> {
  vi.useFakeTimers();
  const promise = operation();
  // Mark as handled so Node doesn't report it as an unhandled rejection while
  // we advance the fake timers below; the caller still awaits the real result.
  promise.catch(() => {});
  await vi.runAllTimersAsync();
  return promise;
}

describe('retrying transient failures', () => {
  it('retries a failed read and returns the data once a later attempt succeeds', async () => {
    const failing = makeFrom({ data: null, error: { message: 'network blip' } });
    const succeeding = makeFrom({
      data: [{
        id: 'm1', date: '2026-01-01', meal_type: 'Lunch', items: [], calories: 300,
        protein: 10, carbs: 20, fat: 5, fiber: 2, reasoning: '', image_data: null, image_datas: null, created_at: 5,
      }],
      error: null,
    });
    vi.mocked(supabase.from)
      .mockReturnValueOnce(failing.from as never)
      .mockReturnValueOnce(succeeding.from as never);

    const result = await runWithFakeTimers(() => storage.getMeals(USER_ID));

    expect(supabase.from).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m1');
  });

  it('gives up after a bounded number of attempts rather than retrying forever', async () => {
    const { from } = makeFrom({ error: { message: 'boom' } });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ok = await runWithFakeTimers(() => storage.insertMeal(USER_ID, meal('m1')));

    expect(ok).toBe(false);
    expect(supabase.from).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });
});

describe('not retrying permanent errors', () => {
  it('gives up immediately on a 4xx, which would fail the same way again', async () => {
    const { from } = makeFrom({ error: { code: 'PGRST205', message: 'missing' }, status: 404 });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    expect(await storage.getPinnedMeals(USER_ID)).toBeNull();
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('still retries server errors', async () => {
    const { from } = makeFrom({ error: { message: 'unavailable' }, status: 503 });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await runWithFakeTimers(() => storage.upsertWeight(USER_ID, weight));
    expect(supabase.from).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });
});

describe('getMealPhotos', () => {
  it('fetches only the photo columns for the given meals, in batches', async () => {
    const { from } = makeFrom({ data: [{ id: 'm1', image_data: null, image_datas: ['data:x'] }], error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    const ids = Array.from({ length: 45 }, (_, i) => `m${i}`);

    const photos = await storage.getMealPhotos(USER_ID, ids);

    expect(from.select).toHaveBeenCalledWith('id,image_data,image_datas');
    expect(from.node.in).toHaveBeenCalledTimes(2);
    expect(from.node.in).toHaveBeenNthCalledWith(1, 'id', ids.slice(0, 40));
    expect(from.node.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(photos[0]).toEqual({ id: 'm1', imageData: undefined, imageDatas: ['data:x'] });
  });
});

describe('getMeals', () => {
  it('queries the meals table (without the heavy photo columns) filtered by user and mapped from snake_case rows', async () => {
    const { from } = makeFrom({
      data: [{
        id: 'm1', date: '2026-01-01', meal_type: 'Lunch', items: [], calories: 300,
        protein: 10, carbs: 20, fat: 5, fiber: 2, reasoning: 'test', image_data: null, image_datas: null, created_at: 5,
      }],
      error: null,
    });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    const result = await storage.getMeals(USER_ID);

    expect(supabase.from).toHaveBeenCalledWith('meals');
    expect(from.select).toHaveBeenCalledWith('id,date,meal_type,items,calories,protein,carbs,fat,fiber,reasoning,created_at');
    expect(from.node.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(from.node.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual([{
      id: 'm1', date: '2026-01-01', mealType: 'Lunch', items: [], calories: 300,
      protein: 10, carbs: 20, fat: 5, fiber: 2, reasoning: 'test', imageData: undefined, imageDatas: undefined, createdAt: 5,
    }]);
  });

  it('throws and logs on error, rather than silently returning an empty array', async () => {
    const { from } = makeFrom({ data: null, error: { message: 'boom' } });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(runWithFakeTimers(() => storage.getMeals(USER_ID))).rejects.toBeTruthy();
    expect(spy).toHaveBeenCalledWith('Failed to load meals', { message: 'boom' });
    spy.mockRestore();
  });
});

describe('insertMeal / updateMeal / deleteMeal', () => {
  it('writes a row mapped to snake_case for the given user, idempotently by id', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    const ok = await storage.insertMeal(USER_ID, meal('m1'));

    expect(ok).toBe(true);
    // An upsert, so replaying a queued offline insert that already landed can't fail.
    expect(from.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm1', user_id: USER_ID, meal_type: 'Breakfast' }),
      { onConflict: 'id' },
    );
  });

  it('updates only the provided fields, scoped by user and meal id', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    const ok = await storage.updateMeal(USER_ID, 'm1', { calories: 250 });

    expect(ok).toBe(true);
    expect(from.update).toHaveBeenCalledWith({ calories: 250 });
    expect(from.node.eq).toHaveBeenNthCalledWith(1, 'user_id', USER_ID);
    expect(from.node.eq).toHaveBeenNthCalledWith(2, 'id', 'm1');
  });

  it('deletes scoped by user and meal id', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    const ok = await storage.deleteMeal(USER_ID, 'm1');

    expect(ok).toBe(true);
    expect(from.node.eq).toHaveBeenNthCalledWith(1, 'user_id', USER_ID);
    expect(from.node.eq).toHaveBeenNthCalledWith(2, 'id', 'm1');
  });

  it('returns false and logs when the write fails', async () => {
    const { from } = makeFrom({ error: { message: 'boom' } });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await runWithFakeTimers(() => storage.insertMeal(USER_ID, meal('m1')))).toBe(false);
    spy.mockRestore();
  });
});

describe('getWeights / upsertWeight / deleteWeight', () => {
  it('queries weights ordered by date ascending', async () => {
    const { from } = makeFrom({ data: [{ date: '2026-01-01', weight: 70, created_at: 1 }], error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    const result = await storage.getWeights(USER_ID);

    expect(supabase.from).toHaveBeenCalledWith('weights');
    expect(from.node.order).toHaveBeenCalledWith('date', { ascending: true });
    expect(result).toEqual([weight]);
  });

  it('upserts on the user_id,date conflict target', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    const ok = await storage.upsertWeight(USER_ID, weight);

    expect(ok).toBe(true);
    expect(from.upsert).toHaveBeenCalledWith(
      { user_id: USER_ID, date: '2026-01-01', weight: 70, created_at: 1 },
      { onConflict: 'user_id,date' }
    );
  });

  it('deletes scoped by user and date', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    await storage.deleteWeight(USER_ID, '2026-01-01');

    expect(from.node.eq).toHaveBeenNthCalledWith(1, 'user_id', USER_ID);
    expect(from.node.eq).toHaveBeenNthCalledWith(2, 'date', '2026-01-01');
  });

  it('throws and logs on error, rather than silently returning an empty array', async () => {
    const { from } = makeFrom({ data: null, error: { message: 'boom' } });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(runWithFakeTimers(() => storage.getWeights(USER_ID))).rejects.toBeTruthy();
    expect(spy).toHaveBeenCalledWith('Failed to load weights', { message: 'boom' });
    spy.mockRestore();
  });
});

describe('getSettings / setSettings', () => {
  it('returns defaults when no row exists', async () => {
    const { from } = makeFrom({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    const settings = await storage.getSettings(USER_ID);

    expect(settings).toEqual({
      calorieGoal: 2200, goalWeight: 75, weeklyWeightTarget: -0.3, weightUnit: 'kg', geminiApiKey: '',
    });
  });

  it('maps an existing row from snake_case', async () => {
    const { from } = makeFrom({
      data: { calorie_goal: 1800, goal_weight: 65, weekly_weight_target: -0.5, weight_unit: 'lb', gemini_api_key: 'k', calc: null },
      error: null,
    });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    const settings = await storage.getSettings(USER_ID);
    expect(settings.calorieGoal).toBe(1800);
    expect(settings.weightUnit).toBe('lb');
  });

  it('upserts settings on user_id', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    const s: Settings = { calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: -0.4, weightUnit: 'kg', geminiApiKey: '' };

    await storage.setSettings(USER_ID, s);

    expect(from.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: USER_ID, calorie_goal: 2000 }), { onConflict: 'user_id' });
  });

  it('saves and loads personalization in the prefs column', async () => {
    resetPrefsColumnState();
    const prefs = { calendarCell: 'calories' as const, coachMemory: ['I train Mon/Wed/Fri'] };
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    await storage.setSettings(USER_ID, { calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: 0, weightUnit: 'kg', geminiApiKey: '', prefs });
    expect(from.upsert).toHaveBeenCalledWith(expect.objectContaining({ prefs }), { onConflict: 'user_id' });

    const loaded = makeFrom({ data: { calorie_goal: 2000, goal_weight: 70, weekly_weight_target: 0, weight_unit: 'kg', gemini_api_key: '', calc: null, prefs }, error: null });
    vi.mocked(supabase.from).mockReturnValue(loaded.from as never);
    expect((await storage.getSettings(USER_ID)).prefs).toEqual(prefs);
    expect(storage.prefsSyncAvailable()).toBe(true);
  });

  it('still saves settings when the prefs column is missing, without it', async () => {
    resetPrefsColumnState();
    const missing = { status: 400, error: { code: 'PGRST204', message: "Could not find the 'prefs' column of 'settings' in the schema cache" } };
    const upsert = vi.fn()
      .mockImplementationOnce(() => Promise.resolve(missing))
      .mockImplementation(() => Promise.resolve({ error: null }));
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ok = await storage.setSettings(USER_ID, { calorieGoal: 1900, goalWeight: 70, weeklyWeightTarget: 0, weightUnit: 'kg', geminiApiKey: '', prefs: { showStreak: false } });

    expect(ok).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1][0]).not.toHaveProperty('prefs');
    expect(upsert.mock.calls[1][0]).toMatchObject({ calorie_goal: 1900 });
    expect(storage.prefsSyncAvailable()).toBe(false);
    spy.mockRestore();
    resetPrefsColumnState();
  });

  it('throws and logs on error, rather than silently returning defaults', async () => {
    const { from } = makeFrom({ data: null, error: { message: 'boom' } });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(runWithFakeTimers(() => storage.getSettings(USER_ID))).rejects.toBeTruthy();
    expect(spy).toHaveBeenCalledWith('Failed to load settings', { message: 'boom' });
    spy.mockRestore();
  });
});

describe('getProfile / setProfile', () => {
  it('returns defaults when no row exists', async () => {
    const { from } = makeFrom({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    expect(await storage.getProfile(USER_ID)).toEqual({ name: '' });
  });

  it('maps an existing row', async () => {
    const { from } = makeFrom({ data: { name: 'Alex', avatar: null }, error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    expect(await storage.getProfile(USER_ID)).toEqual({ name: 'Alex', avatar: undefined });
  });

  it('upserts profile on user_id', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    const p: Profile = { name: 'Alex' };

    await storage.setProfile(USER_ID, p);

    expect(from.upsert).toHaveBeenCalledWith({ user_id: USER_ID, name: 'Alex', avatar: null }, { onConflict: 'user_id' });
  });

  it('saves and loads personalization in the prefs column', async () => {
    resetPrefsColumnState();
    const prefs = { calendarCell: 'calories' as const, coachMemory: ['I train Mon/Wed/Fri'] };
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    await storage.setSettings(USER_ID, { calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: 0, weightUnit: 'kg', geminiApiKey: '', prefs });
    expect(from.upsert).toHaveBeenCalledWith(expect.objectContaining({ prefs }), { onConflict: 'user_id' });

    const loaded = makeFrom({ data: { calorie_goal: 2000, goal_weight: 70, weekly_weight_target: 0, weight_unit: 'kg', gemini_api_key: '', calc: null, prefs }, error: null });
    vi.mocked(supabase.from).mockReturnValue(loaded.from as never);
    expect((await storage.getSettings(USER_ID)).prefs).toEqual(prefs);
    expect(storage.prefsSyncAvailable()).toBe(true);
  });

  it('still saves settings when the prefs column is missing, without it', async () => {
    resetPrefsColumnState();
    const missing = { status: 400, error: { code: 'PGRST204', message: "Could not find the 'prefs' column of 'settings' in the schema cache" } };
    const upsert = vi.fn()
      .mockImplementationOnce(() => Promise.resolve(missing))
      .mockImplementation(() => Promise.resolve({ error: null }));
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ok = await storage.setSettings(USER_ID, { calorieGoal: 1900, goalWeight: 70, weeklyWeightTarget: 0, weightUnit: 'kg', geminiApiKey: '', prefs: { showStreak: false } });

    expect(ok).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1][0]).not.toHaveProperty('prefs');
    expect(upsert.mock.calls[1][0]).toMatchObject({ calorie_goal: 1900 });
    expect(storage.prefsSyncAvailable()).toBe(false);
    spy.mockRestore();
    resetPrefsColumnState();
  });

  it('throws and logs on error, rather than silently returning defaults', async () => {
    const { from } = makeFrom({ data: null, error: { message: 'boom' } });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(runWithFakeTimers(() => storage.getProfile(USER_ID))).rejects.toBeTruthy();
    expect(spy).toHaveBeenCalledWith('Failed to load profile', { message: 'boom' });
    spy.mockRestore();
  });
});

describe('importBackup', () => {
  it('replaces meals/weights and upserts settings/profile for the user, returning true on success', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    const ok = await storage.importBackup(USER_ID, {
      version: 1,
      exportedAt: new Date().toISOString(),
      meals: [meal('m1')],
      weights: [weight],
      settings: { calorieGoal: 1900, goalWeight: 65, weeklyWeightTarget: -0.4, weightUnit: 'lb', geminiApiKey: '' },
      profile: { name: 'Imported' },
    });

    expect(ok).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('meals');
    expect(supabase.from).toHaveBeenCalledWith('weights');
    expect(supabase.from).toHaveBeenCalledWith('settings');
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(from.insert).toHaveBeenCalledWith([expect.objectContaining({ id: 'm1', user_id: USER_ID })]);
    expect(from.insert).toHaveBeenCalledWith([expect.objectContaining({ date: '2026-01-01', user_id: USER_ID })]);
    expect(from.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: USER_ID, calorie_goal: 1900 }), { onConflict: 'user_id' });
    expect(from.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: USER_ID, name: 'Imported' }), { onConflict: 'user_id' });
  });

  it('splits meals with large photos across multiple insert requests instead of one oversized payload', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    const bigMeal = (id: string): MealEntry => ({ ...meal(id), imageData: 'x'.repeat(2_000_000) });

    const ok = await storage.importBackup(USER_ID, {
      version: 1,
      exportedAt: new Date().toISOString(),
      meals: [bigMeal('m1'), bigMeal('m2')],
      weights: [],
      settings: { calorieGoal: 1900, goalWeight: 65, weeklyWeightTarget: -0.4, weightUnit: 'lb', geminiApiKey: '' },
    });

    expect(ok).toBe(true);
    const calls = from.insert.mock.calls as unknown as [Array<{ id?: string }>][];
    const mealInsertCalls = calls.filter(([rows]) => rows[0]?.id?.startsWith('m'));
    expect(mealInsertCalls.length).toBeGreaterThan(1);
    expect(mealInsertCalls.every(([rows]) => rows.length === 1)).toBe(true);
  });

  it('returns false if any sub-operation fails', async () => {
    const { from } = makeFrom({ error: { message: 'boom' } });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ok = await runWithFakeTimers(() => storage.importBackup(USER_ID, {
      version: 1,
      exportedAt: new Date().toISOString(),
      meals: [],
      weights: [],
      settings: { calorieGoal: 1900, goalWeight: 65, weeklyWeightTarget: -0.4, weightUnit: 'lb', geminiApiKey: '' },
    }));

    expect(ok).toBe(false);
    spy.mockRestore();
  });
});

describe('clearAll', () => {
  it('deletes rows from every table for the user, returning true on success', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    const ok = await storage.clearAll(USER_ID);

    expect(ok).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('meals');
    expect(supabase.from).toHaveBeenCalledWith('weights');
    expect(supabase.from).toHaveBeenCalledWith('settings');
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(supabase.from).toHaveBeenCalledWith('pinned_meals');
    expect(from.delete).toHaveBeenCalledTimes(5);
    expect(from.node.eq).toHaveBeenCalledWith('user_id', USER_ID);
  });

  it('returns false if any table fails to clear', async () => {
    const { from } = makeFrom({ error: { message: 'boom' } });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ok = await runWithFakeTimers(() => storage.clearAll(USER_ID));

    expect(ok).toBe(false);
    spy.mockRestore();
  });
});

describe('pinned meals', () => {
  const pin = {
    id: 'p1', name: 'Oat bowl', mealType: 'Breakfast' as const, items: [],
    calories: 350, protein: 12, carbs: 55, fat: 7, fiber: 8, createdAt: 5,
  };

  it('loads pins newest first, mapped from snake_case', async () => {
    const { from } = makeFrom({
      data: [{ id: 'p1', name: 'Oat bowl', meal_type: 'Breakfast', items: [], calories: 350, protein: 12, carbs: 55, fat: 7, fiber: 8, created_at: 5 }],
      error: null,
    });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    expect(await storage.getPinnedMeals(USER_ID)).toEqual([pin]);
    expect(supabase.from).toHaveBeenCalledWith('pinned_meals');
    expect(from.node.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('returns null (device-only pins) when the table has not been created yet', async () => {
    const { from } = makeFrom({ error: { code: 'PGRST205', message: 'missing' } });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    expect(await runWithFakeTimers(() => storage.getPinnedMeals(USER_ID))).toBeNull();
    expect(await runWithFakeTimers(() => storage.upsertPinnedMeal(USER_ID, pin))).toBe(true);
    expect(await runWithFakeTimers(() => storage.deletePinnedMeal(USER_ID, 'p1'))).toBe(true);
  });

  it('upserts by id and deletes scoped by user', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    expect(await storage.upsertPinnedMeal(USER_ID, pin)).toBe(true);
    expect(from.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', user_id: USER_ID, meal_type: 'Breakfast' }), { onConflict: 'id' });

    expect(await storage.deletePinnedMeal(USER_ID, 'p1')).toBe(true);
    expect(from.node.eq).toHaveBeenCalledWith('id', 'p1');
  });
});

const firstArg = (fn: { mock: { calls: unknown[][] } }) => fn.mock.calls[0][0];

describe('meal photos in Storage', () => {
  const PHOTO = 'data:image/jpeg;base64,' + btoa('fake-jpeg-bytes');
  const withPhoto = (id: string): MealEntry => ({ ...meal(id), imageDatas: [PHOTO] });

  it('uploads inline photos and saves only a reference in the row', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    expect(await storage.insertMeal(USER_ID, withPhoto('m1'))).toBe(true);

    expect(bucket.upload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${USER_ID}/.+\\.jpg$`)), expect.any(Blob), expect.objectContaining({ contentType: 'image/jpeg' }));
    const row = firstArg(from.upsert) as { image_datas: string[]; image_data: unknown };
    expect(row.image_datas).toHaveLength(1);
    expect(row.image_datas[0]).toMatch(/^sb:user-123\//);
    expect(row.image_data).toBeNull();
  });

  it('fails the save (so it is retried later) when an upload fails, e.g. offline', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    bucket.upload.mockResolvedValue({ error: { message: 'Failed to fetch' } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await storage.insertMeal(USER_ID, withPhoto('m1'))).toBe(false);
    expect(from.upsert).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('keeps photos inline, as before, when the bucket has not been created', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    bucket.upload.mockResolvedValue({ error: { message: 'Bucket not found', statusCode: '404' } });

    expect(await storage.insertMeal(USER_ID, withPhoto('m1'))).toBe(true);
    expect((firstArg(from.upsert) as { image_datas: string[] }).image_datas).toEqual([PHOTO]);
  });

  it('leaves photos that are already references untouched', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    await storage.updateMeal(USER_ID, 'm1', { imageDatas: ['sb:user-123/a.jpg'] });

    expect(bucket.upload).not.toHaveBeenCalled();
    expect(from.update).toHaveBeenCalledWith({ image_datas: ['sb:user-123/a.jpg'], image_data: null });
  });

  it('uploads photos from an imported backup, keeping any that fail inline', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    bucket.upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: 'Failed to fetch' } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await storage.importBackup(USER_ID, { version: 1, exportedAt: '', meals: [withPhoto('m1'), withPhoto('m2')], weights: [], settings: {} as Settings });

    const rows = firstArg(from.insert) as { image_datas: string[] }[];
    expect(rows[0].image_datas[0]).toMatch(/^sb:/);
    expect(rows[1].image_datas[0]).toBe(PHOTO);
    spy.mockRestore();
  });

  it('deletes the user\'s photo files when clearing all data', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    bucket.list.mockResolvedValueOnce({ data: [{ name: 'a.jpg' }, { name: 'b.jpg' }], error: null });

    expect(await storage.clearAll(USER_ID)).toBe(true);
    expect(bucket.list).toHaveBeenCalledWith(USER_ID, { limit: 100 });
    expect(bucket.remove).toHaveBeenCalledWith([`${USER_ID}/a.jpg`, `${USER_ID}/b.jpg`]);
  });
});
