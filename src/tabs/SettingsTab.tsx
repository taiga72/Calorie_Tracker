import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store';
import type { WeightUnit } from '@/types';
import { unitToKg, kgToUnit } from '@/lib/units';
import { downloadCsv } from '@/lib/csv';
import { formatRelativeTime, todayKey } from '@/lib/dateUtils';
import type { BackupPayload } from '@/lib/storage';
import { compressImage } from '@/lib/gemini';
import { SetupWizardModal } from '@/modals/SetupWizardModal';
import { Modal } from '@/components/Modal';
import { RemindersSection } from '@/components/RemindersSection';
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
  Trash2, AlertTriangle, User, Camera, Flame, Activity, TrendingDown, Utensils,
  ChevronDown, ChevronUp, Save, RefreshCw, Info,
} from 'lucide-react';

type Page = 'goals' | 'look' | 'account';
const PAGES: { key: Page; label: string; sub: string }[] = [
  { key: 'goals', label: 'Goals', sub: 'Your plan and habits' },
  { key: 'look', label: 'Look', sub: 'Make it yours' },
  { key: 'account', label: 'Account', sub: 'Profile, data and sign-in' },
];

export function SettingsTab() {
  const { notify } = useUndoToast();
  const [page, setPage] = useState<Page>('goals');
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
    settings, updateSettings, updateProfile, profile, meals, weights, clearAll, importBackup, prepareExport,
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
  const [expanded, setExpanded] = useState(false);
  const [liveDeficit, setLiveDeficit] = useState(calc?.dailyDeficit ?? 0);
  const [liveGoalDate, setLiveGoalDate] = useState<string | null>(calc?.estimatedGoalDate ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-calculate macros, deficit, and goal date when calorie goal or target weight changes
  useEffect(() => {
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
  }, [calorieGoal, goalWeight, latestWeightKg]);

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

  const [exporting, setExporting] = useState(false);

  const onExportJson = async () => {
    // Photos load on demand, so fetch any not loaded yet: the backup is the
    // same complete file as before.
    setExporting(true);
    const { payload, missingPhotos } = await prepareExport();
    setExporting(false);
    if (missingPhotos && !window.confirm("Some meal photos couldn't be downloaded (you may be offline). Export the backup without them?")) return;
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
          notify("That file isn't a Calorie Tracker backup.", 'error');
          return;
        }
        importBackup(parsed);
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
      <div role="tablist" aria-label="Settings pages" className="relative grid grid-cols-3 mt-5 p-1 rounded-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
        <span
          aria-hidden
          className="absolute top-1 bottom-1 left-1 w-[calc((100%-8px)/3)] rounded-full bg-gray-900 dark:bg-accent-600 transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${PAGES.findIndex((x) => x.key === page) * 100}%)` }}
        />
        {PAGES.map((x) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={page === x.key}
            onClick={() => goToPage(x.key)}
            className={`relative z-10 py-2 rounded-full text-xs font-semibold transition-colors ${page === x.key ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}
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
      {/* Wizard banner — only for new users who haven't completed setup */}
      {!setupComplete && (
        <button
          onClick={() => setWizardOpen(true)}
          className="w-full bg-accent-600 rounded-3xl p-4 mt-5 flex items-center gap-3 text-white text-left active:scale-[.99] transition-transform"
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">Setup Wizard</p>
            <p className="text-xs text-accent-50">Calculate your calorie & weight goals</p>
          </div>
        </button>
      )}

      {/* Goals card */}
      <div className="card p-5 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <Target size={18} className="text-accent-600" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Your goals</h2>
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
              Run the Setup Wizard to calculate your personalized calorie target, macro breakdown, and estimated goal date.
            </p>
            <button
              onClick={() => setWizardOpen(true)}
              className="bg-accent-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 active:scale-[.99] transition-transform"
            >
              <Sparkles size={16} /> Start Setup Wizard
            </button>
          </div>
        ) : (
          <>
            {/* Summary pills — always visible */}
            <div className="grid grid-cols-4 gap-2 mb-1">
              <SummaryStat icon={<Flame size={12} className="text-orange-500" />} label="At rest" value={calc!.bmr} />
              <SummaryStat icon={<Activity size={12} className="text-blue-500" />} label="Daily burn" value={calc!.tdee} />
              <SummaryStat
                icon={<TrendingDown size={12} className={liveDeficit < 0 ? 'text-red-500' : 'text-emerald-500'} />}
                label={liveDeficit > 0 ? 'Surplus' : 'Deficit'}
                value={liveDeficit > 0 ? `+${liveDeficit}` : liveDeficit}
              />
              <SummaryStat
                icon={<Target size={12} className="text-accent-600" />}
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
                <><ChevronUp size={16} /> Minimize details</>
              ) : (
                <><ChevronDown size={16} /> Edit goals & details</>
              )}
            </button>

            {/* Collapsible section */}
            {expanded && (
              <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-gray-800 mt-1">
                <Field label="Daily calorie goal">
                  <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
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
                  <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLose(true)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${lose ? 'bg-accent-600 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}
                    >
                      Lose
                    </button>
                    <button
                      onClick={() => setLose(false)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${!lose ? 'bg-accent-600 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}
                    >
                      Gain
                    </button>
                  </div>
                  <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 mt-2">
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
                  <div className="flex gap-2">
                    {(['kg', 'lb'] as WeightUnit[]).map((u) => (
                      <button
                        key={u}
                        onClick={() => setUnit(u)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${unit === u ? 'bg-gray-900 dark:bg-accent-600 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}
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
                    <p className="text-xs font-semibold text-gray-400">MACRO BREAKDOWN</p>
                  </div>
                  <div className="space-y-3">
                    <MacroField label="Protein" value={protein} onChange={setProtein} color="text-emerald-600" sub="Preserves muscle" />
                    <MacroField label="Carbs" value={carbs} onChange={setCarbs} color="text-orange-500" sub="Fuels activity" />
                    <MacroField label="Fat" value={fat} onChange={setFat} color="text-amber-500" sub="Hormones & satiety" />
                  </div>
                </div>

                {/* Meal calorie split */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 overflow-hidden">
                  <div className="flex items-center gap-2 mb-3">
                    <Utensils size={14} className="text-gray-400" />
                    <p className="text-xs font-semibold text-gray-400">MEAL CALORIE SPLIT</p>
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
                  <button
                    onClick={onSaveGoals}
                    className="flex-1 bg-accent-600 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 active:scale-[.99] transition-transform"
                  >
                    {saved ? <><Check size={15} /> Saved</> : <><Save size={15} /> Save goals</>}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>


      <GoalPlanSection />

      <CoachMemorySection />

      <RemindersSection />

        </>
      )}
      {page === 'look' && (
        <>
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
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Profile</h2>
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
          <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
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
        <button
          onClick={onSaveProfile}
          className="w-full bg-accent-600 text-white font-semibold py-3 rounded-xl text-sm mt-4 active:scale-[.99] transition-transform flex items-center justify-center gap-2"
        >
          {profileSaved ? <><Check size={16} /> Saved</> : 'Save profile'}
        </button>
      </div>


      <AccountSection />

      {/* Backup & Export */}
      <div className="card p-5 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet size={18} className="text-accent-600" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Backup & Export</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Back up your full data for transferring between devices, or export meal logs as a CSV for Google Sheets or Excel.
        </p>
        <div className="space-y-2.5">
          <ActionBtn onClick={onExportJson} Icon={Download} label={exporting ? 'Preparing backup…' : 'Export Backup (JSON)'} sub="Full state — restore on any device" disabled={exporting} />
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
      <div className="card p-5 border-red-100 dark:border-red-900 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={18} className="text-red-500" />
          <h2 className="text-sm font-bold text-red-600 dark:text-red-400">Danger Zone</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Clear all data deletes your meal logs and weight history and resets settings, keeping the account. Delete account removes everything, including the account. Neither can be undone.
        </p>
        <button
          onClick={() => setConfirmOpen(true)}
          className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
        >
          <Trash2 size={16} /> Clear All Data
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

function SummaryStat({ icon, label, value, isText }: { icon: React.ReactNode; label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-2.5 border border-gray-50 dark:border-gray-800 text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        {icon}
        <p className="text-9 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{label}</p>
      </div>
      <p className={`font-bold text-gray-900 dark:text-white ${isText ? 'text-11' : 'text-sm'}`}>{value}</p>
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
      <div className="flex items-center bg-white dark:bg-gray-900 rounded-xl px-2.5 py-2 border border-gray-100 dark:border-gray-700 min-w-0">
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
