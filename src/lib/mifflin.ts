export type Sex = 'male' | 'female';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'extra';

export type WeightGoal = 'lose' | 'maintain' | 'gain';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  extra: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little or no exercise)',
  light: 'Light (exercise 1-3 days/week)',
  moderate: 'Moderate (exercise 3-5 days/week)',
  active: 'Active (exercise 6-7 days/week)',
  extra: 'Extra Active (intense daily exercise)',
};

const LB_TO_KG = 1 / 2.20462262;
const IN_TO_CM = 2.54;

export type HeightUnit = 'cm' | 'in';
export type InputWeightUnit = 'kg' | 'lb';

export interface CalcInput {
  age: number;
  sex: Sex;
  height: number; // in heightUnit
  heightUnit: HeightUnit;
  weight: number; // in weightUnit
  weightUnit: InputWeightUnit;
  activity: ActivityLevel;
  goal: WeightGoal;
}

export interface CalcResult {
  bmr: number;
  tdee: number;
  targetCalories: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
  weeklyWeightKg: number; // signed: negative for loss, positive for gain
  goalWeightKg: number; // optional target weight, same as current if maintain
}

export function cmFromInput(value: number, unit: HeightUnit): number {
  return unit === 'in' ? value * IN_TO_CM : value;
}

export function kgFromInput(value: number, unit: InputWeightUnit): number {
  return unit === 'lb' ? value * LB_TO_KG : value;
}

export function calcBmr(sex: Sex, age: number, weightKg: number, heightCm: number): number {
  // Mifflin-St Jeor
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

export function calcTdee(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_FACTORS[activity]);
}

export function calculateTargets(input: CalcInput): CalcResult {
  const weightKg = kgFromInput(input.weight, input.weightUnit);
  const heightCm = cmFromInput(input.height, input.heightUnit);
  const bmr = calcBmr(input.sex, input.age, weightKg, heightCm);
  const tdee = calcTdee(bmr, input.activity);

  // ~7700 kcal per kg of body fat. 0.45 kg/week (~1 lb) = ~3500 kcal/week = 500 kcal/day.
  let weeklyWeightKg = 0;
  let targetCalories = tdee;

  if (input.goal === 'lose') {
    weeklyWeightKg = -0.45;
    targetCalories = tdee - 500;
  } else if (input.goal === 'gain') {
    weeklyWeightKg = 0.3;
    targetCalories = tdee + 300;
  }

  targetCalories = Math.max(targetCalories, 1200);

  // Macro split: protein 1.6g/kg, fat 25% of calories, remainder carbs.
  const protein = Math.round(weightKg * 1.6);
  const fat = Math.round((targetCalories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((targetCalories - protein * 4 - fat * 9) / 4));

  return {
    bmr,
    tdee,
    targetCalories,
    protein,
    carbs,
    fat,
    weeklyWeightKg,
    goalWeightKg: weightKg,
  };
}
