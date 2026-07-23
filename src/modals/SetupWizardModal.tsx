import { useState } from 'react';
import { useStore } from '@/store';
import { Modal } from '@/components/Modal';
import { unitToKg, kgToUnit } from '@/lib/units';
import type { WeightUnit } from '@/types';
import { Sparkles, Check, TrendingDown, TrendingUp } from 'lucide-react';

interface SetupWizardModalProps {
  open: boolean;
  onClose: () => void;
}

// Mifflin-St Jeor BMR (assumes moderate activity multiplier 1.4)
function calcBmr(weightKg: number): number {
  // Simplified average of male/female formulas
  return Math.round(10 * weightKg + 625 * 1.7 - 5 * 30 + 5);
}

// 1 kg body fat ≈ 7700 kcal; weekly target in kg → daily delta
function dailyDeficit(weeklyKg: number): number {
  return Math.round((weeklyKg * 7700) / 7);
}

export function SetupWizardModal({ open, onClose }: SetupWizardModalProps) {
  const { settings, updateSettings, weights } = useStore();

  const latestWeight = weights.length ? weights[weights.length - 1].weight : undefined;

  const [unit, setUnit] = useState<WeightUnit>(settings.weightUnit);
  const [currentWeight, setCurrentWeight] = useState(
    latestWeight ? kgToUnit(latestWeight, settings.weightUnit).toFixed(1) : '',
  );
  const [goalWeight, setGoalWeight] = useState(kgToUnit(settings.goalWeight, settings.weightUnit).toFixed(1));
  const [weeklyTarget, setWeeklyTarget] = useState(
    kgToUnit(Math.abs(settings.weeklyWeightTarget), settings.weightUnit).toFixed(2),
  );
  const [lose, setLose] = useState(settings.weeklyWeightTarget <= 0);
  const [result, setResult] = useState<{ calorieGoal: number; bmr: number; delta: number } | null>(null);

  const onCalculate = () => {
    const cw = unitToKg(parseFloat(currentWeight) || 0, unit);
    const gw = unitToKg(parseFloat(goalWeight) || 0, unit);
    const weeklyAbs = unitToKg(parseFloat(weeklyTarget) || 0, unit);

    if (cw <= 0 || gw <= 0) return;

    const bmr = calcBmr(cw);
    const delta = lose ? -dailyDeficit(Math.abs(weeklyAbs)) : dailyDeficit(Math.abs(weeklyAbs));
    // TDEE ≈ BMR × 1.4, then apply deficit/surplus
    const tdee = Math.round(bmr * 1.4);
    const calorieGoal = Math.max(1200, tdee + delta);

    setResult({ calorieGoal, bmr, delta });
  };

  const onSave = () => {
    if (!result) return;
    const gw = unitToKg(parseFloat(goalWeight) || 0, unit);
    const weeklyAbs = unitToKg(parseFloat(weeklyTarget) || 0, unit);
    updateSettings({
      calorieGoal: result.calorieGoal,
      goalWeight: gw,
      weeklyWeightTarget: lose ? -Math.abs(weeklyAbs) : Math.abs(weeklyAbs),
      weightUnit: unit,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Setup Wizard">
      <div className="flex items-center gap-2 bg-emerald-50 rounded-xl p-3 mb-4">
        <Sparkles size={16} className="text-emerald-600 flex-shrink-0" />
        <p className="text-xs text-emerald-700">Enter your details to calculate your daily calorie goal and target.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Weight unit</label>
          <div className="flex gap-2">
            {(['kg', 'lb'] as WeightUnit[]).map((u) => (
              <button key={u} onClick={() => setUnit(u)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${unit === u ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {u === 'kg' ? 'Kilograms' : 'Pounds'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Current weight</label>
            <div className="flex items-center bg-gray-50 rounded-xl px-3 py-2.5">
              <input type="number" inputMode="decimal" value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)} placeholder="0.0"
                className="flex-1 bg-transparent text-sm font-semibold text-gray-900 outline-none" />
              <span className="text-xs text-gray-400">{unit}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Goal weight</label>
            <div className="flex items-center bg-gray-50 rounded-xl px-3 py-2.5">
              <input type="number" inputMode="decimal" value={goalWeight}
                onChange={(e) => setGoalWeight(e.target.value)} placeholder="0.0"
                className="flex-1 bg-transparent text-sm font-semibold text-gray-900 outline-none" />
              <span className="text-xs text-gray-400">{unit}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Weekly weight target</label>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setLose(true)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${lose ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
              <TrendingDown size={15} /> Lose
            </button>
            <button onClick={() => setLose(false)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${!lose ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
              <TrendingUp size={15} /> Gain
            </button>
          </div>
          <div className="flex items-center bg-gray-50 rounded-xl px-3 py-2.5">
            <input type="number" inputMode="decimal" step="0.1" value={weeklyTarget}
              onChange={(e) => setWeeklyTarget(e.target.value)}
              className="flex-1 bg-transparent text-sm font-semibold text-gray-900 outline-none" />
            <span className="text-xs text-gray-400">{unit}/week</span>
          </div>
        </div>

        <button onClick={onCalculate}
          className="w-full bg-gray-900 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform">
          <Sparkles size={16} /> Calculate
        </button>

        {result && (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 space-y-3">
            <div className="text-center">
              <p className="text-xs text-gray-400 font-medium">Your daily calorie goal</p>
              <p className="text-4xl font-bold text-emerald-600 tabular-nums">{result.calorieGoal}</p>
              <p className="text-xs text-gray-400">kcal / day</p>
            </div>
            <div className="flex justify-center gap-4 text-xs">
              <div className="text-center">
                <p className="text-gray-400">Estimated BMR</p>
                <p className="font-bold text-gray-700">{result.bmr} kcal</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">Daily {lose ? 'deficit' : 'surplus'}</p>
                <p className={`font-bold ${lose ? 'text-emerald-600' : 'text-orange-500'}`}>
                  {Math.abs(result.delta)} kcal
                </p>
              </div>
            </div>
            <button onClick={onSave}
              className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform">
              <Check size={16} /> Save goals
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
