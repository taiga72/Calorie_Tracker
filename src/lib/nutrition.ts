import type {
  BiologicalSex,
  ActivityLevel,
  TargetGoal,
  NutritionTargets,
} from '@/types';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little or no exercise)',
  lightly_active: 'Lightly Active (1–3 days/week)',
  moderately_active: 'Moderately Active (3–5 days/week)',
  very_active: 'Very Active (6–7 days/week)',
  extra_active: 'Extra Active (physical job + training)',
};

export const GOAL_LABELS: Record<TargetGoal, string> = {
  lose: 'Lose weight',
  maintain: 'Maintain weight',
  gain: 'Gain weight',
};

export function calculateBMR(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: BiologicalSex
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === 'male' ? base + 5 : base - 161;
}

export function calculateTargets(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: BiologicalSex,
  activity: ActivityLevel,
  goal: TargetGoal
): NutritionTargets {
  const bmr = calculateBMR(weightKg, heightCm, ageYears, sex);
  const tdee = bmr * ACTIVITY_FACTORS[activity];

  // Target weekly rate: -0.5 kg/week for loss, +0.25 kg/week for gain
  // 1 kg fat ~ 7700 kcal; per day = weekly_rate * 7700 / 7
  let targetCalories = tdee;
  if (goal === 'lose') targetCalories = tdee - (0.5 * 7700) / 7;
  if (goal === 'gain') targetCalories = tdee + (0.25 * 7700) / 7;
  targetCalories = Math.max(1200, Math.round(targetCalories));

  // Macro split: protein 30%, carbs 40%, fat 30%
  const protein = Math.round((targetCalories * 0.3) / 4);
  const carbs = Math.round((targetCalories * 0.4) / 4);
  const fat = Math.round((targetCalories * 0.3) / 9);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories,
    protein,
    carbs,
    fat,
  };
}
