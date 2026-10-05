import { describe, expect, it } from 'vitest';
import { calorieGoalOn, goalVaries, phaseOn, proteinTarget, weeklyTargetOn } from '@/lib/goalPlan';
import type { Settings } from '@/types';

const base: Settings = { calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: -0.4, weightUnit: 'kg', geminiApiKey: '' };
const withPrefs = (prefs: Settings['prefs']): Settings => ({ ...base, prefs });

describe('goal plan', () => {
  it('uses the base goal with no plan', () => {
    expect(calorieGoalOn(base, '2026-10-05')).toBe(2000);
    expect(goalVaries(base)).toBe(false);
  });

  it('switches phases on their start dates', () => {
    const s = withPrefs({
      phases: [
        { id: 'b', name: 'Maintain', start: '2026-11-01', calorieGoal: 2400, weeklyWeightTarget: 0 },
        { id: 'a', name: 'Cut', start: '2026-09-01', calorieGoal: 1800, weeklyWeightTarget: -0.5 },
      ],
    });
    expect(calorieGoalOn(s, '2026-08-31')).toBe(2000); // before any phase
    expect(phaseOn(s, '2026-10-15')?.name).toBe('Cut');
    expect(calorieGoalOn(s, '2026-10-15')).toBe(1800);
    expect(weeklyTargetOn(s, '2026-10-15')).toBe(-0.5);
    expect(calorieGoalOn(s, '2026-11-01')).toBe(2400);
    expect(weeklyTargetOn(s, '2026-12-01')).toBe(0);
    expect(goalVaries(s)).toBe(true);
  });

  it('adds weekday adjustments on top', () => {
    // Sunday first: +300 on Saturdays, −100 on Mondays.
    const s = withPrefs({ weekdayOffsets: [0, -100, 0, 0, 0, 0, 300] });
    expect(calorieGoalOn(s, '2026-10-03')).toBe(2300); // a Saturday
    expect(calorieGoalOn(s, '2026-10-05')).toBe(1900); // a Monday
    expect(calorieGoalOn(s, '2026-10-06')).toBe(2000);
  });

  it('never goes below a safe floor', () => {
    expect(calorieGoalOn(withPrefs({ weekdayOffsets: [-5000, 0, 0, 0, 0, 0, 0] }), '2026-10-04')).toBe(800);
  });

  it('works out protein per kg of body weight', () => {
    const s = withPrefs({ proteinPerKg: 1.8 });
    expect(proteinTarget(s, 80)).toBe(144);
    expect(proteinTarget(s, null)).toBeNull(); // no weigh-in, no fixed target
    expect(proteinTarget(base, 80)).toBeNull();
  });
});
