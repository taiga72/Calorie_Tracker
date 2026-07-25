export type Sex = 'male' | 'female';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'extra';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  extra: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly Active',
  moderate: 'Moderately Active',
  active: 'Very Active',
  extra: 'Extremely Active',
};

export const ACTIVITY_SUBS: Record<ActivityLevel, string> = {
  sedentary: 'Little or no exercise',
  light: 'Exercise 1-3 days/week',
  moderate: 'Exercise 3-5 days/week',
  active: 'Exercise 6-7 days/week',
  extra: 'Intense daily exercise',
};

export type DeficitLevel = 'mild' | 'moderate' | 'aggressive';

export const DEFICIT_PRESETS: { key: DeficitLevel; label: string; sub: string; kcal: number; weeklyKg: number; weeklyLb: number }[] = [
  { key: 'mild', label: 'Mild', sub: 'Slow & sustainable', kcal: 250, weeklyKg: 0.23, weeklyLb: 0.5 },
  { key: 'moderate', label: 'Moderate', sub: 'Balanced progress', kcal: 500, weeklyKg: 0.45, weeklyLb: 1 },
  { key: 'aggressive', label: 'Aggressive', sub: 'Faster results', kcal: 750, weeklyKg: 0.68, weeklyLb: 1.5 },
];

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
  goalWeight: number; // in weightUnit
  activity: ActivityLevel;
  deficit: DeficitLevel;
}

export interface MealSplit {
  breakfast: number;
  lunch: number;
  dinner: number;
  snack: number;
}

export interface CalcResult {
  bmr: number;
  tdee: number;
  deficit: number; // kcal reduction (positive number)
  targetCalories: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
  weeklyWeightKg: number; // signed: negative for loss, positive for gain
  goalWeightKg: number;
  currentWeightKg: number;
  weeksToGoal: number | null;
  goalDate: Date | null;
  mealSplit: MealSplit;
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

export function getDeficitPreset(level: DeficitLevel) {
  return DEFICIT_PRESETS.find((d) => d.key === level)!;
}

export function calculateTargets(input: CalcInput): CalcResult {
  const currentWeightKg = kgFromInput(input.weight, input.weightUnit);
  const goalWeightKg = kgFromInput(input.goalWeight, input.weightUnit);
  const heightCm = cmFromInput(input.height, input.heightUnit);
  const bmr = calcBmr(input.sex, input.age, currentWeightKg, heightCm);
  const tdee = calcTdee(bmr, input.activity);

  const preset = getDeficitPreset(input.deficit);
  const losing = goalWeightKg < currentWeightKg;
  const gaining = goalWeightKg > currentWeightKg;

  // Deficit only applies when losing. For maintain/gain, fall back to maintenance/surplus.
  let deficit = 0;
  let weeklyWeightKg = 0;
  let targetCalories = tdee;

  if (losing) {
    deficit = preset.kcal;
    weeklyWeightKg = -preset.weeklyKg;
    targetCalories = tdee - deficit;
  } else if (gaining) {
    // Gentle surplus mirroring the chosen intensity.
    deficit = -preset.kcal;
    weeklyWeightKg = preset.weeklyKg;
    targetCalories = tdee + preset.kcal;
  }

  targetCalories = Math.max(targetCalories, input.sex === 'male' ? 1200 : 1000);

  // Macro split: protein 1.6g/kg, fat 25% of calories, remainder carbs.
  const protein = Math.round(currentWeightKg * 1.6);
  const fat = Math.round((targetCalories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((targetCalories - protein * 4 - fat * 9) / 4));

  // Weeks to goal and estimated goal date.
  const totalDeltaKg = Math.abs(goalWeightKg - currentWeightKg);
  const weeklyRate = Math.abs(weeklyWeightKg);
  let weeksToGoal: number | null = null;
  let goalDate: Date | null = null;
  if (weeklyRate > 0 && totalDeltaKg > 0.01) {
    weeksToGoal = Math.ceil(totalDeltaKg / weeklyRate);
    goalDate = new Date();
    goalDate.setDate(goalDate.getDate() + weeksToGoal * 7);
  }

  // Meal calorie split (percentages).
  const split: MealSplit = {
    breakfast: Math.round(targetCalories * 0.25),
    lunch: Math.round(targetCalories * 0.3),
    dinner: Math.round(targetCalories * 0.3),
    snack: Math.round(targetCalories * 0.15),
  };

  return {
    bmr,
    tdee,
    deficit,
    targetCalories,
    protein,
    carbs,
    fat,
    weeklyWeightKg,
    goalWeightKg,
    currentWeightKg,
    weeksToGoal,
    goalDate,
    mealSplit: split,
  };
}
