export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export interface FoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface MealEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  items: FoodItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  reasoning: string;
  imageData?: string; // base64 data URL (legacy, first photo)
  imageDatas?: string[]; // base64 data URLs (multi-photo support)
  createdAt: number;
}

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  weight: number; // stored in kg
  createdAt: number;
}

export type WeightUnit = 'kg' | 'lb';

export interface MacroTargets {
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
}

export interface MealCalorieSplit {
  breakfast: number;
  lunch: number;
  dinner: number;
  snack: number;
}

export interface CalcBreakdown {
  bmr: number;
  tdee: number;
  dailyDeficit: number; // kcal reduction (negative = deficit, positive = surplus)
  estimatedGoalDate: string | null; // ISO date string
  recommendedMacros: MacroTargets;
  suggestedMealSplit: MealCalorieSplit;
}

export interface Settings {
  calorieGoal: number;
  goalWeight: number; // stored in kg
  weeklyWeightTarget: number; // stored in kg
  weightUnit: WeightUnit;
  geminiApiKey: string;
  calc?: CalcBreakdown | null;
  /** Personalization that follows the account (layout, goal plan, milestones…). */
  prefs?: Prefs;
}

// ---- Personalization (Settings.prefs)

export type HomeCardId = 'summary' | 'brief' | 'quickPins' | 'forecast' | 'milestones' | 'meals';
export type StatsCardId = 'recap' | 'calories' | 'macros' | 'weight';
export type GoalsCardId = 'phases' | 'forecast' | 'target' | 'milestones';

/** Cards in display order, and which of them are hidden. */
export interface CardLayout<T extends string> {
  order: T[];
  hidden: T[];
}

/** What a calendar day shows besides its colour. */
export type CalendarCellContent = 'both' | 'calories' | 'weight' | 'color';

/** A stretch of the plan (a cut, maintenance, a lean bulk…) from its start date until the next one. */
export interface GoalPhase {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD
  calorieGoal: number;
  weeklyWeightTarget: number; // kg/week
}

export type MilestoneKind = 'weight' | 'streak' | 'withinGoal' | 'meals';

export interface Milestone {
  id: string;
  kind: MilestoneKind;
  /** kg for weight; a count of days or meals otherwise. */
  target: number;
  label?: string;
  createdAt: string; // YYYY-MM-DD
  /** Weight when it was set (kg), so "reach 75 kg" knows which way is progress. */
  startWeight?: number;
  achievedAt?: string;
}

export interface Prefs {
  homeCards?: CardLayout<HomeCardId>;
  /** The tiles beside the calorie ring on Home. */
  homeSummary?: { weight: boolean; macros: boolean };
  showStreak?: boolean;
  statsCards?: CardLayout<StatsCardId>;
  goalsCards?: CardLayout<GoalsCardId>;
  calendarCell?: CalendarCellContent;
  /** Hour (0–5) when a new day starts, for late nights and night shifts. */
  dayStartHour?: number;
  phases?: GoalPhase[];
  /** kcal added to (or taken from) the goal per weekday, Sunday first. */
  weekdayOffsets?: number[] | null;
  /** Protein target in g per kg of body weight, instead of fixed grams. */
  proteinPerKg?: number | null;
  milestones?: Milestone[];
  /** Things the coach should always keep in mind. */
  coachMemory?: string[];
}

export interface DaySummary {
  date: string;
  meals: MealEntry[];
  weight?: WeightEntry;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
}

export interface Profile {
  name: string;
  avatar?: string; // base64 data URL
}

export type TabKey = 'home' | 'stats' | 'calendar' | 'settings';

/** A meal saved for one-tap re-logging (no AI call). Photos are not kept. */
export interface PinnedMeal {
  id: string;
  name: string;
  mealType: MealType;
  items: FoodItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  createdAt: number;
}
