import { useState, useRef } from 'react';
import { useStore } from '@/store';
import type { WeightUnit } from '@/types';
import { unitToKg, kgToUnit } from '@/lib/units';
import { downloadCsv } from '@/lib/csv';
import { storage, type BackupPayload } from '@/lib/storage';
import { compressImage } from '@/lib/gemini';
import { SetupWizardModal } from '@/modals/SetupWizardModal';
import { Modal } from '@/components/Modal';
import {
  Sparkles, Target, Check, Download, Upload, FileSpreadsheet,
  Trash2, AlertTriangle, User, Camera, Flame, Activity, TrendingDown, Utensils,
} from 'lucide-react';

export function SettingsTab() {
  const { settings, updateSettings, updateProfile, profile, meals, clearAll, importBackup } = useStore();

  const displayCalorieGoal = settings.calorieGoal;
  const displayGoalWeight = kgToUnit(settings.goalWeight, settings.weightUnit);
  const displayWeekly = Math.abs(kgToUnit(settings.weeklyWeightTarget, settings.weightUnit));

  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState<string | undefined>(profile.avatar);
  const [profileSaved, setProfileSaved] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  const [calorieGoal, setCalorieGoal] = useState(String(displayCalorieGoal));
  const [goalWeight, setGoalWeight] = useState(displayGoalWeight.toFixed(1));
  const [weeklyTarget, setWeeklyTarget] = useState(displayWeekly.toFixed(2));
  const [lose, setLose] = useState(settings.weeklyWeightTarget <= 0);
  const [unit, setUnit] = useState<WeightUnit>(settings.weightUnit);
  const [saved, setSaved] = useState(false);

  const calc = settings.calc;
  const [protein, setProtein] = useState(String(calc?.recommendedMacros.protein ?? 0));
  const [carbs, setCarbs] = useState(String(calc?.recommendedMacros.carbs ?? 0));
  const [fat, setFat] = useState(String(calc?.recommendedMacros.fat ?? 0));
  const [breakfast, setBreakfast] = useState(String(calc?.suggestedMealSplit.breakfast ?? 0));
  const [lunch, setLunch] = useState(String(calc?.suggestedMealSplit.lunch ?? 0));
  const [dinner, setDinner] = useState(String(calc?.suggestedMealSplit.dinner ?? 0));
  const [snack, setSnack] = useState(String(calc?.suggestedMealSplit.snack ?? 0));
  const [wizardOpen, setWizardOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickAvatar = async (file: File) => {
    try {
      const { dataUrl } = await compressImage(file);
      setAvatar(dataUrl);
    } catch {
      // ignore — keep previous avatar
    }
  };

  const onSaveProfile = () => {
    updateProfile({ name: name.trim(), avatar });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 1800);
  };

  const onSaveGoals = () => {
    const gWeight = unitToKg(parseFloat(goalWeight) || 0, unit);
    const weeklyAbs = unitToKg(parseFloat(weeklyTarget) || 0, unit);
    const newCalorieGoal = Math.max(0, parseInt(calorieGoal) || 0);
    const deficit = calc ? newCalorieGoal - calc.tdee : 0;
    updateSettings({
      calorieGoal: newCalorieGoal,
      goalWeight: gWeight,
      weeklyWeightTarget: lose ? -Math.abs(weeklyAbs) : Math.abs(weeklyAbs),
      weightUnit: unit,
      calc: calc ? {
        ...calc,
        dailyDeficit: deficit,
        recommendedMacros: {
          protein: Math.max(0, parseInt(protein) || 0),
          carbs: Math.max(0, parseInt(carbs) || 0),
          fat: Math.max(0, parseInt(fat) || 0),
        },
        suggestedMealSplit: {
          breakfast: Math.max(0, parseInt(breakfast) || 0),
          lunch: Math.max(0, parseInt(lunch) || 0),
          dinner: Math.max(0, parseInt(dinner) || 0),
          snack: Math.max(0, parseInt(snack) || 0),
        },
      } : null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const onExportJson = () => {
    const payload = storage.exportBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `calorie-counter-backup-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as BackupPayload;
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.meals)) {
          alert('Invalid backup file.');
          return;
        }
        importBackup(parsed);
        alert('Backup restored successfully.');
      } catch {
        alert('Could not read this backup file.');
      }
    };
    reader.onerror = () => alert('Failed to read file.');
    reader.readAsText(file);
  };

  const onExportCsv = () => {
    downloadCsv(meals);
  };

  const onConfirmClear = () => {
    clearAll();
    setConfirmOpen(false);
  };

  return (
    <div className="px-5 pt-6 pb-4">
      <p className="text-sm text-gray-400 font-medium">Personalize your plan</p>
      <h1 className="text-3xl font-bold text-gray-900 mt-0.5">Settings</h1>

      {/* Profile card */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50 mt-5">
        <div className="flex items-center gap-2 mb-4">
          <User size={18} className="text-emerald-600" />
          <h2 className="text-sm font-bold text-gray-900">Profile</h2>
        </div>
        <div className="flex flex-col items-center mb-4">
          <button
            onClick={() => avatarRef.current?.click()}
            className="relative w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden active:scale-95 transition-transform"
          >
            {avatar ? (
              <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <Camera size={24} className="text-gray-400" />
            )}
          </button>
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickAvatar(f); e.target.value = ''; }}
          />
          <button
            onClick={() => avatarRef.current?.click()}
            className="text-xs font-semibold text-emerald-600 mt-2"
          >
            {avatar ? 'Change photo' : 'Upload photo'}
          </button>
          {avatar && (
            <button
              onClick={() => setAvatar(undefined)}
              className="text-xs text-gray-400 mt-1"
            >
              Remove
            </button>
          )}
        </div>
        <Field label="Display name">
          <div className="flex items-center bg-gray-50 rounded-xl px-3 py-2.5">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={40}
              className="flex-1 bg-transparent text-sm font-semibold text-gray-900 outline-none"
            />
          </div>
        </Field>
        <button
          onClick={onSaveProfile}
          className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl text-sm mt-4 active:scale-[.99] transition-transform flex items-center justify-center gap-2"
        >
          {profileSaved ? <><Check size={16} /> Saved</> : 'Save profile'}
        </button>
      </div>

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

          {calc && (
            <>
              {/* Summary stats row */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                <SummaryStat icon={<Flame size={12} className="text-orange-500" />} label="BMR" value={calc.bmr} />
                <SummaryStat icon={<Activity size={12} className="text-blue-500" />} label="TDEE" value={calc.tdee} />
                <SummaryStat
                  icon={<TrendingDown size={12} className={calc.dailyDeficit < 0 ? 'text-red-500' : 'text-emerald-500'} />}
                  label="Deficit"
                  value={calc.dailyDeficit > 0 ? `+${calc.dailyDeficit}` : calc.dailyDeficit}
                />
                <SummaryStat
                  icon={<Target size={12} className="text-emerald-600" />}
                  label="Goal"
                  value={calc.estimatedGoalDate ? new Date(calc.estimatedGoalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  isText
                />
              </div>

              {/* Macro breakdown */}
              <div className="bg-gray-50 rounded-2xl p-4 mt-1">
                <div className="flex items-center gap-2 mb-3">
                  <Activity size={14} className="text-gray-400" />
                  <p className="text-xs font-semibold text-gray-400">MACRO BREAKDOWN</p>
                </div>
                <div className="space-y-3">
                  <MacroField label="Protein" value={protein} onChange={setProtein} color="text-emerald-600" sub="Preserves muscle" />
                  <MacroField label="Carbs" value={carbs} onChange={setCarbs} color="text-orange-500" sub="Fuels activity" />
                  <MacroField label="Fat" value={fat} onChange={setFat} color="text-amber-500" sub="Hormones & satiety" />
                </div>
              </div>

              {/* Meal calorie split */}
              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Utensils size={14} className="text-gray-400" />
                  <p className="text-xs font-semibold text-gray-400">MEAL CALORIE SPLIT</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MacroField label="Breakfast" value={breakfast} onChange={setBreakfast} color="text-emerald-600" sub="kcal" compact />
                  <MacroField label="Lunch" value={lunch} onChange={setLunch} color="text-emerald-600" sub="kcal" compact />
                  <MacroField label="Dinner" value={dinner} onChange={setDinner} color="text-emerald-600" sub="kcal" compact />
                  <MacroField label="Snack" value={snack} onChange={setSnack} color="text-emerald-600" sub="kcal" compact />
                </div>
              </div>
            </>
          )}

          <button
            onClick={onSaveGoals}
            className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl text-sm active:scale-[.99] transition-transform flex items-center justify-center gap-2"
          >
            {saved ? <><Check size={16} /> Saved</> : 'Save goals'}
          </button>
        </div>
      </div>

      {/* Backup & Export */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet size={18} className="text-emerald-600" />
          <h2 className="text-sm font-bold text-gray-900">Backup & Export</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Back up your full data for transferring between devices, or export meal logs as a CSV for Google Sheets or Excel.
        </p>
        <div className="space-y-2.5">
          <ActionBtn onClick={onExportJson} Icon={Download} label="Export Backup (JSON)" sub="Full state — restore on any device" />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportJson(f); e.target.value = ''; }}
          />
          <ActionBtn onClick={() => fileRef.current?.click()} Icon={Upload} label="Import Backup (JSON)" sub="Restore state from a backup file" />
          <ActionBtn onClick={onExportCsv} Icon={FileSpreadsheet} label="Export CSV" sub={`${meals.length} meal${meals.length === 1 ? '' : 's'} — for Google Sheets`} disabled={meals.length === 0} />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-red-100 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={18} className="text-red-500" />
          <h2 className="text-sm font-bold text-red-600">Danger Zone</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Permanently delete all meal logs, weight history, and reset settings to defaults. This cannot be undone.
        </p>
        <button
          onClick={() => setConfirmOpen(true)}
          className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
        >
          <Trash2 size={16} /> Clear All Data
        </button>
      </div>

      <p className="text-center text-[11px] text-gray-300 mt-6">
        All data is stored locally in your browser.
      </p>

      <SetupWizardModal open={wizardOpen} onClose={() => setWizardOpen(false)} />

      {/* Clear-all confirmation */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Clear all data?">
        <div className="flex items-start gap-3 bg-red-50 rounded-2xl p-3 mb-4">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">
            Are you sure you want to delete all meal logs, weight history, and custom settings?
          </p>
        </div>
        <p className="text-xs text-gray-400 mb-5">This action is permanent and cannot be undone.</p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmOpen(false)}
            className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3.5 rounded-2xl text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmClear}
            className="flex-1 bg-red-500 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2"
          >
            <Trash2 size={16} /> Delete everything
          </button>
        </div>
      </Modal>
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

function ActionBtn({
  onClick, Icon, label, sub, disabled,
}: {
  onClick: () => void;
  Icon: typeof Download;
  label: string;
  sub: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-3.5 text-left disabled:opacity-40 active:scale-[.99] transition-transform"
    >
      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
        <Icon size={17} className="text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </button>
  );
}

function SummaryStat({ icon, label, value, isText }: { icon: React.ReactNode; label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="bg-white rounded-xl p-2.5 border border-gray-50 text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        {icon}
        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`font-bold text-gray-900 ${isText ? 'text-[11px]' : 'text-sm'}`}>{value}</p>
    </div>
  );
}

function MacroField({
  label,
  value,
  onChange,
  color,
  sub,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  color: string;
  sub?: string;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-semibold ${color}`}>{label}</span>
        {/* Only render header subtext if explicitly NOT in compact mode */}
        {!compact && sub && <span className="text-[10px] text-gray-400">{sub}</span>}
      </div>
      <div className="flex items-center bg-white rounded-xl px-3 py-2 border border-gray-100">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`flex-1 bg-transparent font-bold text-gray-900 outline-none ${
            compact ? 'text-sm' : 'text-base'
          }`}
        />
        <span className="text-[10px] font-semibold text-gray-400">
          {compact ? 'kcal' : 'g'}
        </span>
      </div>
    </div>
  );
}
