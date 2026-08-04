import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MealEntry, WeightEntry, Settings, Profile } from '@/types';

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

// Imported after the mock so `storage` picks up the mocked client.
const { storage } = await import('@/lib/storage');
const { supabase } = await import('@/lib/supabaseClient');

type Result = { data?: unknown; error?: unknown };

/** A chainable node that is itself thenable, so `await x.eq(...).eq(...)` resolves. */
function chainable(result: Result) {
  const node: {
    then: (resolve: (v: Result) => void, reject?: (e: unknown) => void) => Promise<unknown>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  } = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    eq: vi.fn(() => node),
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
});

describe('getMeals', () => {
  it('queries the meals table filtered by user and mapped from snake_case rows', async () => {
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
    expect(from.select).toHaveBeenCalledWith('*');
    expect(from.node.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(from.node.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual([{
      id: 'm1', date: '2026-01-01', mealType: 'Lunch', items: [], calories: 300,
      protein: 10, carbs: 20, fat: 5, fiber: 2, reasoning: 'test', imageData: undefined, imageDatas: undefined, createdAt: 5,
    }]);
  });

  it('returns an empty array and logs on error', async () => {
    const { from } = makeFrom({ data: null, error: { message: 'boom' } });
    vi.mocked(supabase.from).mockReturnValue(from as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await storage.getMeals(USER_ID)).toEqual([]);
    spy.mockRestore();
  });
});

describe('insertMeal / updateMeal / deleteMeal', () => {
  it('inserts a row mapped to snake_case for the given user', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    const ok = await storage.insertMeal(USER_ID, meal('m1'));

    expect(ok).toBe(true);
    expect(from.insert).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1', user_id: USER_ID, meal_type: 'Breakfast' }));
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

    expect(await storage.insertMeal(USER_ID, meal('m1'))).toBe(false);
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
});

describe('importBackup', () => {
  it('replaces meals/weights and upserts settings/profile for the user', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    await storage.importBackup(USER_ID, {
      version: 1,
      exportedAt: new Date().toISOString(),
      meals: [meal('m1')],
      weights: [weight],
      settings: { calorieGoal: 1900, goalWeight: 65, weeklyWeightTarget: -0.4, weightUnit: 'lb', geminiApiKey: '' },
      profile: { name: 'Imported' },
    });

    expect(supabase.from).toHaveBeenCalledWith('meals');
    expect(supabase.from).toHaveBeenCalledWith('weights');
    expect(supabase.from).toHaveBeenCalledWith('settings');
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(from.insert).toHaveBeenCalledWith([expect.objectContaining({ id: 'm1', user_id: USER_ID })]);
    expect(from.insert).toHaveBeenCalledWith([expect.objectContaining({ date: '2026-01-01', user_id: USER_ID })]);
    expect(from.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: USER_ID, calorie_goal: 1900 }), { onConflict: 'user_id' });
    expect(from.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: USER_ID, name: 'Imported' }), { onConflict: 'user_id' });
  });
});

describe('clearAll', () => {
  it('deletes rows from all four tables for the user', async () => {
    const { from } = makeFrom({ error: null });
    vi.mocked(supabase.from).mockReturnValue(from as never);

    await storage.clearAll(USER_ID);

    expect(supabase.from).toHaveBeenCalledWith('meals');
    expect(supabase.from).toHaveBeenCalledWith('weights');
    expect(supabase.from).toHaveBeenCalledWith('settings');
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(from.delete).toHaveBeenCalledTimes(4);
    expect(from.node.eq).toHaveBeenCalledWith('user_id', USER_ID);
  });
});
