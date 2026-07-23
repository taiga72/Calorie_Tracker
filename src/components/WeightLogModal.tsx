import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Loader2, Scale, X, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { upsertWeightLog, deleteWeightLog } from '../lib/api'

interface WeightLogModalProps {
  open: boolean
  date: Date
  currentWeight: number | null
  existingId?: string
  onClose: () => void
  onSaved: (weightKg: number) => void
  onDeleted?: () => void
}

export default function WeightLogModal({
  open,
  date,
  currentWeight,
  existingId,
  onClose,
  onSaved,
  onDeleted,
}: WeightLogModalProps) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue(currentWeight != null ? String(currentWeight) : '')
      setError('')
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open, currentWeight])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleSave = async () => {
    setError('')
    const parsed = parseFloat(value)
    if (!parsed || parsed <= 0 || parsed > 1000) {
      setError('Enter a valid weight between 1 and 1000 kg.')
      return
    }
    setLoading(true)
    try {
      const { data } = await supabase.auth.getSession()
      const userId = data.session?.user?.id
      if (!userId) throw new Error('Not authenticated.')
      await upsertWeightLog(userId, date, parsed, existingId)
      onSaved(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save weight.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!existingId) return
    setDeleting(true)
    try {
      await deleteWeightLog(existingId)
      onDeleted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm animate-slide-up rounded-t-3xl bg-white p-6 shadow-cardLg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">
                {currentWeight != null ? 'Edit Weight' : 'Log Weight'}
              </h3>
              <p className="text-xs text-neutral-500">{format(date, 'EEEE, MMM d, yyyy')}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Weight (kg)</label>
            <div className="relative">
              <input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                step="0.1"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="0.0"
                className="input-field pr-10 text-lg font-semibold"
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-neutral-400">kg</span>
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            {existingId && currentWeight != null && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-secondary text-red-600 hover:bg-red-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
              </button>
            )}
            <button onClick={handleSave} disabled={loading} className="btn-primary flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Save</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
