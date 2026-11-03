import { useStore } from '@/store';

/**
 * Protein target, in one place (Settings → Goals → Macro targets): fixed
 * grams, or grams per kg (lb) of body weight that follow the latest weigh-in.
 * Per-kg is saved right away; fixed grams save with the other goals.
 */
export function ProteinTarget({ grams, onGramsChange, latestWeightKg }: {
  grams: string;
  onGramsChange: (v: string) => void;
  latestWeightKg: number | null;
}) {
  const { settings, updatePrefs } = useStore();
  const unit = settings.weightUnit;
  const perKg = settings.prefs?.proteinPerKg ?? null;
  const perUnit = perKg ? +(unit === 'lb' ? perKg / 2.2046 : perKg).toFixed(2) : null;
  const worksOut = perKg && latestWeightKg ? Math.round(perKg * latestWeightKg) : null;

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="text-xs font-semibold text-emerald-600">Protein</span>
        <span className="seg w-36 !p-[2px]" role="group" aria-label="Protein target">
          <button type="button" aria-pressed={!perKg} onClick={() => perKg && updatePrefs({ proteinPerKg: null })} className="seg-item !py-0.5 !text-11">
            Grams
          </button>
          <button type="button" aria-pressed={!!perKg} onClick={() => !perKg && updatePrefs({ proteinPerKg: 1.6 })} className="seg-item !py-0.5 !text-11">
            Per {unit}
          </button>
        </span>
      </div>
      <div className="field-box flex items-center bg-white dark:bg-gray-900 rounded-xl px-2.5 py-2 border border-gray-100 dark:border-gray-700 min-w-0 gap-2">
        {perUnit !== null ? (
          <>
            <input
              key={perUnit}
              type="number"
              inputMode="decimal"
              step={0.1}
              aria-label={`Protein grams per ${unit}`}
              defaultValue={perUnit}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v > 0) updatePrefs({ proteinPerKg: +(unit === 'lb' ? v * 2.2046 : v).toFixed(3) });
              }}
              className="w-full min-w-0 bg-transparent text-sm font-bold text-gray-900 dark:text-white outline-none"
            />
            <span className="text-xs text-gray-400 whitespace-nowrap">g/{unit}</span>
            {worksOut !== null && <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">= {worksOut} g</span>}
          </>
        ) : (
          <>
            <input
              type="number"
              inputMode="numeric"
              aria-label="Protein grams"
              value={grams}
              onChange={(e) => onGramsChange(e.target.value)}
              className="w-full min-w-0 bg-transparent text-sm font-bold text-gray-900 dark:text-white outline-none"
            />
            <span className="text-xs text-gray-400">g</span>
          </>
        )}
      </div>
    </div>
  );
}
