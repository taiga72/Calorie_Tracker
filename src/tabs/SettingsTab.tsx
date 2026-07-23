import { useState, useRef } from 'react';
import { useStore } from '@/store';
import type { WeightUnit } from '@/types';
import { unitToKg, kgToUnit } from '@/lib/units';
import { downloadCsv } from '@/lib/csv';
import { storage, type BackupPayload } from '@/lib/storage';
import { SetupWizardModal } from '@/modals/SetupWizardModal';
import { Modal } from '@/components/Modal';
import {
  Sparkles, Target, Check, Download, Upload, FileSpreadsheet,
  Trash2, AlertTriangle, ChevronRight, Flame, Scale,
} from 'lucide-react';

export function SettingsTab() {
  const { settings, updateSettings, meals, clearAll, importBackup } = useStore();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit-modal form state
  const displayGoal = kgToUnit(settings.goalWeight, settings.weightUnit);
  const displayWeekly = Math.abs(kgToUnit(settings.weeklyWeightTarget, settings.weightUnit));
  const [calorieGoal, setCalorieGoal] = useState(String(settings.calorieGoal));
  const [goalWeight, setGoalWeight] = useState(displayGoal.toFixed(1));
  const [weeklyTarget, setWeeklyTarget] = useState(displayWeekly.toFixed(2));
  const [lose, setLose] = useState(settings.weeklyWeightTarget <= 0);
  const [unit, setUnit] = useState<WeightUnit>(settings.weightUnit);
  const [saved, setSaved] = useState(false);

  const openGoals = () => {
    setCalorieGoal(String(settings.calorieGoal));
    setGoalWeight(kgToUnit(settings.goalWeight, settings.weightUnit).toFixed(1));
    setWeeklyTarget(Math.abs(kgToUnit(settings.weeklyWeightTarget, settings.weightUnit)).toFixed(2));
    setLose(settings.weeklyWeightTarget <= 0);
    setUnit(settings.weightUnit);
    setGoalsOpen(true);
  };

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
    setTimeout(() => { setSaved(false); setGoalsOpen(false); }, 900);
  };

  const onExportJson = () => {
    const payload = storage.exportBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calorie-counter-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as BackupPayload;
        if (!parsed || !Array.isArray(parsed.meals)) { alert('Invalid backup file.'); return; }
        importBackup(parsed);
        alert('Backup restored successfully.');
      } catch { alert('Could not read this backup file.'); }
    };
    reader.onerror = () => alert('Failed to read file.');
    reader.readAsText(file);
  };

  const onConfirmClear = () => { clearAll(); setConfirmOpen(false); };

  return (
    <div className="px-5 pt-6 pb-4">
      <p className="text-sm text-gray-400 font-medium">Personalize your plan</p>
      <h1 className="text-3xl font-bold text-gray-900 mt-0.5">Settings</h1>

      {/* Wizard banner */}
      <button onClick={() => setWizardOpen(true)}
        className="w-full bg-emerald-600 rounded-3xl p-4 mt-5 flex items-center gap-3 text-white text-left active:scale-[.99] transition-transform">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Sparkles size={20} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold">Setup Wizard</p>
          <p className="text-xs text-emerald-50">Calculate your calorie & weight goals</p>
        </div>
      </button>

      {/* Compact "Your goals" card — side-by-side summary, click to edit */}
      <button onClick={openGoals}
        className="w-full bg-white rounded-3xl p-5 shadow-sm border border-gray-50 mt-4 text-left active:scale-[.99] transition-transform">
        <div className="flex items-center gap-2 mb-3">
          <Target size={18} className="text-emerald-600" />
          <h2 className="text-sm font-bold text-gray-900">Your goals</h2>
          <ChevronRight size={16} className="text-gray-300 ml-auto" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Flame size={17} className="text-orange-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{settings.calorieGoal}</p>
              <p className="text-[10px] text-gray-400">kcal / day</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Scale size={17} className="text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 tabular-nums">
                {kgToUnit(settings.goalWeight, settings.weightUnit).toFixed(1)}
              </p>
              <p className="text-[10px] text-gray-400">{settings.weightUnit} goal</p>
            </div>
          </div>
        </div>
      </button>

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
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportJson(f); e.target.value = ''; }} />
          <ActionBtn onClick={() => fileRef.current?.click()} Icon={Upload} label="Import Backup (JSON)" sub="Restore state from a backup file" />
          <ActionBtn onClick={() => downloadCsv(meals)} Icon={FileSpreadsheet} label="Export CSV" sub={`${meals.length} meal${meals.length === 1 ? '' : 's'} — for Google Sheets`} disabled={meals.length === 0} />
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
        <button onClick={() => setConfirmOpen(true)}
          className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform">
          <Trash2 size={16} /> Clear All Data
        </button>
      </div>

      <p className="text-center text-[11px] text-gray-300 mt-6">All data is stored locally in your browser.</p>

      <SetupWizardModal open={wizardOpen} onClose={() => setWizardOpen(false)} />

      {/* Goals edit pop-up */}
      <Modal open={goalsOpen} onClose={() => setGoalsOpen(false)} title="Edit Your Goals">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Daily calorie goal</label>
            <div className="flex items-center bg-gray-50 rounded-xl px-3 py-2.5">
              <input type="number" inputMode="numeric" value={calorieGoal} onChange={(e) => setCalorieGoal(e.target.value)}
                className="flex-1 bg-transparent text-sm font-semibold text-gray-900 outline-none" />
              <span className="text-xs text-gray-400">kcal</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Goal weight</label>
            <div className="flex items-center bg-gray-50 rounded-xl px-3 py-2.5">
              <input type="number" inputMode="decimal" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)}
                className="flex-1 bg-transparent text-sm font-semibold text-gray-900 outline-none" />
              <span className="text-xs text-gray-400">{unit}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Weekly weight target</label>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setLose(true)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${lose ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-500'}`}>
                Lose
              </button>
              <button onClick={() => setLose(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${!lose ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-500'}`}>
                Gain
              </button>
            </div>
            <div className="flex items-center bg-gray-50 rounded-xl px-3 py-2.5">
              <input type="number" inputMode="decimal" step="0.1" value={weeklyTarget} onChange={(e) => setWeeklyTarget(e.target.value)}
                className="flex-1 bg-transparent text-sm font-semibold text-gray-900 outline-none" />
              <span className="text-xs text-gray-400">{unit}/week</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Weight unit</label>
            <div className="flex gap-2">
              {(['kg', 'lb'] as WeightUnit[]).map((u) => (
                <button key={u} onClick={() => setUnit(u)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${unit === u ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-500'}`}>
                  {u === 'kg' ? 'Kilograms' : 'Pounds'}
                </button>
              ))}
            </div>
          </div>

          <button onClick={onSaveGoals}
            className="w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform">
            {saved ? <><Check size={16} /> Saved</> : 'Save goals'}
          </button>
        </div>
      </Modal>

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
          <button onClick={() => setConfirmOpen(false)}
            className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3.5 rounded-2xl text-sm">
            Cancel
          </button>
          <button onClick={onConfirmClear}
            className="flex-1 bg-red-500 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2">
            <Trash2 size={16} /> Delete everything
          </button>
        </div>
      </Modal>
    </div>
  );
}

function ActionBtn({
  onClick, Icon, label, sub, disabled,
}: {
  onClick: () => void; Icon: typeof Download; label: string; sub: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-3.5 text-left disabled:opacity-40 active:scale-[.99] transition-transform">
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
