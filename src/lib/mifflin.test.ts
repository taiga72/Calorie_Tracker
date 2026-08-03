import { describe, it, expect } from 'vitest';
import {
  cmFromInput,
  kgFromInput,
  calcBmr,
  calcTdee,
  getDeficitPreset,
  calculateTargets,
  ACTIVITY_FACTORS,
  type CalcInput,
} from '@/lib/mifflin';

describe('cmFromInput', () => {
  it('passes cm through unchanged', () => {
    expect(cmFromInput(180, 'cm')).toBe(180);
  });

  it('converts inches to cm', () => {
    expect(cmFromInput(70, 'in')).toBeCloseTo(177.8, 5);
  });
});

describe('kgFromInput', () => {
  it('passes kg through unchanged', () => {
    expect(kgFromInput(80, 'kg')).toBe(80);
  });

  it('converts lb to kg', () => {
    expect(kgFromInput(220.462262, 'lb')).toBeCloseTo(100, 5);
  });
});

describe('calcBmr', () => {
  it('adds 5 for male per Mifflin-St Jeor', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(calcBmr('male', 30, 80, 180)).toBe(1780);
  });

  it('subtracts 161 for female per Mifflin-St Jeor', () => {
    // 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25 -> rounds to 1345
    expect(calcBmr('female', 25, 60, 165)).toBe(1345);
  });

  it('rounds to the nearest integer', () => {
    const bmr = calcBmr('male', 29, 70.3, 174.2);
    expect(Number.isInteger(bmr)).toBe(true);
  });
});

describe('calcTdee', () => {
  it('multiplies BMR by the activity factor and rounds', () => {
    expect(calcTdee(1500, 'sedentary')).toBe(Math.round(1500 * ACTIVITY_FACTORS.sedentary));
    expect(calcTdee(1500, 'extra')).toBe(Math.round(1500 * ACTIVITY_FACTORS.extra));
  });
});

describe('getDeficitPreset', () => {
  it('returns the matching preset', () => {
    expect(getDeficitPreset('mild').kcal).toBe(250);
    expect(getDeficitPreset('moderate').kcal).toBe(500);
    expect(getDeficitPreset('aggressive').kcal).toBe(750);
  });
});

function baseInput(overrides: Partial<CalcInput> = {}): CalcInput {
  return {
    age: 30,
    sex: 'male',
    height: 180,
    heightUnit: 'cm',
    weight: 90,
    weightUnit: 'kg',
    goalWeight: 80,
    activity: 'moderate',
    deficit: 'moderate',
    ...overrides,
  };
}

describe('calculateTargets', () => {
  it('applies a deficit and negative weekly rate when the goal is a loss', () => {
    const result = calculateTargets(baseInput({ weight: 90, goalWeight: 80 }));
    expect(result.deficit).toBe(500);
    expect(result.weeklyWeightKg).toBeLessThan(0);
    expect(result.targetCalories).toBe(result.tdee - 500);
    expect(result.weeksToGoal).not.toBeNull();
    expect(result.goalDate).not.toBeNull();
  });

  it('applies a surplus and positive weekly rate when the goal is a gain', () => {
    const result = calculateTargets(baseInput({ weight: 70, goalWeight: 80 }));
    expect(result.deficit).toBe(-500);
    expect(result.weeklyWeightKg).toBeGreaterThan(0);
    expect(result.targetCalories).toBe(result.tdee + 500);
  });

  it('falls back to maintenance with zero deficit when goal equals current weight', () => {
    const result = calculateTargets(baseInput({ weight: 80, goalWeight: 80 }));
    expect(result.deficit).toBe(0);
    expect(result.weeklyWeightKg).toBe(0);
    expect(result.targetCalories).toBe(result.tdee);
    expect(result.weeksToGoal).toBeNull();
    expect(result.goalDate).toBeNull();
  });

  it('treats goal weights within 0.01kg of current as "no goal" (skips weeksToGoal)', () => {
    const result = calculateTargets(baseInput({ weight: 80, goalWeight: 80.005 }));
    expect(result.weeksToGoal).toBeNull();
    expect(result.goalDate).toBeNull();
  });

  it('never lets target calories fall below the sex-specific floor', () => {
    // Small, old, sedentary female with an aggressive deficit should hit the 1000 kcal floor.
    const result = calculateTargets(
      baseInput({ sex: 'female', age: 70, height: 150, weight: 45, goalWeight: 40, activity: 'sedentary', deficit: 'aggressive' })
    );
    expect(result.targetCalories).toBeGreaterThanOrEqual(1000);
  });

  it('applies the male floor of 1200 kcal', () => {
    const result = calculateTargets(
      baseInput({ sex: 'male', age: 70, height: 160, weight: 55, goalWeight: 45, activity: 'sedentary', deficit: 'aggressive' })
    );
    expect(result.targetCalories).toBeGreaterThanOrEqual(1200);
  });

  it('computes macros that are consistent with target calories', () => {
    const result = calculateTargets(baseInput());
    expect(result.protein).toBe(Math.round(result.currentWeightKg * 1.6));
    expect(result.fat).toBe(Math.round((result.targetCalories * 0.25) / 9));
    expect(result.carbs).toBeGreaterThanOrEqual(0);
  });

  it('never returns negative carbs even under an aggressive low-calorie clamp', () => {
    const result = calculateTargets(
      baseInput({ sex: 'female', age: 80, height: 145, weight: 40, goalWeight: 38, activity: 'sedentary', deficit: 'aggressive' })
    );
    expect(result.carbs).toBeGreaterThanOrEqual(0);
  });

  it('produces a meal split that sums close to target calories', () => {
    const result = calculateTargets(baseInput());
    const { breakfast, lunch, dinner, snack } = result.mealSplit;
    const total = breakfast + lunch + dinner + snack;
    expect(total).toBeGreaterThanOrEqual(result.targetCalories - 2);
    expect(total).toBeLessThanOrEqual(result.targetCalories + 2);
  });

  it('converts imperial inputs to metric before computing BMR', () => {
    const metric = calculateTargets(baseInput({ height: 180, heightUnit: 'cm', weight: 80, weightUnit: 'kg', goalWeight: 75 }));
    const imperial = calculateTargets(
      baseInput({ height: 70.8661, heightUnit: 'in', weight: 176.37, weightUnit: 'lb', goalWeight: 165.35 })
    );
    expect(imperial.bmr).toBe(metric.bmr);
  });

  it('estimates weeksToGoal as the ceiling of total delta over weekly rate', () => {
    const result = calculateTargets(baseInput({ weight: 90, goalWeight: 85.5, deficit: 'moderate' }));
    // weeklyKg for moderate = 0.45, delta = 4.5kg -> exactly 10 weeks
    expect(result.weeksToGoal).toBe(10);
  });
});
