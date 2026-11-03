import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store';
import { useAutoSave } from '@/lib/useAutoSave';
import { ProteinTarget } from '@/components/ProteinTarget';
import type { SettingsSection } from '@/lib/settingsLauncher';
import type { WeightUnit } from '@/types';
import { unitToKg, kgToUnit, convertWeightText } from '@/lib/units';
import { downloadCsv, downloadWeightsCsv, downloadWorkoutsCsv } from '@/lib/csv';
import { useTheme, type ThemePreference } from '@/lib/theme';
import { parseAppearance, readAppearance } from '@/lib/appearance';
import { loadReminderConfig, saveReminderConfig, type ReminderConfig } from '@/lib/reminders';
import { formatRelativeTime, todayKey } from '@/lib/dateUtils';
import type { BackupPayload } from '@/lib/storage';
import { compressImage } from '@/lib/gemini';
import { SetupWizardModal } from '@/modals/SetupWizardModal';
import { Modal } from '@/components/Modal';
import { RemindersSection } from '@/components/RemindersSection';
import { HealthSection } from '@/components/HealthSection';
import { AppearanceSection } from '@/components/AppearanceSection';
import { useUndoToast } from '@/components/UndoToastProvider';
import { useHorizontalSwipe } from '@/lib/useHorizontalSwipe';
import { AccountSection, DeleteAccountButton } from '@/components/AccountSection';
import { LayoutSection } from '@/components/LayoutSection';
import { GoalPlanSection } from '@/components/GoalPlanSection';
import { CoachMemorySection } from '@/components/CoachMemory';
import { phaseOn } from '@/lib/goalPlan';
import { photoStorageAvailable } from '@/lib/photoStorage';
import {
  Sparkles, Target, Check, Download, Upload, FileSpreadsheet,
  Trash2, AlertTriangle, User, Camera, Activity, Utensils,
  ChevronDown, ChevronUp, RefreshCw, Info,
} from 'lucide-react';

type Page = 'goals' | 'app' | 'account';
const PAGES: { key: Page; label: string; sub: string }[] = [
  { key: 'goals', label: 'Goals', sub: 'Your goals and plan' },
  { key: 'app', label: 'App', sub: 'Reminders, Health, coach and look' },
  { key: 'account', label: 'Account', sub: 'Profile, data and sign-in' },
];

const SECTION: Record<SettingsSection, { page: Page; id: string }> = {
  goalPlan: { page: 'goals', id: 'settings-goal-plan' },
};

/** `focus`: a section to open at (see lib/settingsLauncher); `onFocused` once it's shown. */
export function SettingsTab({ focus, onFocused }: { focus?: SettingsSection | null; onFocused?: () => void } = {}) {
  const { notify } = useUndoToast();
  const [page, setPage] = useState<Page>(focus ? SECTION[focus].page : 'goals');
  useEffect(() => {
    if (!focus) return;
    setPage(SECTION[focus].page);
    // After the page has rendered.
    const t = setTimeout(() => {
      document.getElementById(SECTION[focus].id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      onFocused?.();
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);
  const [slideFrom, setSlideFrom] = useState<'left' | 'right' | null>(null);
  const goToPage = (next: Page) => {
    if (next === page) return;
    const order = PAGES.map((x) => x.key);
    setSlideFrom(order.indexOf(next) > order.indexOf(page) ? 'right' : 'left');
    setPage(next);
  };
  const step = (d: 1 | -1) => {
    const order = PAGES.map((x) => x.key);
    const next = order[order.indexOf(page) + d];
    if (next) goToPage(next);
  };
  // Swipe between pages; fields, sliders and rows keep their own gestures.
  const { dragX, handlers: swipeHandlers } = useHorizontalSwipe({
    onSwipeLeft: () => step(1),
    onSwipeRight: () => step(-1),
    ignoreSelector: 'input, textarea, select, [data-swipe-row]',
  });

  const {
    settings, updateSettings, updateProfile, profile, meals, weights, workouts, clearAll, importBackup, prepareExport,
    lastSyncedAt, refreshing, pinsSyncEnabled, prefsSyncEnabled,
  } = useStore();
  const activePhase = phaseOn(settings, todayKey());
  const [, setTick] = useState(0);

  // Keeps the "Last synced Xm ago" text fresh without needing a user action.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const setupComplete = !!settings.calc;

  const latestWeightKg = weights.length > 0
    ? [...weights].sort((a, b) => b.date.localeCompare(a.date))[0].weight
    : undefined;

  const displayCalorieGoal = settings.calorieGoal;
  const displayGoalWeight = kgToUnit(settings.goalWeight, settings.weightUnit);
  const displayWeekly = Math.abs(kgToUnit(settings.weeklyWeightTarget, settings.weightUnit));

  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState<string | undefined>(profile.avatar);
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
  const [expanded, setExpanded] = useState(false);
  const [liveDeficit, setLiveDeficit] = useState(calc?.dailyDeficit ?? 0);
  const [liveGoalDate, setLiveGoalDate] = useState<string | null>(calc?.estimatedGoalDate ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-calculate macros, deficit, and goal date when the calorie goal or
  // goal weight is changed here (not on opening: that would replace saved
  // macros with calculated ones, which auto-save would then keep).
  const recalcReady = useRef(false);
  useEffect(() => {
    if (!recalcReady.current) { recalcReady.current = true; return; }
    if (!calc) return;
    const newCal = Math.max(0, parseInt(calorieGoal) || 0);
    const deficit = newCal - calc.tdee;
    setLiveDeficit(deficit);

    const weightKg = latestWeightKg ?? 70;
    const proteinG = Math.round(weightKg * 1.6);
    const fatG = Math.round((newCal * 0.25) / 9);
    const carbsG = Math.max(0, Math.round((newCal - proteinG * 4 - fatG * 9) / 4));
    setProtein(String(proteinG));
    setFat(String(fatG));
    setCarbs(String(carbsG));

    setBreakfast(String(Math.round(newCal * 0.25)));
    setLunch(String(Math.round(newCal * 0.3)));
    setDinner(String(Math.round(newCal * 0.3)));
    setSnack(String(Math.round(newCal * 0.15)));

    const goalWeightKg = unitToKg(parseFloat(goalWeight) || 0, unit);
    const totalDeltaKg = Math.abs(goalWeightKg - weightKg);
    const weeklyRate = Math.abs(settings.weeklyWeightTarget);
    if (weeklyRate > 0 && totalDeltaKg > 0.01) {
      const weeks = Math.ceil(totalDeltaKg / weeklyRate);
      const date = new Date();
      date.setDate(date.getDate() + weeks * 7);
      setLiveGoalDate(date.toISOString());
    } else {
      setLiveGoalDate(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calorieGoal, goalWeight]);

  const onPickAvatar = async (file: File) => {
    try {
      const { dataUrl } = await compressImage(file);
      setAvatar(dataUrl);
    } catch {
      // ignore — keep previous avatar
    }
  };

  // Saved as you go, like iOS Settings.
  useAutoSave(() => updateProfile({ name: name.trim(), avatar }), [name, avatar]);

  const onSaveGoals = () => {
    // Half-typed or cleared: wait for a usable number.
    if (!(parseInt(calorieGoal) > 0) || !(parseFloat(goalWeight) > 0)) return;
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
        estimatedGoalDate: liveGoalDate,
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
  useAutoSave(onSaveGoals, [calorieGoal, goalWeight, weeklyTarget, lose, unit, protein, carbs, fat, breakfast, lunch, dinner, snack]);
  // kg ↔ lb: the typed weights follow, so 70 kg doesn't become 70 lb.
  const switchUnit = (next: WeightUnit) => {
    if (next === unit) return;
    setGoalWeight((v) => convertWeightText(v, unit, next, 1));
    setWeeklyTarget((v) => convertWeightText(v, unit, next, 2));
    setUnit(next);
  };

  const [exporting, setExporting] = useState(false);
  const { preference: themePreference, setPreference, setAppearance } = useTheme();
  // Bumped after a restore so the reminders section shows the restored times.
  const [restoreCount, setRestoreCount] = useState(0);

  const onExportJson = async () => {
    // Photos load on demand, so fetch any not loaded yet: the backup is the
    // same complete file as before.
    setExporting(true);
    const { payload: data, missingPhotos } = await prepareExport();
    setExporting(false);
    // This device's own settings too, so a restore on a new phone looks and reminds the same.
    const payload: BackupPayload = { ...data, device: { appearance: readAppearance(), theme: themePreference, reminders: loadReminderConfig() } };
    if (missingPhotos && !window.confirm("Some meal photos couldn't be downloaded (you may be offline). Export the backup without them?")) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `calorie-tracker-backup-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const restoreDeviceSettings = (device: BackupPayload['device']) => {
    if (!device) return;
    if (device.appearance) setAppearance(parseAppearance(device.appearance));
    if (device.theme === 'light' || device.theme === 'dark' || device.theme === 'system') setPreference(device.theme as ThemePreference);
    const r = device.reminders as Partial<ReminderConfig> | undefined;
    if (r?.slots) {
      // Times only: notifications stay as allowed (or not) on this phone.
      const current = loadReminderConfig();
      saveReminderConfig({ enabled: current.enabled, slots: { ...current.slots, ...r.slots } });
      setRestoreCount((n) => n + 1);
    }
  };

  const onImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as BackupPayload;
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.meals)) {
          notify("That file isn't a Tally backup.", 'error');
          return;
        }
        importBackup(parsed);
        restoreDeviceSettings(parsed.device);
        notify('Backup restored.');
      } catch {
        notify("Couldn't read this backup file.", 'error');
      }
    };
    reader.onerror = () => notify("Couldn't open the file.", 'error');
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
      <p className="text-sm text-gray-400 font-medium">{PAGES.find((x) => x.key === page)!.sub}</p>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-0.5">Settings</h1>

      {/* Page switcher (also swipeable), like Statistics */}
      <div role="tablist" aria-label="Settings pages" className="seg relative grid grid-cols-3 gap-0 mt-5">
        <span
          aria-hidden
          className="absolute top-[3px] bottom-[3px] left-[3px] w-[calc((100%-6px)/3)] rounded-full bg-white dark:bg-[#636366] shadow-[0_3px_8px_rgb(0_0_0/.12),0_3px_1px_rgb(0_0_0/.04)] transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${PAGES.findIndex((x) => x.key === page) * 100}%)` }}
        />
        {PAGES.map((x) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={page === x.key}
            onClick={() => goToPage(x.key)}
            className={`relative z-10 py-1.5 rounded-full text-[13px] transition-colors ${page === x.key ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-600 dark:text-gray-300'}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div
        {...swipeHandlers}
        className="touch-pan-y min-h-[60vh]"
        style={{ transform: dragX ? `translateX(${dragX * 0.3}px)` : undefined, transition: dragX ? 'none' : 'transform .2s ease' }}
      >
      <div
        key={page}
        className={`motion-reduce:animate-none ${slideFrom === 'right' ? 'animate-[calSlideFromRight_.22s_ease-out]' : slideFrom === 'left' ? 'animate-[calSlideFromLeft_.22s_ease-out]' : ''}`}
      >
      {page === 'goals' && (
        <>
      {/* Goals card */}
      <div className="card p-5 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <Target size={18} className="text-accent-600" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Your goals</h2>
          <span role="status" className={`ml-auto flex items-center gap-1 text-11 font-semibold text-accent-600 transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`}>
            <Check size={12} /> Saved
          </span>
        </div>
        {activePhase && (
          <p className="text-11 text-accent-700 dark:text-accent-300 bg-accent-50 dark:bg-accent-950 rounded-xl px-3 py-2 -mt-2 mb-3">
            Your {activePhase.name} phase sets today's goal ({activePhase.calorieGoal.toLocaleString()} kcal). The goal below applies outside your phases — see Goal plan.
          </p>
        )}

        {!setupComplete ? (
          /* Empty state for new users */
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-14 h-14 rounded-full bg-accent-50 dark:bg-accent-950 flex items-center justify-center mb-3">
              <Sparkles size={24} className="text-accent-600" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">No goals set yet</p>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed px-4">
              Answer a few quick questions to get your personal calorie target, macros and an estimated goal date.
            </p>
            <button
              onClick={() => setWizardOpen(true)}
              className="bg-accent-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 active:scale-[.99] transition-transform"
            >
              <Sparkles size={16} /> Start goal setup
            </button>
          </div>
        ) : (
          <>
            {/* Summary pills — always visible */}
            <div className="grid grid-cols-4 gap-2 mb-1">
              <SummaryStat label="At rest" value={calc!.bmr} />
              <SummaryStat label="Daily burn" value={calc!.tdee} />
              <SummaryStat
                label={liveDeficit > 0 ? 'Surplus' : 'Deficit'}
                value={Math.abs(liveDeficit)}
              />
              <SummaryStat
                label="Goal by"
                value={liveGoalDate ? new Date(liveGoalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                isText
              />
            </div>
            {/* What the numbers mean, in plain words. */}
            <details className="mb-1 mt-2 group">
              <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center justify-center gap-1 text-11 font-semibold text-gray-400 cursor-pointer">
                <Info size={12} /> What do these mean?
              </summary>
              <dl className="mt-2 space-y-1.5 text-11 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <div><dt className="inline font-semibold text-gray-700 dark:text-gray-200">At rest</dt> <dd className="inline">— calories your body burns doing nothing at all (BMR).</dd></div>
                <div><dt className="inline font-semibold text-gray-700 dark:text-gray-200">Daily burn</dt> <dd className="inline">— what you burn on a normal day, including movement (TDEE). Eating this much keeps your weight steady.</dd></div>
                <div><dt className="inline font-semibold text-gray-700 dark:text-gray-200">{liveDeficit > 0 ? 'Surplus' : 'Deficit'}</dt> <dd className="inline">— how far your daily goal is {liveDeficit > 0 ? 'above' : 'below'} your daily burn; that gap is what changes your weight.</dd></div>
                <div><dt className="inline font-semibold text-gray-700 dark:text-gray-200">Goal by</dt> <dd className="inline">— when you'd reach your goal weight at this pace.</dd></div>
              </dl>
            </details>

            {/* Toggle button */}
            <button
              onClick={() => setExpanded((e) => !e)}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 py-2.5 mt-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {expanded ? (
                <><ChevronUp size={16} /> Hide details</>
              ) : (
                <><ChevronDown size={16} /> Edit goals and details</>
              )}
            </button>

            {/* Collapsible section */}
            {expanded && (
              <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-gray-800 mt-1">
                <Field label="Daily calorie goal">
                  <div className="field-box flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={calorieGoal}
                      onChange={(e) => setCalorieGoal(e.target.value)}
                      className="flex-1 bg-transparent text-sm font-semibold text-gray-900 dark:text-white outline-none"
                    />
                    <span className="text-xs text-gray-400">kcal</span>
                  </div>
                </Field>

                <Field label="Goal weight">
                  <div className="field-box flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={goalWeight}
                      onChange={(e) => setGoalWeight(e.target.value)}
                      className="flex-1 bg-transparent text-sm font-semibold text-gray-900 dark:text-white outline-none"
                    />
                    <span className="text-xs text-gray-400">{unit}</span>
                  </div>
                </Field>

                <Field label="Weekly weight target">
                  <div className="seg">
                    <button
                      onClick={() => setLose(true)}
                      aria-pressed={lose}
                      className="seg-item"
                    >
                      Lose
                    </button>
                    <button
                      onClick={() => setLose(false)}
                      aria-pressed={!lose}
                      className="seg-item"
                    >
                      Gain
                    </button>
                  </div>
                  <div className="field-box flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 mt-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={weeklyTarget}
                      onChange={(e) => setWeeklyTarget(e.target.value)}
                      className="flex-1 bg-transparent text-sm font-semibold text-gray-900 dark:text-white outline-none"
                    />
                    <span className="text-xs text-gray-400">{unit}/week</span>
                  </div>
                </Field>

                <Field label="Weight unit">
                  <div className="seg">
                    {(['kg', 'lb'] as WeightUnit[]).map((u) => (
                      <button
                        key={u}
                        onClick={() => switchUnit(u)}
                        aria-pressed={unit === u}
                        className="seg-item"
                      >
                        {u === 'kg' ? 'Kilograms' : 'Pounds'}
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Macro breakdown */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mt-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity size={14} className="text-gray-400" />
                    <p className="text-11 font-semibold text-gray-500 dark:text-gray-400">Macro targets</p>
                  </div>
                  <div className="space-y-3">
                    <ProteinTarget grams={protein} onGramsChange={setProtein} latestWeightKg={latestWeightKg ?? null} />
                    <MacroField label="Carbs" value={carbs} onChange={setCarbs} color="text-orange-500" sub="Fuels activity" />
                    <MacroField label="Fat" value={fat} onChange={setFat} color="text-amber-500" sub="Hormones & satiety" />
                  </div>
                </div>

                {/* Meal calorie split */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 overflow-hidden">
                  <div className="flex items-center gap-2 mb-3">
                    <Utensils size={14} className="text-gray-400" />
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Calories per meal</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <MacroField label="Breakfast" value={breakfast} onChange={setBreakfast} color="text-accent-600" compact />
                    <MacroField label="Lunch" value={lunch} onChange={setLunch} color="text-accent-600" compact />
                    <MacroField label="Dinner" value={dinner} onChange={setDinner} color="text-accent-600" compact />
                    <MacroField label="Snack" value={snack} onChange={setSnack} color="text-accent-600" compact />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setWizardOpen(true)}
                    className="flex-1 bg-accent-50 dark:bg-accent-950 text-accent-800 dark:text-accent-300 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 active:scale-[.99] transition-transform"
                  >
                    <Sparkles size={15} /> Re-calculate
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>


      <GoalPlanSection />

        </>
      )}
      {page === 'app' && (
        <>
      <RemindersSection key={restoreCount} />

      <HealthSection />

      <CoachMemorySection />

      <AppearanceSection />

      <LayoutSection />

        </>
      )}
      {page === 'account' && (
        <>
      {/* Profile card */}
      <div className="card p-5 mt-5">
        <div className="flex items-center gap-2 mb-4">
          <User size={18} className="text-accent-600" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Profile and account</h2>
        </div>
        <div className="flex flex-col items-center mb-4">
          <button
            onClick={() => avatarRef.current?.click()}
            className="relative w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden active:scale-95 transition-transform"
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
            className="text-xs font-semibold text-accent-600 mt-2"
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
          <div className="field-box flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={40}
              className="flex-1 bg-transparent text-sm font-semibold text-gray-900 dark:text-white outline-none"
            />
          </div>
        </Field>
        <div className="border-t border-gray-100 dark:border-gray-800 mt-5 pt-4">
          <AccountSection bare />
        </div>
      </div>

      {/* Backup & Export */}
      <div className="card p-5 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet size={18} className="text-accent-600" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Backup and export</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Back up everything — meals, weights, workouts, pinned meals, goals and settings — to move to another device, or export logs as CSV for Google Sheets or Excel.
        </p>
        <div className="space-y-2.5">
          <ActionBtn onClick={onExportJson} Icon={Download} label={exporting ? 'Preparing backup…' : 'Export backup (JSON)'} sub="Everything — restore on any device" disabled={exporting} />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportJson(f); e.target.value = ''; }}
          />
          <ActionBtn onClick={() => fileRef.current?.click()} Icon={Upload} label="Import backup (JSON)" sub="Restore everything from a backup file" />
          <ActionBtn onClick={onExportCsv} Icon={FileSpreadsheet} label="Export meals (CSV)" sub={`${meals.length} meal${meals.length === 1 ? '' : 's'} — for Google Sheets or Excel`} disabled={meals.length === 0} />
          <ActionBtn onClick={() => downloadWeightsCsv(weights, settings.weightUnit)} Icon={FileSpreadsheet} label="Export weights (CSV)" sub={`${weights.length} weigh-in${weights.length === 1 ? '' : 's'}`} disabled={weights.length === 0} />
          <ActionBtn onClick={() => downloadWorkoutsCsv(workouts, settings.weightUnit)} Icon={FileSpreadsheet} label="Export workouts (CSV)" sub={`${workouts.length} workout${workouts.length === 1 ? '' : 's'}, with sets`} disabled={workouts.length === 0} />
        </div>
      </div>


      {/* Danger zone */}
      <div className="card p-5 border-red-100 dark:border-red-900 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={18} className="text-red-500" />
          <h2 className="text-sm font-bold text-red-600 dark:text-red-400">Danger zone</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Clear all data deletes your meals, weights, workouts and pinned meals and resets settings, keeping the account. Delete account removes everything, including the account. Neither can be undone.
        </p>
        <button
          onClick={() => setConfirmOpen(true)}
          className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
        >
          <Trash2 size={16} /> Clear all data
        </button>
        <DeleteAccountButton />
      </div>

      {/* Syncing itself is pull-to-refresh and the status pill at the top;
          this just says when it last happened. */}
      <p className="flex items-center justify-center gap-1.5 text-11 text-gray-400 mt-6 py-2">
        <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Syncing…' : lastSyncedAt ? `Last synced ${formatRelativeTime(lastSyncedAt).replace(/^Just/, 'just')}` : 'Not synced yet'}
      </p>
      {!prefsSyncEnabled && (
        <p className="text-center text-11 text-gray-400 mt-1 px-4">
          Your layout, goal plan, milestones and coach memory are only on this device. Re-run supabase/schema.sql in Supabase to sync them.
        </p>
      )}
      {!pinsSyncEnabled && (
        <p className="text-center text-11 text-gray-400 mt-1 px-4">
          Pinned meals are only on this device. Re-run supabase/schema.sql in Supabase to sync them across devices.
        </p>
      )}
      {!photoStorageAvailable() && (
        <p className="text-center text-11 text-gray-400 mt-1 px-4">
          Photo storage isn't set up, so photos are saved inside each meal (slower to load). Re-run supabase/schema.sql in Supabase to enable it.
        </p>
      )}


        </>
      )}
      </div>
      </div>

      <SetupWizardModal open={wizardOpen} onClose={() => setWizardOpen(false)} />

      {/* Clear-all confirmation */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Clear all data?">
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950 rounded-2xl p-3 mb-4">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300 font-medium">
            Are you sure you want to delete all meal logs, weight history, and custom settings?
          </p>
        </div>
        <p className="text-xs text-gray-400 mb-5">This action is permanent and cannot be undone.</p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmOpen(false)}
            className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold py-3.5 rounded-2xl text-sm"
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
      <label className="text-11 font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">{label}</label>
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
      className="w-full flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-2xl p-3.5 text-left disabled:opacity-40 active:scale-[.99] transition-transform"
    >
      <div className="w-9 h-9 rounded-full bg-accent-100 dark:bg-accent-900 flex items-center justify-center flex-shrink-0">
        <Icon size={17} className="text-accent-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </button>
  );
}

function SummaryStat({ label, value, isText }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-2.5 border border-gray-50 dark:border-gray-800 text-center">
      <p className="text-10 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap mb-0.5">{label}</p>
      <p className={`font-bold text-gray-900 dark:text-white ${isText ? 'text-11' : 'text-sm'}`}>{typeof value === 'number' ? Math.round(value).toLocaleString() : value}</p>
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
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between mb-1 min-w-0">
        <span className={`text-xs font-semibold truncate ${color}`}>{label}</span>
        {!compact && sub && <span className="text-10 text-gray-400 truncate ml-1">{sub}</span>}
      </div>
      <div className="field-box flex items-center bg-white dark:bg-gray-900 rounded-xl px-2.5 py-2 border border-gray-100 dark:border-gray-700 min-w-0">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full min-w-0 bg-transparent font-bold text-gray-900 dark:text-white outline-none ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        />
        <span className="text-10 font-semibold text-gray-400 shrink-0 ml-1">
          {compact ? 'kcal' : 'g'}
        </span>
      </div>
    </div>
  );
}
