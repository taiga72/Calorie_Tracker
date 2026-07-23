import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Scale, Plus, Pencil, X, Utensils, Flame, Trash2,
} from 'lucide-react'
import {
  getMealsForRange, getWeightLogsForRange, deleteMeal,
} from '../lib/storage'
import type { Meal, WeightLog } from '../types'
import WeightLogModal from '../components/WeightLogModal'
import MealLogModal from '../components/MealLogModal'

export default function CalendarTab() {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [meals, setMeals] = useState<Meal[]>([])
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [weightModalOpen, setWeightModalOpen] = useState(false)
  const [mealModalOpen, setMealModalOpen] = useState(false)

  const loadMonthData = useCallback(() => {
    setLoading(true)
    const monthStart = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 0 })
    const monthEnd = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 0 })
    setMeals(getMealsForRange(monthStart, monthEnd))
    setWeightLogs(getWeightLogsForRange(monthStart, monthEnd))
    setLoading(false)
  }, [monthCursor])

  useEffect(() => {
    loadMonthData()
  }, [loadMonthData])

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [monthCursor])

  const weightByDay = useMemo(() => {
    const map = new Map<string, WeightLog>()
    weightLogs.forEach((w) => map.set(format(new Date(w.logged_at), 'yyyy-MM-dd'), w))
    return map
  }, [weightLogs])

  const mealsByDay = useMemo(() => {
    const map = new Map<string, Meal[]>()
    meals.forEach((m) => {
      const key = format(new Date(m.logged_at), 'yyyy-MM-dd')
      const arr = map.get(key) || []
      arr.push(m)
      map.set(key, arr)
    })
    return map
  }, [meals])

  const selectedDayMeals = useMemo(() => {
    if (!selectedDay) return []
    return (mealsByDay.get(format(selectedDay, 'yyyy-MM-dd')) || []).slice().sort(
      (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
    )
  }, [selectedDay, mealsByDay])

  const selectedDayWeight = useMemo(() => {
    if (!selectedDay) return null
    return weightByDay.get(format(selectedDay, 'yyyy-MM-dd')) || null
  }, [selectedDay, weightByDay])

  const selectedDayCalories = useMemo(
    () => selectedDayMeals.reduce((sum, m) => sum + m.calories, 0),
    [selectedDayMeals]
  )

  const goPrevMonth = () => setMonthCursor((m) => subMonths(m, 1))
  const goNextMonth = () => setMonthCursor((m) => addMonths(m, 1))

  const handleDeleteMeal = (id: string) => {
    deleteMeal(id)
    setMeals((prev) => prev.filter((m) => m.id !== id))
  }

  const handleWeightSaved = () => {
    setWeightModalOpen(false)
    loadMonthData()
  }

  const handleWeightDeleted = () => {
    setWeightModalOpen(false)
    loadMonthData()
  }

  const handleMealLogged = () => {
    setMealModalOpen(false)
    loadMonthData()
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-neutral-900">{format(monthCursor, 'MMMM yyyy')}</h2>
        <div className="flex gap-1">
          <button onClick={goPrevMonth} className="rounded-xl p-2 text-neutral-600 transition-colors hover:bg-neutral-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={goNextMonth} className="rounded-xl p-2 text-neutral-600 transition-colors hover:bg-neutral-100">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="card p-3">
        <div className="mb-2 grid grid-cols-7 gap-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[11px] font-semibold text-neutral-400">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const inMonth = isSameMonth(day, monthCursor)
            const today = isToday(day)
            const weight = weightByDay.get(key)
            const dayMeals = mealsByDay.get(key)
            const hasMeals = dayMeals && dayMeals.length > 0
            const isSelected = selectedDay && isSameDay(day, selectedDay)

            return (
              <button
                key={key}
                onClick={() => setSelectedDay(day)}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-all ${
                  isSelected
                    ? 'bg-primary-600 font-bold text-white shadow-md'
                    : today
                    ? 'bg-primary-50 font-bold text-primary-700'
                    : inMonth
                    ? 'text-neutral-700 hover:bg-neutral-100'
                    : 'text-neutral-300 hover:bg-neutral-50'
                }`}
              >
                <span>{format(day, 'd')}</span>
                <div className="absolute bottom-1 flex gap-0.5">
                  {weight && (
                    <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-primary-500'}`} />
                  )}
                  {hasMeals && (
                    <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-accent-400'}`} />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {loading && <div className="mt-4 text-center text-sm text-neutral-400">Loading...</div>}

      {/* Day Detail Modal */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col animate-slide-up overflow-hidden rounded-t-3xl bg-white shadow-cardLg sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 p-5">
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  {isToday(selectedDay) ? 'Today' : format(selectedDay, 'EEEE')}
                </h3>
                <p className="text-xs text-neutral-500">{format(selectedDay, 'MMMM d, yyyy')}</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {/* Interactive weight section */}
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary-600" />
                  <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Weight</span>
                </div>
                {selectedDayWeight ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-bold text-neutral-900">
                        {selectedDayWeight.weight_kg}<span className="text-sm font-medium text-neutral-400"> kg</span>
                      </p>
                      <p className="text-[11px] text-neutral-400">Logged weight</p>
                    </div>
                    <button
                      onClick={() => setWeightModalOpen(true)}
                      className="btn-secondary py-2 text-xs"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-neutral-400">No weight logged</p>
                    <button
                      onClick={() => setWeightModalOpen(true)}
                      className="btn-primary py-2 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" /> Log Weight
                    </button>
                  </div>
                )}
              </div>

              {/* Meals summary */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-accent-500" />
                    <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Meals</span>
                  </div>
                  <span className="text-xs font-semibold text-neutral-400">
                    {selectedDayCalories} kcal · {selectedDayMeals.length} item{selectedDayMeals.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {selectedDayMeals.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-200 py-5 text-center">
                    <p className="text-xs text-neutral-400">No meals logged for this day</p>
                    <button
                      onClick={() => setMealModalOpen(true)}
                      className="btn-ghost mt-2 text-xs text-primary-600"
                    >
                      <Plus className="h-3.5 w-3.5" /> Log a meal
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDayMeals.map((meal) => (
                      <div key={meal.id} className="group flex items-start gap-3 rounded-xl border border-neutral-100 p-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
                          <Flame className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-neutral-900">{meal.meal_type}</p>
                            <p className="text-sm font-bold text-neutral-900">{meal.calories} <span className="text-xs font-normal text-neutral-400">kcal</span></p>
                          </div>
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
            </div>

            <div className="border-t border-neutral-100 p-4">
              <button onClick={() => setMealModalOpen(true)} className="btn-primary w-full">
                <Plus className="h-4 w-4" /> Log Meal for {format(selectedDay, 'MMM d')}
              </button>
            </div>
          </div>
        </div>
      )}

      <WeightLogModal
        open={weightModalOpen}
        date={selectedDay ?? new Date()}
        currentWeight={selectedDayWeight?.weight_kg ?? null}
        existingId={selectedDayWeight?.id}
        onClose={() => setWeightModalOpen(false)}
        onSaved={handleWeightSaved}
        onDeleted={handleWeightDeleted}
      />

      <MealLogModal
        open={mealModalOpen}
        date={selectedDay ?? new Date()}
        mealType="Snack"
        onClose={() => setMealModalOpen(false)}
        onLogged={handleMealLogged}
      />
    </div>
  )
}
