import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Loader2, X, Camera, Utensils, Sparkles } from 'lucide-react'
import { estimateMealFromText, estimateMealFromPhoto } from '../lib/gemini'
import { insertMeal } from '../lib/storage'
import type { GeminiEstimate, MealType } from '../types'

interface MealLogModalProps {
  open: boolean
  date: Date
  mealType: MealType
  onClose: () => void
  onLogged: () => void
}

const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

export default function MealLogModal({ open, date, mealType, onClose, onLogged }: MealLogModalProps) {
  const [selectedMealType, setSelectedMealType] = useState<MealType>(mealType)
  const [input, setInput] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [estimate, setEstimate] = useState<GeminiEstimate | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSelectedMealType(mealType)
      setInput('')
      setImagePreview(null)
      setImageBase64(null)
      setMimeType(null)
      setError('')
      setEstimate(null)
    }
  }, [open, mealType])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setImagePreview(result)
      const base64 = result.split(',')[1] || ''
      setImageBase64(base64)
      setMimeType(file.type)
    }
    reader.readAsDataURL(file)
  }

  const handleEstimate = async () => {
    setError('')
    setEstimate(null)
    if (!input.trim() && !imageBase64) {
      setError('Describe your meal or upload a photo.')
      return
    }
    setLoading(true)
    try {
      const result = imageBase64 && mimeType
        ? await estimateMealFromPhoto(imageBase64, mimeType, selectedMealType)
        : await estimateMealFromText(input, selectedMealType)
      setEstimate(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Estimation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (!estimate) return
    setLoading(true)
    const loggedAt = new Date(date)
    const now = new Date()
    loggedAt.setHours(now.getHours(), now.getMinutes(), 0, 0)
    try {
      insertMeal({
        meal_type: selectedMealType,
        logged_at: loggedAt.toISOString(),
        calories: estimate.calories,
        protein: estimate.protein,
        carbs: estimate.carbs,
        fat: estimate.fat,
        fiber: estimate.fiber,
        food_items: estimate.food_items,
        reasoning: estimate.reasoning,
      })
      onLogged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save meal.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col animate-slide-up overflow-hidden rounded-t-3xl bg-white shadow-cardLg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 p-5">
          <div>
            <h3 className="text-base font-bold text-neutral-900">Log Meal</h3>
            <p className="text-xs text-neutral-500">{format(date, 'EEEE, MMM d, yyyy')}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Meal Type</label>
            <div className="grid grid-cols-4 gap-1.5">
              {MEAL_TYPES.map((mt) => (
                <button
                  key={mt}
                  onClick={() => setSelectedMealType(mt)}
                  className={`rounded-lg border py-2 text-xs font-semibold transition-all ${selectedMealType === mt ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-neutral-200 text-neutral-600'}`}
                >
                  {mt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Describe your meal</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 2 eggs, 2 slices toast, 1 banana"
              rows={3}
              className="input-field resize-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Or upload a photo</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Meal preview" className="w-full rounded-xl object-cover" style={{ maxHeight: 180 }} />
                <button
                  onClick={() => { setImagePreview(null); setImageBase64(null); setMimeType(null) }}
                  className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 py-6 text-neutral-400 transition-all hover:border-primary-300 hover:bg-primary-50/50"
              >
                <Camera className="h-6 w-6" />
                <span className="text-xs font-medium">Upload food photo</span>
              </button>
            )}
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

          {estimate && (
            <div className="animate-fade-in rounded-xl border border-primary-100 bg-primary-50/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-600" />
                <span className="text-xs font-bold text-primary-700">AI Estimate</span>
              </div>
              <div className="mb-3 grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-neutral-900">{estimate.calories}</p>
                  <p className="text-[10px] font-medium text-neutral-500">kcal</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-neutral-900">{estimate.protein}<span className="text-xs">g</span></p>
                  <p className="text-[10px] font-medium text-neutral-500">Protein</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-neutral-900">{estimate.carbs}<span className="text-xs">g</span></p>
                  <p className="text-[10px] font-medium text-neutral-500">Carbs</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-neutral-900">{estimate.fat}<span className="text-xs">g</span></p>
                  <p className="text-[10px] font-medium text-neutral-500">Fat</p>
                </div>
              </div>
              {estimate.food_items.length > 0 && (
                <div className="mb-2 space-y-1">
                  {estimate.food_items.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs text-neutral-600">
                      <span>{item.name} <span className="text-neutral-400">({item.quantity})</span></span>
                      <span className="font-medium">{item.calories} kcal</span>
                    </div>
                  ))}
                </div>
              )}
              {estimate.reasoning && (
                <p className="text-xs italic text-neutral-400">{estimate.reasoning}</p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-100 p-5">
          {!estimate ? (
            <button onClick={handleEstimate} disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4" /> Estimate with AI</>}
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEstimate(null)} className="btn-secondary flex-1">Redo</button>
              <button onClick={handleSave} disabled={loading} className="btn-primary flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Utensils className="h-4 w-4" /> Save Meal</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
