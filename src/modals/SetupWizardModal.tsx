import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { useStore } from '@/store';
import {
  calculateTargets, ACTIVITY_LABELS, ACTIVITY_SUBS, ACTIVITY_FACTORS, DEFICIT_PRESETS,
  type Sex, type ActivityLevel, type DeficitLevel, type HeightUnit, type InputWeightUnit,
  type CalcResult,
} from '@/lib/mifflin';
import { Flame, Activity, Check, ChevronRight, Target, TrendingDown, Utensils } from 'lucide-react';

const SEXES: { key: Sex; label: string }[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
];

const ACTIVITY_KEYS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'extra'];

const STEP_TITLES = ['Age', 'Sex', 'Height', 'Current Weight', 'Goal Weight', 'Activity', 'Deficit', 'Results'];

export function SetupWizardModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings } = useStore();

  const [step, setStep] = useState(0);
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [height, setHeight] = useState('');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<InputWeightUnit>(settings.weightUnit === 'lb' ? 'lb' : 'kg');
  const [goalWeight, setGoalWeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [deficit, setDeficit] = useState<DeficitLevel>('moderate');
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep(0); setAge(''); setSex(null); setHeight(''); setHeightUnit('cm');
    setWeight(''); setWeightUnit(settings.weightUnit === 'lb' ? 'lb' : 'kg');
    setGoalWeight(''); setActivity(null); setDeficit('moderate'); setResult(null); setError(null);
  };

  const close = () => { reset(); onClose(); };

  const buildResult = (): CalcResult | null => {
    const ageN = parseInt(age, 10);
    const heightN = parseFloat(height);
    const weightN = parseFloat(weight);
    const goalN = parseFloat(goalWeight);
    if (!ageN || ageN < 10 || ageN > 120) { setError('Enter a valid age (10-120).'); return null; }
    if (!heightN || heightN <= 0) { setError('Enter a valid height.'); return null; }
    if (!weightN || weightN <= 0) { setError('Enter a valid current weight.'); return null; }
    if (!goalN || goalN <= 0) { setError('Enter a valid goal weight.'); return null; }
    if (!sex) { setError('Select your biological sex.'); return null; }
    if (!activity) { setError('Select an activity level.'); return null; }
    setError(null);
    return calculateTargets({
      age: ageN, sex, height: heightN, heightUnit, weight: weightN, weightUnit,
      goalWeight: goalN, activity, deficit,
    });
  };

  const onApply = () => {
    const r = result ?? buildResult();
    if (!r) return;
    updateSettings({
      calorieGoal: r.targetCalories,
      goalWeight: r.goalWeightKg,
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
    if (step === 4) return !!goalWeight && parseFloat(goalWeight) > 0;
    if (step === 5) return activity !== null;
    if (step === 6) return deficit !== null;
    return false;
  };

  const next = () => {
    if (!canNext()) { setError('Please complete this step.'); return; }
    setError(null);
    if (step < 6) {
      setStep((s) => s + 1);
    } else {
      const r = buildResult();
      if (r) { setResult(r); setStep(7); }
    }
  };

  const livePreview = (): CalcResult | null => {
    if (!age || !height || !weight || !goalWeight || !sex || !activity) return null;
    return calculateTargets({
      age: parseInt(age, 10), sex,
      height: parseFloat(height), heightUnit,
      weight: parseFloat(weight), weightUnit,
      goalWeight: parseFloat(goalWeight), activity, deficit,
    });
  };

  const preview = livePreview();

  const fmtGoalDate = (d: Date | null, weeks: number | null): string => {
    if (!d || !weeks) return 'Maintaining — no end date';
    const fmt = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return `${fmt} • ${weeks} weeks from today`;
  };

  return (
    <Modal open={open} onClose={close} title="Setup Wizard">
      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mb-5">
        {STEP_TITLES.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-emerald-600 flex-1' : 'bg-gray-200 w-4'}`}
          />
        ))}
      </div>

      <p className="text-xs font-semibold text-gray-400 mb-1">Step {Math.min(step + 1, 8)} of 8</p>
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
          <UnitToggle unit={weightUnit} onChange={setWeightUnit} />
          <NumberField value={weight} onChange={setWeight} unit={weightUnit} placeholder={weightUnit === 'kg' ? 'e.g. 80' : 'e.g. 176'} />
        </div>
      )}

      {step === 4 && (
        <div>
          <p className="text-sm text-gray-500 mb-4">What is your goal weight?</p>
          <UnitToggle unit={weightUnit} onChange={setWeightUnit} />
          <NumberField value={goalWeight} onChange={setGoalWeight} unit={weightUnit} placeholder={weightUnit === 'kg' ? 'e.g. 67' : 'e.g. 148'} />
        </div>
      )}

      {step === 5 && (
        <div>
          <p className="text-sm text-gray-500 mb-4">What is your activity level?</p>
          <div className="space-y-2">
            {ACTIVITY_KEYS.map((a) => (
              <button
                key={a}
                onClick={() => { setActivity(a); setError(null); }}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-colors ${activity === a ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-700'}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{ACTIVITY_LABELS[a]}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${activity === a ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      ×{ACTIVITY_FACTORS[a]}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${activity === a ? 'text-emerald-50' : 'text-gray-400'}`}>{ACTIVITY_SUBS[a]}</p>
                </div>
                {activity === a && <Check size={18} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 6 && (
        <div>
          <p className="text-sm text-gray-500 mb-4">Choose how aggressively you want to reach your goal.</p>
          <div className="space-y-2.5">
            {DEFICIT_PRESETS.map((d) => {
              const active = deficit === d.key;
              const rateText = weightUnit === 'lb' ? `~${d.weeklyLb} lb/week` : `~${d.weeklyKg} kg/week`;
              const previewTarget = preview ? Math.max(preview.tdee - d.kcal, sex === 'male' ? 1200 : 1000) : null;
              return (
                <button
                  key={d.key}
                  onClick={() => { setDeficit(d.key); setError(null); }}
                  className={`w-full p-4 rounded-2xl text-left transition-all ${active ? 'bg-emerald-600 text-white border-2 border-emerald-600' : 'bg-gray-50 text-gray-700 border-2 border-transparent'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">{d.label}</p>
                      <p className={`text-xs mt-0.5 ${active ? 'text-emerald-50' : 'text-gray-400'}`}>{d.sub}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${active ? 'text-white' : 'text-gray-700'}`}>-{d.kcal} kcal</p>
                      <p className={`text-[10px] ${active ? 'text-emerald-50' : 'text-gray-400'}`}>{rateText}</p>
                    </div>
                  </div>
                  {previewTarget && (
                    <div className={`mt-3 pt-3 border-t ${active ? 'border-white/20' : 'border-gray-200'} flex items-center justify-between`}>
                      <span className={`text-[11px] font-medium ${active ? 'text-emerald-50' : 'text-gray-400'}`}>Target</span>
                      <span className={`text-sm font-bold ${active ? 'text-white' : 'text-emerald-600'}`}>{previewTarget} kcal/day</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <button
            onClick={next}
            className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-2xl text-sm mt-5 flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
          >
            <Flame size={18} /> Calculate My Calorie Deficit
          </button>
        </div>
      )}

      {step === 7 && result && (
        <div>
          {/* Header: goal date + progress */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 mb-4 border border-emerald-100/60">
            <div className="flex items-center gap-2 mb-2">
              <Target size={16} className="text-emerald-600" />
              <p className="text-xs font-bold tracking-wider text-emerald-600">ESTIMATED GOAL DATE</p>
            </div>
            <p className="text-sm font-bold text-gray-800 mb-3">{fmtGoalDate(result.goalDate, result.weeksToGoal)}</p>
            <div className="bg-white/70 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-500">
                  {weightUnit === 'lb' ? (result.currentWeightKg * 2.2046).toFixed(0) : result.currentWeightKg.toFixed(0)} {weightUnit}
                </span>
                <span className="text-xs font-semibold text-emerald-600">
                  {weightUnit === 'lb' ? (result.goalWeightKg * 2.2046).toFixed(0) : result.goalWeightKg.toFixed(0)} {weightUnit}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <MetricCard icon={<Flame size={14} className="text-orange-500" />} label="BMR" value={result.bmr} sub="kcal at rest" />
            <MetricCard icon={<Activity size={14} className="text-blue-500" />} label="TDEE" value={result.tdee} sub="maintenance" />
            <MetricCard icon={<TrendingDown size={14} className="text-red-500" />} label="Deficit" value={result.deficit > 0 ? `-${result.deficit}` : `+${Math.abs(result.deficit)}`} sub="kcal/day" />
            <MetricCard icon={<Target size={14} className="text-emerald-600" />} label="Target" value={result.targetCalories} sub="kcal/day" highlight />
          </div>

          {/* Macros */}
          <div className="bg-white rounded-2xl p-4 border border-gray-50 mb-4">
            <p className="text-xs font-semibold text-gray-400 mb-3">RECOMMENDED MACROS</p>
            <div className="space-y-3">
              <MacroRow label="Protein" value={result.protein} color="text-emerald-600" sub="Preserves muscle during weight loss" />
              <MacroRow label="Carbs" value={result.carbs} color="text-orange-500" sub="Fuels daily activity and exercise" />
              <MacroRow label="Fat" value={result.fat} color="text-amber-500" sub="Supports hormones and satiety" />
            </div>
          </div>

          {/* Meal split */}
          <div className="bg-white rounded-2xl p-4 border border-gray-50 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Utensils size={14} className="text-gray-400" />
              <p className="text-xs font-semibold text-gray-400">SUGGESTED MEAL CALORIE SPLIT</p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <MealSplitCol label="Breakfast" value={result.mealSplit.breakfast} />
              <MealSplitCol label="Lunch" value={result.mealSplit.lunch} />
              <MealSplitCol label="Dinner" value={result.mealSplit.dinner} />
              <MealSplitCol label="Snack" value={result.mealSplit.snack} />
            </div>
          </div>

          {/* Adjustment reminder */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3.5 mb-4">
            <p className="text-xs text-amber-800 leading-relaxed">
              💡 <strong>Note:</strong> This is an initial estimate calculated via the Mifflin-St Jeor equation. TDEE varies per individual. Weigh yourself weekly and adjust your calorie target if your progress stalls.
            </p>
          </div>

          <button
            onClick={onApply}
            className="w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
          >
            <Check size={18} /> Apply to my goals
          </button>
          <button
            onClick={() => setStep(6)}
            className="w-full text-gray-500 font-semibold py-3 rounded-2xl text-sm mt-2"
          >
            Back to deficit selection
          </button>
        </div>
      )}

      {/* Footer nav (hidden on deficit + results steps) */}
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
            Continue <ChevronRight size={18} />
          </button>
        </div>
      )}
    </Modal>
  );
}

function UnitToggle({ unit, onChange }: { unit: InputWeightUnit; onChange: (u: InputWeightUnit) => void }) {
  return (
    <div className="flex gap-2 mb-3">
      {(['kg', 'lb'] as InputWeightUnit[]).map((u) => (
        <button
          key={u}
          onClick={() => onChange(u)}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${unit === u ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-500'}`}
        >
          {u === 'kg' ? 'Kilograms' : 'Pounds'}
        </button>
      ))}
    </div>
  );
}

function NumberField({ value, onChange, unit, placeholder }: { value: string; onChange: (v: string) => void; unit: string; placeholder: string }) {
  return (
    <div className="flex items-center bg-gray-50 rounded-2xl px-4 py-4">
      <input
        autoFocus
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-2xl font-bold text-gray-900 outline-none"
      />
      <span className="text-sm font-semibold text-gray-400">{unit}</span>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, highlight }: { icon: React.ReactNode; label: string; value: number | string; sub: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-3.5 border ${highlight ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-50'}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs font-semibold text-gray-400">{label}</p>
      </div>
      <p className={`text-lg font-bold ${highlight ? 'text-emerald-700' : 'text-gray-900'}`}>{value}</p>
      <p className="text-[10px] text-gray-400">{sub}</p>
    </div>
  );
}

function MacroRow({ label, value, color, sub }: { label: string; value: number; color: string; sub: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <p className={`text-sm font-bold ${color}`}>{label} {value}g</p>
        <p className="text-[10px] text-gray-400">{sub}</p>
      </div>
    </div>
  );
}

function MealSplitCol({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-sm font-bold text-emerald-600">{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
