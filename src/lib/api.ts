import { supabase } from './supabase'
import type { Meal, Profile, WeightLog } from '../types'
import { format } from 'date-fns'

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function upsertProfile(userId: string, fields: Partial<Profile>): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...fields })
    .select()
    .single()
  if (error) throw error
  return data as Profile
}

export async function getMealsForDay(userId: string, day: Date): Promise<Meal[]> {
  const start = new Date(day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(day)
  end.setHours(23, 59, 59, 999)

  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('profile_id', userId)
    .gte('logged_at', start.toISOString())
    .lte('logged_at', end.toISOString())
    .order('logged_at', { ascending: true })
  if (error) throw error
  return (data || []) as Meal[]
}

export async function getMealsForRange(userId: string, start: Date, end: Date): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('profile_id', userId)
    .gte('logged_at', start.toISOString())
    .lte('logged_at', end.toISOString())
    .order('logged_at', { ascending: true })
  if (error) throw error
  return (data || []) as Meal[]
}

export async function insertMeal(meal: Omit<Meal, 'id' | 'created_at'>): Promise<Meal> {
  const { data, error } = await supabase
    .from('meals')
    .insert(meal)
    .select()
    .single()
  if (error) throw error
  return data as Meal
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from('meals').delete().eq('id', id)
  if (error) throw error
}

export async function getWeightLogForDay(userId: string, day: Date): Promise<WeightLog | null> {
  const dateStr = format(day, 'yyyy-MM-dd')
  const { data, error } = await supabase
    .from('weight_logs')
    .select('*')
    .eq('profile_id', userId)
    .gte('logged_at', `${dateStr}T00:00:00`)
    .lte('logged_at', `${dateStr}T23:59:59.999`)
    .maybeSingle()
  if (error) throw error
  return data as WeightLog | null
}

export async function getWeightLogsForRange(userId: string, start: Date, end: Date): Promise<WeightLog[]> {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('*')
    .eq('profile_id', userId)
    .gte('logged_at', start.toISOString())
    .lte('logged_at', end.toISOString())
    .order('logged_at', { ascending: true })
  if (error) throw error
  return (data || []) as WeightLog[]
}

export async function getAllWeightLogs(userId: string): Promise<WeightLog[]> {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('*')
    .eq('profile_id', userId)
    .order('logged_at', { ascending: true })
  if (error) throw error
  return (data || []) as WeightLog[]
}

export async function upsertWeightLog(
  userId: string,
  day: Date,
  weightKg: number,
  existingId?: string
): Promise<WeightLog> {
  const loggedAt = new Date(day)
  loggedAt.setHours(8, 0, 0, 0)

  if (existingId) {
    const { data, error } = await supabase
      .from('weight_logs')
      .update({ weight_kg: weightKg, logged_at: loggedAt.toISOString() })
      .eq('id', existingId)
      .select()
      .single()
    if (error) throw error
    return data as WeightLog
  }

  const { data, error } = await supabase
    .from('weight_logs')
    .insert({
      profile_id: userId,
      weight_kg: weightKg,
      logged_at: loggedAt.toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data as WeightLog
}

export async function deleteWeightLog(id: string): Promise<void> {
  const { error } = await supabase.from('weight_logs').delete().eq('id', id)
  if (error) throw error
}
