import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, format, isSameDay, isToday, startOfDay, subDays } from 'date-fns'
import {
  ChevronLeft, ChevronRight, Scale, Plus, Utensils, Trash2, Flame,
  Beef, Wheat, Droplet,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getMealsForDay, getWeightLogForDay, deleteMeal } from '../lib/api'
import type { Meal, WeightLog, MealType } from '../types'
import WeightLogModal from '../components/WeightLogModal'
import MealLogModal from '../components/MealLogModal'

const MEAL_ICONS: Record<MealType, string> = {
  Breakfast: '🌅',
  Lunch: '☀️',
  Dinner: '🌙',
  Snack: '🍎',
}

export default function HomeTab() {
  const { user, profile } = useAuth()
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [meals, setMeals] = useState<Meal[]>([])
  const [weightLog, setWeightLog] = useState<WeightLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [weightModalOpen, setWeightModalOpen] = useState(false)
  const [mealModalOpen, setMealModalOpen] = useState(false)
  const [mealType, setMealType] = useState<MealType>('Breakfast')
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [dayMeals, wLog] = await Promise.all([
        getMealsForDay(user.id, selectedDate),
        getWeightLogForDay(user.id, selectedDate),
      ])
      setMeals(dayMeals)
      setWeightLog(wLog)
    } catch (e) {
      console.error('Failed to load data', e)
    } finally {
      setLoading(false)
    }
  }, [user, selectedDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totals = useMemo(() => {
    return meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )
  }, [meals])

  const targetCals = profile?.target_daily_calories ?? 2000
  const calProgress = Math.min((totals.calories / targetCals) * 100, 100)
  const remaining = Math.max(targetCals - totals.calories, 0)

  const mealsByType = useMemo(() => {
    const grouped: Record<MealType, Meal[]> = { Breakfast: [], Lunch: [], Dinner: [], Snack: [] }
    meals.forEach((m) => grouped[m.meal_type]?.push(m))
    return grouped
  }, [meals])

  const goPrev = () => setSelectedDate((d) => subDays(d, 1))
  const goNext = () => setSelectedDate((d) => addDays(d, 1))

  const openMealModal = (type: MealType) => {
    setMealType(type)
    setMealModalOpen(true)
    setAddMenuOpen(false)
  }

  const handleDeleteMeal = async (id: string) => {
    try {
      await deleteMeal(id)
      setMeals((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      console.error('Failed to delete meal', e)
    }
  }

  const dateLabel = isToday(selectedDate) ? 'Today' : isSameDay(selectedDate, subDays(new Date(), 1)) ? 'Yesterday' : format(selectedDate, 'EEE, MMM d')

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-4">
      {/* Day navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={goPrev} className="rounded-xl p-2 text-neutral-600 transition-colors hover:bg-neutral-100">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-bold text-neutral-900">{dateLabel}</h2>
          <p className="text-xs text-neutral-400">{format(selectedDate, 'MMMM yyyy')}</p>
        </div>
        <button
          onClick={goNext}
          disabled={isToday(selectedDate)}
          className="rounded-xl p-2 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Weight card — tap to edit/log */}
      <button
        onClick={() => setWeightModalOpen(true)}
        className="card group mb-4 flex w-full items-center gap-4 text-left transition-all hover:shadow-cardLg active:scale-[0.99]"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-100">
          <Scale className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-neutral-500">Weight</p>
          {weightLog ? (
            <p className="text-xl font-bold text-neutral-900">{weightLog.weight_kg}<span className="text-sm font-medium text-neutral-400"> kg</span></p>
          ) : (
            <p className="text-xl font-semibold text-neutral-400">No weight logged</p>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold text-primary-600">
          {weightLog ? 'Edit' : 'Log'}
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </button>

      {/* Calories ring */}
      <div className="card mb-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-500">Calories</p>
            <p className="text-2xl font-bold text-neutral-900">{totals.calories}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-neutral-500">Target</p>
            <p className="text-sm font-semibold text-neutral-700">{targetCals} kcal</p>
          </div>
        </div>
        <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500"
            style={{ width: `${calProgress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-neutral-500">{remaining} kcal remaining</span>
          <span className={`font-semibold ${totals.calories > targetCals ? 'text-accent-600' : 'text-primary-600'}`}>
            {Math.round(calProgress)}%
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-neutral-50 p-2.5 text-center">
            <div className="mb-0.5 flex items-center justify-center gap-1 text-neutral-400"><Beef className="h-3 w-3" /></div>
            <p className="text-sm font-bold text-neutral-900">{totals.protein}<span className="text-xs">g</span></p>
            <p className="text-[10px] text-neutral-400">Protein</p>
          </div>
          <div className="rounded-xl bg-neutral-50 p-2.5 text-center">
            <div className="mb-0.5 flex items-center justify-center gap-1 text-neutral-400"><Wheat className="h-3 w-3" /></div>
            <p className="text-sm font-bold text-neutral-900">{totals.carbs}<span className="text-xs">g</span></p>
            <p className="text-[10px] text-neutral-400">Carbs</p>
          </div>
          <div className="rounded-xl bg-neutral-50 p-2.5 text-center">
            <div className="mb-0.5 flex items-center justify-center gap-1 text-neutral-400"><Droplet className="h-3 w-3" /></div>
            <p className="text-sm font-bold text-neutral-900">{totals.fat}<span className="text-xs">g</span></p>
            <p className="text-[10px] text-neutral-400">Fat</p>
          </div>
        </div>
      </div>

      {/* Meals list */}
      <div className="space-y-3">
        {(['Breakfast', 'Lunch', 'Dinner', 'Snack'] as MealType[]).map((type) => (
          <div key={type}>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-neutral-700">
                <span>{MEAL_ICONS[type]}</span> {type}
              </h3>
              <button onClick={() => openMealModal(type)} className="btn-ghost py-1 text-xs text-primary-600">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            {mealsByType[type].length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 py-3 text-center text-xs text-neutral-400">
                No meals logged
              </div>
            ) : (
              <div className="space-y-2">
                {mealsByType[type].map((meal) => (
                  <div key={meal.id} className="card group flex items-start gap-3 p-3.5">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
                      <Flame className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-neutral-900">{meal.calories} kcal</p>
                      <div className="flex gap-2 text-[11px] text-neutral-400">
                        <span>{meal.protein}p</span>
                        <span>{meal.carbs}c</span>
                        <span>{meal.fat}f</span>
                      </div>
                      {meal.food_items && meal.food_items.length > 0 && (
                        <p className="mt-0.5 truncate text-xs text-neutral-500">
                          {meal.food_items.map((f) => f.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteMeal(meal.id)}
                      className="rounded-lg p-1.5 text-neutral-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {loading && meals.length === 0 && (
        <div className="mt-8 text-center text-sm text-neutral-400">Loading...</div>
      )}

      {/* Floating + Log meal/weight button */}
      <div className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2">
        {addMenuOpen && (
          <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-neutral-100 bg-white p-2 shadow-cardLg animate-scale-in">
            <button
              onClick={() => openMealModal('Snack')}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <Utensils className="h-4 w-4 text-primary-600" /> Log Meal
            </button>
            <button
              onClick={() => { setWeightModalOpen(true); setAddMenuOpen(false) }}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <Scale className="h-4 w-4 text-primary-600" /> Log Weight
            </button>
          </div>
        )}
        <button
          onClick={() => setAddMenuOpen((v) => !v)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-cardLg transition-all hover:bg-primary-700 active:scale-95"
        >
          <Plus className={`h-6 w-6 transition-transform ${addMenuOpen ? 'rotate-45' : ''}`} />
        </button>
      </div>

      <WeightLogModal
        open={weightModalOpen}
        date={selectedDate}
        currentWeight={weightLog?.weight_kg ?? null}
        existingId={weightLog?.id}
        onClose={() => setWeightModalOpen(false)}
        onSaved={async () => {
          setWeightModalOpen(false)
          await loadData()
        }}
        onDeleted={async () => {
          setWeightModalOpen(false)
          await loadData()
        }}
      />

      <MealLogModal
        open={mealModalOpen}
        date={selectedDate}
        mealType={mealType}
        onClose={() => setMealModalOpen(false)}
        onLogged={async () => {
          setMealModalOpen(false)
          await loadData()
        }}
      />
    </div>
  )
}
