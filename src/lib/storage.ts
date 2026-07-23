import { format } from 'date-fns'
import type { Meal, Profile, WeightLog } from '../types'

const MEALS_KEY = 'nutritrack.meals'
const WEIGHTS_KEY = 'nutritrack.weight_logs'
const PROFILE_KEY = 'nutritrack.profile'

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('localStorage write failed', e)
  }
}

/* ---------- Profile ---------- */

export function getProfile(): Profile | null {
  return read<Profile | null>(PROFILE_KEY, null)
}

export function saveProfile(profile: Profile): void {
  write(PROFILE_KEY, profile)
}

export function updateProfile(fields: Partial<Profile>): Profile {
  const existing = getProfile()
  const updated: Profile = {
    display_name: null,
    biological_sex: null,
    age: null,
    height_cm: null,
    current_weight_kg: null,
    activity_level: null,
    target_goal: null,
    target_daily_calories: null,
    target_protein_g: null,
    target_carbs_g: null,
    target_fat_g: null,
    setup_complete: false,
    created_at: new Date().toISOString(),
    ...existing,
    ...fields,
  }
  saveProfile(updated)
  return updated
}

/* ---------- Meals ---------- */

function getAllMeals(): Meal[] {
  return read<Meal[]>(MEALS_KEY, [])
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function getMealsForDay(day: Date): Meal[] {
  return getAllMeals()
    .filter((m) => isSameDay(new Date(m.logged_at), day))
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
}

export function getMealsForRange(start: Date, end: Date): Meal[] {
  const s = start.getTime()
  const e = end.getTime()
  return getAllMeals()
    .filter((m) => {
      const t = new Date(m.logged_at).getTime()
      return t >= s && t <= e
    })
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
}

export function insertMeal(meal: Omit<Meal, 'id' | 'created_at'>): Meal {
  const all = getAllMeals()
  const newMeal: Meal = {
    ...meal,
    id: uid(),
    created_at: new Date().toISOString(),
  }
  all.push(newMeal)
  write(MEALS_KEY, all)
  return newMeal
}

export function deleteMeal(id: string): void {
  write(MEALS_KEY, getAllMeals().filter((m) => m.id !== id))
}

/* ---------- Weight logs ---------- */

function getAllWeights(): WeightLog[] {
  return read<WeightLog[]>(WEIGHTS_KEY, [])
}

export function getWeightLogForDay(day: Date): WeightLog | null {
  const dateStr = format(day, 'yyyy-MM-dd')
  return getAllWeights().find((w) => format(new Date(w.logged_at), 'yyyy-MM-dd') === dateStr) || null
}

export function getWeightLogsForRange(start: Date, end: Date): WeightLog[] {
  const s = start.getTime()
  const e = end.getTime()
  return getAllWeights()
    .filter((w) => {
      const t = new Date(w.logged_at).getTime()
      return t >= s && t <= e
    })
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
}

export function getAllWeightLogs(): WeightLog[] {
  return getAllWeights().sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  )
}

export function upsertWeightLog(
  day: Date,
  weightKg: number,
  existingId?: string
): WeightLog {
  const all = getAllWeights()
  const loggedAt = new Date(day)
  loggedAt.setHours(8, 0, 0, 0)

  if (existingId) {
    const idx = all.findIndex((w) => w.id === existingId)
    if (idx >= 0) {
      all[idx] = { ...all[idx], weight_kg: weightKg, logged_at: loggedAt.toISOString() }
      write(WEIGHTS_KEY, all)
      return all[idx]
    }
  }

  const newLog: WeightLog = {
    id: uid(),
    weight_kg: weightKg,
    logged_at: loggedAt.toISOString(),
    created_at: new Date().toISOString(),
  }
  all.push(newLog)
  write(WEIGHTS_KEY, all)
  return newLog
}

export function deleteWeightLog(id: string): void {
  write(WEIGHTS_KEY, getAllWeights().filter((w) => w.id !== id))
}
