import { useState } from 'react'
import { useProfile } from '../context/ProfileContext'
import type { ActivityLevel, TargetGoal } from '../types'
import { Loader2, ChevronRight } from 'lucide-react'

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'lightly_active', label: 'Lightly Active' },
  { value: 'moderately_active', label: 'Moderately Active' },
  { value: 'very_active', label: 'Very Active' },
  { value: 'extra_active', label: 'Extra Active' },
]

const GOAL_OPTIONS: { value: TargetGoal; label: string }[] = [
  { value: 'lose', label: 'Lose Weight' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain Weight' },
]

function calcCalories(
  sex: 'male' | 'female',
  age: number,
  heightCm: number,
  weightKg: number,
  activity: ActivityLevel,
  goal: TargetGoal
): number {
  const bmr = sex === 'male'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161

  const mult: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extra_active: 1.9,
  }
  let tdee = bmr * mult[activity]
  if (goal === 'lose') tdee -= 500
  if (goal === 'gain') tdee += 400
  return Math.round(tdee)
}

export default function Onboarding() {
  const { setProfile } = useProfile()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [sex, setSex] = useState<'male' | 'female'>('male')
  const [age, setAge] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [activity, setActivity] = useState<ActivityLevel>('moderately_active')
  const [goal, setGoal] = useState<TargetGoal>('maintain')
  const [name, setName] = useState('')

  const handleFinish = () => {
    setError('')
    setLoading(true)
    const ageNum = parseInt(age, 10)
    const heightNum = parseFloat(heightCm)
    const weightNum = parseFloat(weightKg)
    if (!ageNum || !heightNum || !weightNum) {
      setError('Please enter valid numbers.')
      setLoading(false)
      return
    }

    const calories = calcCalories(sex, ageNum, heightNum, weightNum, activity, goal)
    const protein = Math.round((calories * 0.3) / 4)
    const fat = Math.round((calories * 0.25) / 9)
    const carbs = Math.round((calories * 0.45) / 4)

    setProfile({
      display_name: name || null,
      biological_sex: sex,
      age: ageNum,
      height_cm: heightNum,
      current_weight_kg: weightNum,
      activity_level: activity,
      target_goal: goal,
      target_daily_calories: calories,
      target_protein_g: protein,
      target_carbs_g: carbs,
      target_fat_g: fat,
      setup_complete: true,
      created_at: new Date().toISOString(),
    })
    setLoading(false)
  }

  const next = () => setStep((s) => s + 1)
  const back = () => setStep((s) => s - 1)

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <div className="mb-2 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-primary-600' : 'bg-neutral-200'}`}
              />
            ))}
          </div>
          <p className="text-xs font-medium text-neutral-400">Step {step + 1} of 3</p>
        </div>

        <div className="card animate-scale-in p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Welcome!</h2>
                <p className="mt-0.5 text-sm text-neutral-500">Let's set up your profile.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Display Name (optional)</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" className="input-field" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Biological Sex</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setSex('male')} className={`rounded-xl border py-2.5 text-sm font-semibold transition-all ${sex === 'male' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-neutral-200 text-neutral-600'}`}>Male</button>
                  <button onClick={() => setSex('female')} className={`rounded-xl border py-2.5 text-sm font-semibold transition-all ${sex === 'female' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-neutral-200 text-neutral-600'}`}>Female</button>
                </div>
              </div>
              <button onClick={next} className="btn-primary w-full">Continue <ChevronRight className="h-4 w-4" /></button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Your Stats</h2>
                <p className="mt-0.5 text-sm text-neutral-500">Used to calculate your daily targets.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Age</label>
                  <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="30" className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Height (cm)</label>
                  <input type="number" inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="175" className="input-field" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Current Weight (kg)</label>
                <input type="number" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="75" className="input-field" />
              </div>
              <div className="flex gap-2">
                <button onClick={back} className="btn-secondary flex-1">Back</button>
                <button onClick={next} className="btn-primary flex-1">Continue <ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Activity & Goal</h2>
                <p className="mt-0.5 text-sm text-neutral-500">Almost done!</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Activity Level</label>
                <div className="space-y-1.5">
                  {ACTIVITY_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setActivity(opt.value)} className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all ${activity === opt.value ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-neutral-200 text-neutral-600'}`}>
                      {opt.label}
                      <span className={`h-4 w-4 rounded-full border-2 transition-all ${activity === opt.value ? 'border-primary-600 bg-primary-600' : 'border-neutral-300'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-600">Goal</label>
                <div className="grid grid-cols-3 gap-2">
                  {GOAL_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setGoal(opt.value)} className={`rounded-xl border py-2.5 text-xs font-semibold transition-all ${goal === opt.value ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-neutral-200 text-neutral-600'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button onClick={back} className="btn-secondary flex-1">Back</button>
                <button onClick={handleFinish} disabled={loading} className="btn-primary flex-1">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Get Started'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
