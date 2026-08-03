import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '@/lib/storage';
import type { MealEntry, Settings, WeightEntry } from '@/types';

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
  localStorage.clear();
});

describe('meals', () => {
  it('defaults to an empty array', () => {
    expect(storage.getMeals()).toEqual([]);
  });

  it('round-trips through set/get', () => {
    storage.setMeals([meal('1'), meal('2')]);
    expect(storage.getMeals()).toEqual([meal('1'), meal('2')]);
  });

  it('falls back to the default on corrupted JSON', () => {
    localStorage.setItem('calorie_tracker_meals', '{not valid json');
    expect(storage.getMeals()).toEqual([]);
  });

  it('writes under the dedicated calorie_tracker_meals key', () => {
    storage.setMeals([meal('1')]);
    expect(JSON.parse(localStorage.getItem('calorie_tracker_meals')!)).toEqual([meal('1')]);
  });

  it('migrates data from the legacy cc_meals key once, on first read', () => {
    localStorage.setItem('cc_meals', JSON.stringify([meal('legacy')]));
    expect(storage.getMeals()).toEqual([meal('legacy')]);
    // Migration should have copied it to the new key too.
    expect(JSON.parse(localStorage.getItem('calorie_tracker_meals')!)).toEqual([meal('legacy')]);
  });

  it('prefers the new key over the legacy key when both are present', () => {
    localStorage.setItem('cc_meals', JSON.stringify([meal('legacy')]));
    localStorage.setItem('calorie_tracker_meals', JSON.stringify([meal('current')]));
    expect(storage.getMeals()).toEqual([meal('current')]);
  });
});

describe('weights', () => {
  it('defaults to an empty array', () => {
    expect(storage.getWeights()).toEqual([]);
  });

  it('round-trips through set/get', () => {
    storage.setWeights([weight]);
    expect(storage.getWeights()).toEqual([weight]);
  });

  it('writes under the dedicated calorie_tracker_weights key', () => {
    storage.setWeights([weight]);
    expect(JSON.parse(localStorage.getItem('calorie_tracker_weights')!)).toEqual([weight]);
  });

  it('migrates data from the legacy cc_weights key once, on first read', () => {
    localStorage.setItem('cc_weights', JSON.stringify([weight]));
    expect(storage.getWeights()).toEqual([weight]);
    expect(JSON.parse(localStorage.getItem('calorie_tracker_weights')!)).toEqual([weight]);
  });
});

describe('settings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(storage.getSettings()).toEqual({
      calorieGoal: 2200,
      goalWeight: 75,
      weeklyWeightTarget: -0.3,
      weightUnit: 'kg',
      geminiApiKey: '',
    });
  });

  it('merges a partial saved settings object over the defaults', () => {
    localStorage.setItem('cc_settings', JSON.stringify({ calorieGoal: 1800 }));
    const settings = storage.getSettings();
    expect(settings.calorieGoal).toBe(1800);
    expect(settings.weightUnit).toBe('kg');
  });

  it('persists a full settings object via setSettings', () => {
    const custom: Settings = {
      calorieGoal: 2000,
      goalWeight: 70,
      weeklyWeightTarget: -0.5,
      weightUnit: 'lb',
      geminiApiKey: 'abc123',
    };
    storage.setSettings(custom);
    expect(storage.getSettings()).toEqual(custom);
  });

  it('falls back to defaults on corrupted JSON', () => {
    localStorage.setItem('cc_settings', 'not json');
    expect(storage.getSettings().calorieGoal).toBe(2200);
  });
});

describe('profile', () => {
  it('returns defaults when nothing is stored', () => {
    expect(storage.getProfile()).toEqual({ name: '' });
  });

  it('merges partial saved profile over defaults', () => {
    localStorage.setItem('cc_profile', JSON.stringify({ name: 'Alex' }));
    expect(storage.getProfile()).toEqual({ name: 'Alex' });
  });
});

describe('exportBackup / importBackup', () => {
  it('exports the current state with a version and timestamp', () => {
    storage.setMeals([meal('1')]);
    storage.setWeights([weight]);
    const backup = storage.exportBackup();
    expect(backup.version).toBe(1);
    expect(typeof backup.exportedAt).toBe('string');
    expect(backup.meals).toEqual([meal('1')]);
    expect(backup.weights).toEqual([weight]);
  });

  it('restores meals, weights, settings, and profile from a backup payload', () => {
    storage.importBackup({
      version: 1,
      exportedAt: new Date().toISOString(),
      meals: [meal('imported')],
      weights: [weight],
      settings: { calorieGoal: 1900, goalWeight: 65, weeklyWeightTarget: -0.4, weightUnit: 'lb', geminiApiKey: '' },
      profile: { name: 'Imported' },
    });
    expect(storage.getMeals()).toEqual([meal('imported')]);
    expect(storage.getWeights()).toEqual([weight]);
    expect(storage.getSettings().calorieGoal).toBe(1900);
    expect(storage.getProfile()).toEqual({ name: 'Imported' });
  });

  it('falls back to defaults for missing fields in the backup payload', () => {
    storage.importBackup({
      version: 1,
      exportedAt: new Date().toISOString(),
      meals: [],
      weights: [],
      settings: {} as Settings,
    });
    expect(storage.getSettings().calorieGoal).toBe(2200);
    expect(storage.getProfile()).toEqual({ name: '' });
  });
});

describe('clearAll', () => {
  it('removes all stored keys', () => {
    storage.setMeals([meal('1')]);
    storage.setWeights([weight]);
    storage.setSettings({ calorieGoal: 1900, goalWeight: 65, weeklyWeightTarget: -0.4, weightUnit: 'lb', geminiApiKey: 'k' });
    storage.setProfile({ name: 'Alex' });

    storage.clearAll();

    expect(storage.getMeals()).toEqual([]);
    expect(storage.getWeights()).toEqual([]);
    expect(storage.getSettings().calorieGoal).toBe(2200);
    expect(storage.getProfile()).toEqual({ name: '' });
  });

  it('also purges the legacy meals/weights keys so they cannot be re-migrated', () => {
    localStorage.setItem('cc_meals', JSON.stringify([meal('legacy')]));
    localStorage.setItem('cc_weights', JSON.stringify([weight]));

    storage.clearAll();

    expect(localStorage.getItem('cc_meals')).toBeNull();
    expect(localStorage.getItem('cc_weights')).toBeNull();
    expect(storage.getMeals()).toEqual([]);
    expect(storage.getWeights()).toEqual([]);
  });
});

describe('write error handling', () => {
  it('does not throw when localStorage.setItem fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => storage.setMeals([meal('1')])).not.toThrow();
    spy.mockRestore();
  });
});
