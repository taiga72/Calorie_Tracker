import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { useStore } from '@/store';
import {
  calculateTargets, ACTIVITY_LABELS,
  type Sex, type ActivityLevel, type WeightGoal, type HeightUnit, type InputWeightUnit,
  type CalcResult,
} from '@/lib/mifflin';
import { unitToKg } from '@/lib/units';
import { Flame, Activity, ChevronRight, Check, Loader2 } from 'lucide-react';

const SEXES: { key: Sex; label: string }[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
];

const GOALS: { key: WeightGoal; label: string; desc: string }[] = [
  { key: 'lose', label: 'Lose', desc: 'Reduce body fat' },
  { key: 'maintain', label: 'Maintain', desc: 'Stay the same' },
  { key: 'gain', label: 'Gain', desc: 'Build muscle' },
];

const ACTIVITY_KEYS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'extra'];

export function SetupWizardModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings } = useStore();

  const [step, setStep] = useState(0);
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [height, setHeight] = useState('');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<InputWeightUnit>(settings.weightUnit === 'lb' ? 'lb' : 'kg');
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [goal, setGoal] = useState<WeightGoal | null>(null);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep(0); setAge(''); setSex(null); setHeight(''); setHeightUnit('cm');
    setWeight(''); setWeightUnit(settings.weightUnit === 'lb' ? 'lb' : 'kg');
    setActivity(null); setGoal(null); setResult(null); setError(null);
  };

  const close = () => { reset(); onClose(); };

  const compute = (): CalcResult | null => {
    const ageN = parseInt(age, 10);
    const heightN = parseFloat(height);
    const weightN = parseFloat(weight);
    if (!ageN || ageN < 10 || ageN > 120) { setError('Enter a valid age (10-120).'); return null; }
    if (!heightN || heightN <= 0) { setError('Enter a valid height.'); return null; }
    if (!weightN || weightN <= 0) { setError('Enter a valid weight.'); return null; }
    if (!sex) { setError('Select your biological sex.'); return null; }
    if (!activity) { setError('Select an activity level.'); return null; }
    if (!goal) { setError('Select a weight goal.'); return null; }
    setError(null);
    return calculateTargets({
      age: ageN, sex, height: heightN, heightUnit, weight: weightN, weightUnit, activity, goal,
    });
  };

  const onApply = () => {
    const r = compute();
    if (!r) return;
    const goalWeightKg = r.goalWeightKg;
    updateSettings({
      calorieGoal: r.targetCalories,
      goalWeight: goalWeightKg,
      weeklyWeightTarget: r.weeklyWeightKg,
      weightUnit: weightUnit === 'lb' ? 'lb' : 'kg',
    });
    close();
  };

  const canNext = (): boolean => {
    if (step === 0) return !!age && parseInt(age, 10) >= 10 && parseInt(age, 10) <= 120;
    if (step === 1) return sex !== null;
    if (step === 2) return !!height && parseFloat(height) > 0;
    if (step === 3) return !!weight && parseFloat(weight) > 0;
    if (step === 4) return activity !== null;
    if (step === 5) return goal !== null;
    return false;
  };

  const next = () => {
    if (step < 5) {
      if (!canNext()) { setError('Please complete this step.'); return; }
      setError(null);
      setStep((s) => s + 1);
    } else {
      const r = compute();
      if (r) { setResult(r); setStep(6); }
    }
  };

  const STEP_TITLES = ['Age', 'Sex', 'Height', 'Weight', 'Activity', 'Goal', 'Results'];

  return (
    <Modal open={open} onClose={close} title="Setup Wizard">
      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mb-5">
        {STEP_TITLES.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-emerald-600 flex-1' : 'bg-gray-200 w-6'}`}
          />
        ))}
      </div>

      <p className="text-xs font-semibold text-gray-400 mb-1">Step {Math.min(step + 1, 7)} of 7</p>
      <h3 className="text-lg font-bold text-gray-900 mb-4">{STEP_TITLES[step]}</h3>

      {error && (
        <div className="bg-red-50 text-red-600 text-xs rounded-xl p-3 mb-4">{error}</div>
      )}

      {step === 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-4">How old are you?</p>
          <div className="flex items-center bg-gray-50 rounded-2xl px-4 py-4">
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 28"
              className="flex-1 bg-transparent text-2xl font-bold text-gray-900 outline-none"
            />
            <span className="text-sm font-semibold text-gray-400">years</span>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <p className="text-sm text-gray-500 mb-4">What is your biological sex? This affects the BMR formula.</p>
          <div className="grid grid-cols-2 gap-3">
            {SEXES.map((s) => (
              <button
                key={s.key}
                onClick={() => { setSex(s.key); setError(null); }}
                className={`py-6 rounded-2xl text-sm font-bold transition-colors ${sex === s.key ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-600'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="text-sm text-gray-500 mb-4">How tall are you?</p>
          <div className="flex gap-2 mb-3">
            {(['cm', 'in'] as HeightUnit[]).map((u) => (
              <button
                key={u}
                onClick={() => setHeightUnit(u)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${heightUnit === u ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-500'}`}
              >
                {u === 'cm' ? 'Centimeters' : 'Inches'}
              </button>
            ))}
          </div>
          <div className="flex items-center bg-gray-50 rounded-2xl px-4 py-4">
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder={heightUnit === 'cm' ? 'e.g. 175' : 'e.g. 69'}
              className="flex-1 bg-transparent text-2xl font-bold text-gray-900 outline-none"
            />
            <span className="text-sm font-semibold text-gray-400">{heightUnit}</span>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="text-sm text-gray-500 mb-4">What is your current weight?</p>
          <div className="flex gap-2 mb-3">
            {(['kg', 'lb'] as InputWeightUnit[]).map((u) => (
              <button
                key={u}
                onClick={() => setWeightUnit(u)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${weightUnit === u ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-500'}`}
              >
                {u === 'kg' ? 'Kilograms' : 'Pounds'}
              </button>
            ))}
          </div>
          <div className="flex items-center bg-gray-50 rounded-2xl px-4 py-4">
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={weightUnit === 'kg' ? 'e.g. 75' : 'e.g. 165'}
              className="flex-1 bg-transparent text-2xl font-bold text-gray-900 outline-none"
            />
            <span className="text-sm font-semibold text-gray-400">{weightUnit}</span>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <p className="text-sm text-gray-500 mb-4">What is your activity level?</p>
          <div className="space-y-2">
            {ACTIVITY_KEYS.map((a, i) => (
              <button
                key={a}
                onClick={() => { setActivity(a); setError(null); }}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-colors ${activity === a ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-700'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${activity === a ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {i + 1}
                </div>
                <span className="text-sm font-semibold flex-1">{ACTIVITY_LABELS[a]}</span>
                {activity === a && <Check size={18} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 5 && (
        <div>
          <p className="text-sm text-gray-500 mb-4">What is your weight goal?</p>
          <div className="space-y-2">
            {GOALS.map((g) => (
              <button
                key={g.key}
                onClick={() => { setGoal(g.key); setError(null); }}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-colors ${goal === g.key ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-700'}`}
              >
                <div className="flex-1">
                  <p className="text-sm font-bold">{g.label}</p>
                  <p className={`text-xs ${goal === g.key ? 'text-emerald-50' : 'text-gray-400'}`}>{g.desc}</p>
                </div>
                {goal === g.key && <Check size={18} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 6 && result && (
        <div>
          <div className="bg-emerald-50 rounded-2xl p-4 mb-4 text-center">
            <p className="text-xs font-bold tracking-wider text-emerald-600">DAILY TARGET</p>
            <p className="text-4xl font-bold text-emerald-700 mt-1">{result.targetCalories}</p>
            <p className="text-xs text-emerald-600 mt-0.5">kcal / day</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-2xl p-3.5 border border-gray-50">
              <div className="flex items-center gap-2 mb-1">
                <Flame size={14} className="text-orange-500" />
                <p className="text-xs font-semibold text-gray-400">BMR</p>
              </div>
              <p className="text-lg font-bold text-gray-900">{result.bmr}</p>
              <p className="text-[10px] text-gray-400">kcal at rest</p>
            </div>
            <div className="bg-white rounded-2xl p-3.5 border border-gray-50">
              <div className="flex items-center gap-2 mb-1">
                <Activity size={14} className="text-blue-500" />
                <p className="text-xs font-semibold text-gray-400">TDEE</p>
              </div>
              <p className="text-lg font-bold text-gray-900">{result.tdee}</p>
              <p className="text-[10px] text-gray-400">kcal burn/day</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-50 mb-4">
            <p className="text-xs font-semibold text-gray-400 mb-3">RECOMMENDED MACROS</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xl font-bold text-emerald-600">{result.protein}g</p>
                <p className="text-[10px] text-gray-400">Protein</p>
              </div>
              <div>
                <p className="text-xl font-bold text-orange-500">{result.carbs}g</p>
                <p className="text-[10px] text-gray-400">Carbs</p>
              </div>
              <div>
                <p className="text-xl font-bold text-amber-500">{result.fat}g</p>
                <p className="text-[10px] text-gray-400">Fat</p>
              </div>
            </div>
          </div>

          <button
            onClick={onApply}
            className="w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
          >
            <Check size={18} /> Apply to my goals
          </button>
          <button
            onClick={() => setStep(0)}
            className="w-full text-gray-500 font-semibold py-3 rounded-2xl text-sm mt-2"
          >
            Start over
          </button>
        </div>
      )}

      {/* Footer nav (hidden on results step) */}
      {step < 6 && (
        <div className="flex gap-2 mt-6">
          {step > 0 && (
            <button
              onClick={() => { setError(null); setStep((s) => s - 1); }}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3.5 rounded-2xl text-sm"
            >
              Back
            </button>
          )}
          <button
            onClick={next}
            disabled={!canNext()}
            className="flex-[2] bg-emerald-600 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[.99] transition-transform"
          >
            {step === 5 ? <><Loader2 size={0} /> Calculate</> : <>Continue <ChevronRight size={18} /></>}
          </button>
        </div>
      )}
    </Modal>
  );
}
