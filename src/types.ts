export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'

export interface FoodItem {
  name: string
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface Meal {
  id: string
  meal_type: MealType
  logged_at: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  food_items: FoodItem[]
  reasoning: string | null
  created_at: string
}

export interface WeightLog {
  id: string
  weight_kg: number
  logged_at: string
  created_at: string
}

export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active'
export type TargetGoal = 'lose' | 'maintain' | 'gain'

export interface Profile {
  display_name: string | null
  biological_sex: 'male' | 'female' | null
  age: number | null
  height_cm: number | null
  current_weight_kg: number | null
  activity_level: ActivityLevel | null
  target_goal: TargetGoal | null
  target_daily_calories: number | null
  target_protein_g: number | null
  target_carbs_g: number | null
  target_fat_g: number | null
  setup_complete: boolean
  created_at: string
}

export interface GeminiEstimate {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  food_items: FoodItem[]
  reasoning: string
}
