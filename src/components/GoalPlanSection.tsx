import { useState } from 'react';
import { useStore } from '@/store';
import { useUndoToast } from '@/components/UndoToastProvider';
import { Segmented, Toggle } from '@/components/AppearanceSection';
import { formatShortDate, todayKey } from '@/lib/dateUtils';
import { kgToUnit, unitToKg } from '@/lib/units';
import { phaseOn, sortedPhases, WEEKDAY_NAMES } from '@/lib/goalPlan';
import { CalendarRange, Plus, Trash2, Check, X } from 'lucide-react';
import type { GoalPhase, WeightUnit } from '@/types';

const INPUT = 'w-full bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 ring-accent-500/30';

/**
 * Settings → Goal plan: goal phases (cut → maintain → lean bulk), different
 * goals per weekday, protein per body weight, and when a new day starts.
 * Saved with the account (settings.prefs).
 */
export function GoalPlanSection() {
  const { settings, updatePrefs } = useStore();
  const { requestUndo } = useUndoToast();
  const prefs = settings.prefs ?? {};
  const unit = settings.weightUnit;
  const today = todayKey();
  const phases = sortedPhases(settings);
  const current = phaseOn(settings, today);
  const [editing, setEditing] = useState<GoalPhase | null>(null);

  const savePhase = (p: GoalPhase) => {
    const others = (prefs.phases ?? []).filter((x) => x.id !== p.id);
    updatePrefs({ phases: [...others, p] });
    setEditing(null);
  };
  const deletePhase = (p: GoalPhase) => {
    const before = prefs.phases ?? [];
    updatePrefs({ phases: before.filter((x) => x.id !== p.id) });
    setEditing(null);
    requestUndo(`Removed ${p.name}`, () => updatePrefs({ phases: before }));
  };
  const newPhase = (): GoalPhase => ({
    id: `ph_${Date.now().toString(36)}`,
    name: phases.length === 0 ? 'Cut' : `Phase ${phases.length + 1}`,
    start: today,
    calorieGoal: current?.calorieGoal ?? settings.calorieGoal,
    weeklyWeightTarget: current?.weeklyWeightTarget ?? settings.weeklyWeightTarget,
  });

  const offsets = prefs.weekdayOffsets && prefs.weekdayOffsets.length === 7 ? prefs.weekdayOffsets : null;
  const setOffset = (i: number, v: number) => {
    const next = [...(offsets ?? [0, 0, 0, 0, 0, 0, 0])];
    next[i] = v;
    updatePrefs({ weekdayOffsets: next });
  };
  const baseToday = current?.calorieGoal ?? settings.calorieGoal;
  const weekAvg = offsets ? Math.round(baseToday + offsets.reduce((a, b) => a + b, 0) / 7) : baseToday;

  const perKgShown = prefs.proteinPerKg ? +(unit === 'lb' ? prefs.proteinPerKg / 2.2046 : prefs.proteinPerKg).toFixed(2) : null;

  return (
    <div className="card p-5 mt-4">
      <div className="flex items-center gap-2 mb-1">
        <CalendarRange size={18} className="text-accent-600" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Goal plan</h2>
      </div>
      <p className="text-xs text-gray-400 mb-4">Phases, weekday goals and protein — each day is judged by the goal it had.</p>

      {/* Phases */}
      <p className="text-11 font-semibold text-gray-500 dark:text-gray-400 mb-2">Goal phases</p>
      {phases.length === 0 && !editing && (
        <p className="text-xs text-gray-400 mb-2">
          Plan a cut, then maintenance, then a lean bulk — each switches on automatically on its start date.
          Until then your goal is {settings.calorieGoal.toLocaleString()} kcal.
        </p>
      )}
      <div className="space-y-2">
        {phases.map((p) => (editing?.id === p.id ? (
          <PhaseForm key={p.id} phase={editing} unit={unit} onSave={savePhase} onCancel={() => setEditing(null)} onDelete={() => deletePhase(p)} />
        ) : (
          <button
            key={p.id}
            onClick={() => setEditing(p)}
            className="w-full flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-left"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {p.name}
                {current?.id === p.id && <span className="ml-2 text-9 font-bold uppercase tracking-wider text-accent-600 bg-accent-50 dark:bg-accent-950 rounded-full px-1.5 py-0.5 align-middle">Now</span>}
              </p>
              <p className="text-11 text-gray-400">
                {p.start > today ? 'Starts' : 'From'} {formatShortDate(p.start)} · {paceLabel(p.weeklyWeightTarget, unit)}
              </p>
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{p.calorieGoal.toLocaleString()}<span className="text-11 font-normal text-gray-400"> kcal</span></span>
          </button>
        )))}
        {editing && !phases.some((p) => p.id === editing.id) && (
          <PhaseForm phase={editing} unit={unit} onSave={savePhase} onCancel={() => setEditing(null)} />
        )}
      </div>
      {!editing && (
        <button onClick={() => setEditing(newPhase())} className="mt-2 flex items-center gap-1 text-xs font-semibold text-accent-600">
          <Plus size={14} /> Add phase
        </button>
      )}

      {/* Weekday goals */}
      <div className="mt-5">
        <Toggle
          label="Different goals by weekday"
          sub="E.g. more on training days or weekends"
          on={!!offsets}
          onChange={(on) => updatePrefs({ weekdayOffsets: on ? [0, 0, 0, 0, 0, 0, 0] : null })}
        />
        {offsets && (
          <div className="mt-2 space-y-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-24 text-xs font-semibold text-gray-600 dark:text-gray-300">{WEEKDAY_NAMES[i]}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  step={50}
                  aria-label={`${WEEKDAY_NAMES[i]} adjustment`}
                  value={offsets[i] || ''}
                  placeholder="0"
                  onChange={(e) => setOffset(i, Math.round(Number(e.target.value) || 0))}
                  className="w-20 bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-900 dark:text-white outline-none text-right"
                />
                <span className="text-11 text-gray-400">kcal</span>
                <span className="ml-auto text-xs font-bold text-gray-900 dark:text-white">{Math.max(800, baseToday + (offsets[i] || 0)).toLocaleString()}</span>
              </div>
            ))}
            <p className="text-11 text-gray-400 pt-1">
              Weekly average {weekAvg.toLocaleString()} kcal/day{weekAvg !== baseToday ? ` (${weekAvg > baseToday ? '+' : '−'}${Math.abs(weekAvg - baseToday)} vs. ${baseToday.toLocaleString()})` : ''}.
            </p>
          </div>
        )}
      </div>

      {/* Protein */}
      <Segmented<'fixed' | 'perKg'>
        label="Protein target"
        value={prefs.proteinPerKg ? 'perKg' : 'fixed'}
        onChange={(v) => updatePrefs({ proteinPerKg: v === 'perKg' ? 1.6 : null })}
        options={[
          { value: 'fixed', label: 'Fixed grams' },
          { value: 'perKg', label: `Per ${unit} of weight` },
        ]}
      />
      {perKgShown !== null && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="number"
            inputMode="decimal"
            step={0.1}
            aria-label={`Protein grams per ${unit}`}
            defaultValue={perKgShown}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v > 0) updatePrefs({ proteinPerKg: +(unit === 'lb' ? v * 2.2046 : v).toFixed(3) });
            }}
            className="w-20 bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-900 dark:text-white outline-none text-right"
          />
          <span className="text-xs text-gray-500">g per {unit} — follows your latest weigh-in</span>
        </div>
      )}

      {/* Day boundary */}
      <div className="mt-4">
        <p className="text-11 font-semibold text-gray-500 dark:text-gray-400 mb-2">New day starts at</p>
        <select
          aria-label="New day starts at"
          value={prefs.dayStartHour ?? 0}
          onChange={(e) => updatePrefs({ dayStartHour: Number(e.target.value) })}
          className={INPUT}
        >
          {[0, 1, 2, 3, 4, 5].map((h) => (
            <option key={h} value={h}>{h === 0 ? 'Midnight (default)' : `${h}:00 am — late snacks count toward the day before`}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function paceLabel(kgPerWeek: number, unit: WeightUnit): string {
  if (!kgPerWeek) return 'maintain';
  const v = Math.abs(kgToUnit(kgPerWeek, unit)).toFixed(2);
  return `${kgPerWeek < 0 ? 'lose' : 'gain'} ${v} ${unit}/wk`;
}

function PhaseForm({ phase, unit, onSave, onCancel, onDelete }: {
  phase: GoalPhase;
  unit: WeightUnit;
  onSave: (p: GoalPhase) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(phase.name);
  const [start, setStart] = useState(phase.start);
  const [kcal, setKcal] = useState(String(phase.calorieGoal));
  const [dir, setDir] = useState<'lose' | 'maintain' | 'gain'>(phase.weeklyWeightTarget < 0 ? 'lose' : phase.weeklyWeightTarget > 0 ? 'gain' : 'maintain');
  const [pace, setPace] = useState(phase.weeklyWeightTarget ? Math.abs(kgToUnit(phase.weeklyWeightTarget, unit)).toFixed(2) : unit === 'kg' ? '0.25' : '0.5');
  const valid = name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(start) && Number(kcal) >= 800;

  const save = () => {
    if (!valid) return;
    const kg = dir === 'maintain' ? 0 : unitToKg(Math.abs(Number(pace) || 0), unit) * (dir === 'lose' ? -1 : 1);
    onSave({ ...phase, name: name.trim(), start, calorieGoal: Math.round(Number(kcal)), weeklyWeightTarget: +kg.toFixed(3) });
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-2">
      <input aria-label="Phase name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cut, Maintain, Lean bulk…" className={INPUT.replace('bg-gray-50 dark:bg-gray-800', 'bg-white dark:bg-gray-900')} />
      <div className="grid grid-cols-1 gap-2">
        <label className="text-11 text-gray-400">
          Starts
          <input type="date" aria-label="Phase start" value={start} onChange={(e) => setStart(e.target.value)} className={`${INPUT.replace('bg-gray-50 dark:bg-gray-800', 'bg-white dark:bg-gray-900')} mt-1`} />
        </label>
        <label className="text-11 text-gray-400">
          Daily goal (kcal)
          <input type="number" inputMode="numeric" aria-label="Phase calorie goal" value={kcal} onChange={(e) => setKcal(e.target.value)} className={`${INPUT.replace('bg-gray-50 dark:bg-gray-800', 'bg-white dark:bg-gray-900')} mt-1`} />
        </label>
      </div>
      <div className="flex gap-1.5">
        {(['lose', 'maintain', 'gain'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDir(d)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize ${dir === d ? 'bg-gray-900 dark:bg-accent-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400'}`}
          >
            {d}
          </button>
        ))}
      </div>
      {dir !== 'maintain' && (
        <div className="flex items-center gap-2">
          <input type="number" inputMode="decimal" step={0.05} aria-label="Weekly pace" value={pace} onChange={(e) => setPace(e.target.value)} className="w-20 bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-900 dark:text-white outline-none text-right" />
          <span className="text-xs text-gray-500">{unit} per week</span>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        {onDelete && (
          <button onClick={onDelete} aria-label="Delete phase" className="px-3 rounded-xl bg-white dark:bg-gray-900 text-red-500"><Trash2 size={15} /></button>
        )}
        <button onClick={onCancel} className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-white dark:bg-gray-900 text-xs font-semibold text-gray-500"><X size={14} /> Cancel</button>
        <button onClick={save} disabled={!valid} className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-accent-600 text-white text-xs font-semibold disabled:opacity-40"><Check size={14} /> Save phase</button>
      </div>
    </div>
  );
}
