import { useState } from 'react';
import { useStore } from '@/store';
import type { WeightUnit } from '@/types';
import { unitToKg, kgToUnit } from '@/lib/units';
import { downloadCsv } from '@/lib/csv';
import { SetupWizardModal } from '@/modals/SetupWizardModal';
import { Sparkles, Target, Check, Download, FileSpreadsheet } from 'lucide-react';

export function SettingsTab() {
  const { settings, updateSettings, meals } = useStore();

  const displayCalorieGoal = settings.calorieGoal;
  const displayGoalWeight = kgToUnit(settings.goalWeight, settings.weightUnit);
  const displayWeekly = Math.abs(kgToUnit(settings.weeklyWeightTarget, settings.weightUnit));

  const [calorieGoal, setCalorieGoal] = useState(String(displayCalorieGoal));
  const [goalWeight, setGoalWeight] = useState(displayGoalWeight.toFixed(1));
  const [weeklyTarget, setWeeklyTarget] = useState(displayWeekly.toFixed(2));
  const [lose, setLose] = useState(settings.weeklyWeightTarget <= 0);
  const [unit, setUnit] = useState<WeightUnit>(settings.weightUnit);
  const [saved, setSaved] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const onSaveGoals = () => {
    const gWeight = unitToKg(parseFloat(goalWeight) || 0, unit);
    const weeklyAbs = unitToKg(parseFloat(weeklyTarget) || 0, unit);
    updateSettings({
      calorieGoal: Math.max(0, parseInt(calorieGoal) || 0),
      goalWeight: gWeight,
      weeklyWeightTarget: lose ? -Math.abs(weeklyAbs) : Math.abs(weeklyAbs),
      weightUnit: unit,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const onExport = () => {
    downloadCsv(meals);
  };

  return (
    <div className="px-5 pt-6 pb-4">
      <p className="text-sm text-gray-400 font-medium">Personalize your plan</p>
      <h1 className="text-3xl font-bold text-gray-900 mt-0.5">Settings</h1>

      {/* Wizard banner */}
      <button
        onClick={() => setWizardOpen(true)}
        className="w-full bg-emerald-600 rounded-3xl p-4 mt-5 flex items-center gap-3 text-white text-left active:scale-[.99] transition-transform"
      >
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Sparkles size={20} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold">Setup Wizard</p>
          <p className="text-xs text-emerald-50">Calculate your calorie & weight goals</p>
        </div>
      </button>

      {/* Goals card */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <Target size={18} className="text-emerald-600" />
          <h2 className="text-sm font-bold text-gray-900">Your goals</h2>
        </div>

        <div className="space-y-4">
          <Field label="Daily calorie goal">
            <div className="flex items-center bg-gray-50 rounded-xl px-3 py-2.5">
              <input
                type="number"
                inputMode="numeric"
                value={calorieGoal}
                onChange={(e) => setCalorieGoal(e.target.value)}
                className="flex-1 bg-transparent text-sm font-semibold text-gray-900 outline-none"
              />
              <span className="text-xs text-gray-400">kcal</span>
            </div>
          </Field>

          <Field label="Goal weight">
            <div className="flex items-center bg-gray-50 rounded-xl px-3 py-2.5">
              <input
                type="number"
                inputMode="decimal"
                value={goalWeight}
                onChange={(e) => setGoalWeight(e.target.value)}
                className="flex-1 bg-transparent text-sm font-semibold text-gray-900 outline-none"
              />
              <span className="text-xs text-gray-400">{unit}</span>
            </div>
          </Field>

          <Field label="Weekly weight target">
            <div className="flex gap-2">
              <button
                onClick={() => setLose(true)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${lose ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-500'}`}
              >
                Lose
              </button>
              <button
                onClick={() => setLose(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${!lose ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-500'}`}
              >
                Gain
              </button>
            </div>
            <div className="flex items-center bg-gray-50 rounded-xl px-3 py-2.5 mt-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={weeklyTarget}
                onChange={(e) => setWeeklyTarget(e.target.value)}
                className="flex-1 bg-transparent text-sm font-semibold text-gray-900 outline-none"
              />
              <span className="text-xs text-gray-400">{unit}/week</span>
            </div>
          </Field>

          <Field label="Weight unit">
            <div className="flex gap-2">
              {(['kg', 'lb'] as WeightUnit[]).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${unit === u ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-500'}`}
                >
                  {u === 'kg' ? 'Kilograms' : 'Pounds'}
                </button>
              ))}
            </div>
          </Field>

          <button
            onClick={onSaveGoals}
            className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl text-sm active:scale-[.99] transition-transform flex items-center justify-center gap-2"
          >
            {saved ? <><Check size={16} /> Saved</> : 'Save goals'}
          </button>
        </div>
      </div>

      {/* CSV export */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet size={18} className="text-emerald-600" />
          <h2 className="text-sm font-bold text-gray-900">Export your data</h2>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Download a CSV of all logged meals, ready to import into Google Sheets.
        </p>
        <button
          onClick={onExport}
          disabled={meals.length === 0}
          className="w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[.99] transition-transform"
        >
          <Download size={16} /> Export {meals.length > 0 ? `(${meals.length} meals)` : 'CSV'}
        </button>
      </div>

      <p className="text-center text-[11px] text-gray-300 mt-6">
        All data is stored locally in your browser.
      </p>

      <SetupWizardModal open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-400 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
