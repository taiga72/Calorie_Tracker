import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  calculateTargets,
  ACTIVITY_LABELS,
  GOAL_LABELS,
} from '@/lib/nutrition';
import type {
  BiologicalSex,
  ActivityLevel,
  TargetGoal,
} from '@/types';

const SEXES: { value: BiologicalSex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const ACTIVITIES = Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][];
const GOALS = Object.entries(GOAL_LABELS) as [TargetGoal, string][];

export function SetupWizard() {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [sex, setSex] = useState<BiologicalSex>('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('moderately_active');
  const [goal, setGoal] = useState<TargetGoal>('maintain');
  const [error, setError] = useState<string | null>(null);

  const steps = ['About You', 'Body Metrics', 'Activity & Goal'];
  const canNext =
    step === 0 ||
    (step === 1 && age && height && weight) ||
    step === 2;

  const handleFinish = async () => {
    setError(null);
    setSaving(true);
    try {
      const ageNum = parseInt(age, 10);
      const heightNum = parseFloat(height);
      const weightNum = parseFloat(weight);
      if (!ageNum || !heightNum || !weightNum) {
        setError('Please enter valid numbers for age, height, and weight.');
        setSaving(false);
        return;
      }
      const targets = calculateTargets(weightNum, heightNum, ageNum, sex, activity, goal);

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: user!.id,
          display_name: user!.user_metadata?.full_name || user!.email?.split('@')[0] || 'User',
          avatar_url: user!.user_metadata?.avatar_url || null,
          biological_sex: sex,
          age: ageNum,
          height_cm: heightNum,
          current_weight_kg: weightNum,
          activity_level: activity,
          target_goal: goal,
          target_daily_calories: targets.targetCalories,
          target_protein_g: targets.protein,
          target_carbs_g: targets.carbs,
          target_fat_g: targets.fat,
          setup_complete: true,
        });

      if (upsertError) throw upsertError;

      // Log initial weight
      await supabase.from('weight_logs').insert({
        weight_kg: weightNum,
        logged_at: new Date().toISOString(),
      });

      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const previewTargets = () => {
    const ageNum = parseInt(age, 10);
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    if (!ageNum || !heightNum || !weightNum) return null;
    return calculateTargets(weightNum, heightNum, ageNum, sex, activity, goal);
  };

  const targets = step >= 2 ? previewTargets() : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500 mb-3 shadow-lg shadow-primary-500/30">
            <span className="text-white font-bold text-xl">M</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Welcome to MacroFlow</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Let's set up your nutrition profile</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  i === step
                    ? 'bg-primary-500 text-white'
                    : i < step
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                }`}
              >
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                  {i + 1}
                </span>
                {label}
              </div>
              {i < steps.length - 1 && <div className="w-4 h-px bg-gray-200 dark:bg-gray-600" />}
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Biological Sex
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {SEXES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setSex(s.value)}
                      className={`py-3.5 rounded-2xl text-sm font-medium transition-all ${
                        sex === s.value
                          ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  Used for the Mifflin-St Jeor BMR equation.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Age (years)
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 28"
                  className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Height (cm)
                </label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="e.g. 175"
                  className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g. 72.5"
                  className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Activity Level
                </label>
                <div className="space-y-2">
                  {ACTIVITIES.map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setActivity(value)}
                      className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                        activity === value
                          ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target Goal
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GOALS.map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setGoal(value)}
                      className={`py-3.5 rounded-2xl text-xs font-medium transition-all ${
                        goal === value
                          ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {targets && (
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide">
                    Your Calculated Targets
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="BMR" value={`${targets.bmr}`} unit="kcal" />
                    <Stat label="TDEE" value={`${targets.tdee}`} unit="kcal" />
                    <Stat label="Daily Calories" value={`${targets.targetCalories}`} unit="kcal" />
                    <Stat label="Protein" value={`${targets.protein}`} unit="g" />
                    <Stat label="Carbs" value={`${targets.carbs}`} unit="g" />
                    <Stat label="Fat" value={`${targets.fat}`} unit="g" />
                  </div>
                  <p className="text-xs text-primary-600 dark:text-primary-400">
                    Based on the Mifflin-St Jeor equation. Targets will be saved to your profile.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          )}

          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || saving}
              className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 transition-colors"
            >
              Back
            </button>
            {step < 2 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext}
                className="px-6 py-3 bg-primary-500 text-white font-semibold rounded-2xl text-sm hover:bg-primary-600 transition-colors disabled:opacity-40"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={saving}
                className="px-6 py-3 bg-primary-500 text-white font-semibold rounded-2xl text-sm hover:bg-primary-600 transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Start Tracking'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
        {value}
        <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-1">{unit}</span>
      </p>
    </div>
  );
}
