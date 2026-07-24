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
  imageData?: string; // base64 data URL
  createdAt: number;
}

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  weight: number; // stored in kg
  createdAt: number;
}

export type WeightUnit = 'kg' | 'lb';

export interface Settings {
  calorieGoal: number;
  goalWeight: number; // stored in kg
  weeklyWeightTarget: number; // stored in kg
  weightUnit: WeightUnit;
  geminiApiKey: string;
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
