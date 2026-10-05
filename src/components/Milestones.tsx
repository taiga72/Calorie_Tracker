import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store';
import { useUndoToast } from '@/components/UndoToastProvider';
import { Modal } from '@/components/Modal';
import { formatShortDate, todayKey } from '@/lib/dateUtils';
import { kgToUnit, unitToKg } from '@/lib/units';
import { haptic } from '@/lib/appearance';
import { MILESTONE_KINDS, milestoneLabel, milestoneProgress } from '@/lib/milestones';
import { Trophy, Plus, Trash2, Check, X, PartyPopper } from 'lucide-react';
import type { Milestone, MilestoneKind } from '@/types';

/** Your own milestones with progress; add and remove them here. */
export function MilestonesCard() {
  const { meals, weights, settings, updatePrefs } = useStore();
  const { requestUndo } = useUndoToast();
  const [adding, setAdding] = useState(false);
  const milestones = settings.prefs?.milestones ?? [];
  const data = useMemo(() => ({ meals, weights, settings }), [meals, weights, settings]);
  const unit = settings.weightUnit;
  // Open first, then reached (most recent first).
  const sorted = [...milestones].sort((a, b) => (a.achievedAt ? 1 : 0) - (b.achievedAt ? 1 : 0) || (b.achievedAt ?? '').localeCompare(a.achievedAt ?? ''));

  const remove = (m: Milestone) => {
    updatePrefs({ milestones: milestones.filter((x) => x.id !== m.id) });
    requestUndo('Milestone removed', () => updatePrefs({ milestones }));
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy size={16} className="text-amber-500" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Milestones</h2>
        {!adding && (
          <button onClick={() => setAdding(true)} className="ml-auto flex items-center gap-1 text-xs font-semibold text-accent-600">
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      {milestones.length === 0 && !adding && (
        <p className="text-xs text-gray-400">Set your own targets — "reach 80 kg", "a 30-day streak", "20 days within goal" — and get a celebration when you hit them.</p>
      )}

      <div className="space-y-3">
        {sorted.map((m) => {
          const p = milestoneProgress(m, data);
          const reached = !!m.achievedAt || p.achieved;
          const progressText = m.kind === 'weight'
            ? (Number.isNaN(p.current) ? 'No weigh-ins yet' : `${kgToUnit(p.current, unit).toFixed(1)} → ${kgToUnit(m.target, unit).toFixed(1)} ${unit}`)
            : `${Math.min(p.current, m.target)} / ${m.target}`;
          return (
            <div key={m.id} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${reached ? 'bg-amber-100 dark:bg-amber-950 text-amber-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                {reached ? <Check size={15} strokeWidth={3} /> : <Trophy size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{milestoneLabel(m, settings)}</p>
                  <span className="ml-auto text-11 text-gray-400 flex-shrink-0">
                    {m.achievedAt ? `Reached ${formatShortDate(m.achievedAt)}` : progressText}
                  </span>
                </div>
                {!reached && (
                  <div className="h-1.5 mt-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full bg-accent-500 transition-all duration-500" style={{ width: `${Math.round(p.fraction * 100)}%` }} />
                  </div>
                )}
              </div>
              <button onClick={() => remove(m)} aria-label={`Remove ${milestoneLabel(m, settings)}`} className="text-gray-300 hover:text-red-500 p-1 -mr-1">
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {adding && <AddMilestone onDone={() => setAdding(false)} />}
    </div>
  );
}

function AddMilestone({ onDone }: { onDone: () => void }) {
  const { meals, weights, settings, updatePrefs } = useStore();
  const unit = settings.weightUnit;
  const [kind, setKind] = useState<MilestoneKind>('weight');
  const [target, setTarget] = useState('');
  const [label, setLabel] = useState('');
  const latest = [...weights].sort((a, b) => a.date.localeCompare(b.date)).pop()?.weight;
  const n = Number(target);
  const valid = n > 0 && (kind !== 'weight' || latest !== undefined);

  const save = () => {
    if (!valid) return;
    const m: Milestone = {
      id: `ms_${Date.now().toString(36)}`,
      kind,
      target: kind === 'weight' ? +unitToKg(n, unit).toFixed(2) : Math.round(n),
      label: label.trim() || undefined,
      createdAt: todayKey(),
      ...(kind === 'weight' && latest !== undefined ? { startWeight: latest } : {}),
    };
    // Already true when set (e.g. "log 10 meals" after 200): mark it reached
    // quietly rather than celebrating something old.
    if (milestoneProgress(m, { meals, weights, settings }).achieved) m.achievedAt = todayKey();
    updatePrefs({ milestones: [...(settings.prefs?.milestones ?? []), m] });
    onDone();
  };

  const kindInfo = MILESTONE_KINDS.find((k) => k.kind === kind)!;
  return (
    <div className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {MILESTONE_KINDS.map((k) => (
          <button
            key={k.kind}
            onClick={() => setKind(k.kind)}
            className={`py-2 rounded-lg text-xs font-semibold ${kind === k.kind ? 'bg-gray-900 dark:bg-accent-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400'}`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          aria-label="Milestone target"
          placeholder={kind === 'weight' ? (latest ? (kgToUnit(latest, unit) - (unit === 'kg' ? 2 : 5)).toFixed(0) : '') : kind === 'meals' ? '100' : '30'}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-24 bg-white dark:bg-gray-900 rounded-lg px-2.5 py-2 text-sm font-semibold text-gray-900 dark:text-white outline-none"
        />
        <span className="text-xs text-gray-500">{kindInfo.unitLabel(unit)}</span>
      </div>
      {kind === 'weight' && latest === undefined && <p className="text-11 text-amber-600">Log a weight first, so progress has a starting point.</p>}
      <input
        aria-label="Milestone name (optional)"
        placeholder="Name (optional)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="w-full bg-white dark:bg-gray-900 rounded-lg px-2.5 py-2 text-sm text-gray-900 dark:text-white outline-none"
      />
      <div className="flex gap-2">
        <button onClick={onDone} className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-white dark:bg-gray-900 text-xs font-semibold text-gray-500"><X size={14} /> Cancel</button>
        <button onClick={save} disabled={!valid} className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-accent-600 text-white text-xs font-semibold disabled:opacity-40"><Check size={14} /> Add milestone</button>
      </div>
    </div>
  );
}

/** The celebration when a milestone is reached. */
export function MilestoneModal({ milestone, onClose }: { milestone: Milestone | null; onClose: () => void }) {
  const { settings } = useStore();
  useEffect(() => { if (milestone) haptic('celebrate'); }, [milestone]);
  return (
    <Modal open={milestone !== null} onClose={onClose} maxWidth="max-w-sm">
      {milestone && (
        <div className="flex flex-col items-center text-center py-6">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-full bg-amber-300/40 blur-2xl animate-ping motion-reduce:animate-none" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/40">
              <Trophy size={48} className="text-white" />
            </div>
          </div>
          <p className="text-sm font-semibold text-gray-400 tracking-wide flex items-center gap-1.5"><PartyPopper size={15} /> Milestone reached</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{milestoneLabel(milestone, settings)}</h2>
          <p className="text-sm text-gray-500 leading-relaxed mt-3 px-2">You set this goal and you got there. Time to pick the next one?</p>
          <button
            onClick={onClose}
            className="w-full mt-7 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold py-3.5 rounded-2xl text-sm active:scale-[.99] transition-transform"
          >
            Nice!
          </button>
        </div>
      )}
    </Modal>
  );
}
