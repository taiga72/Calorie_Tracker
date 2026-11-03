import { cleanDecimal, parseDecimal } from '@/lib/decimal';
import { useStore } from '@/store';
import { FormRow } from '@/components/FormRows';

/**
 * Protein target, in one place (Settings → Goals → Macro targets), as two
 * rows: how it's set (fixed grams, or grams per kg/lb of body weight that
 * follow the latest weigh-in) and the amount. Per-kg is saved right away;
 * fixed grams save with the other goals.
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
  const field = 'w-16 min-w-0 bg-transparent text-sm font-semibold text-right text-gray-900 dark:text-white outline-none';

  return (
    <>
      <FormRow label="Protein">
        <span className="seg w-36" role="group" aria-label="Protein target">
          <button type="button" aria-pressed={!perKg} onClick={() => perKg && updatePrefs({ proteinPerKg: null })} className="seg-item !py-1">
            Grams
          </button>
          <button type="button" aria-pressed={!!perKg} onClick={() => !perKg && updatePrefs({ proteinPerKg: 1.6 })} className="seg-item !py-1">
            Per {unit}
          </button>
        </span>
      </FormRow>
      {perUnit !== null ? (
        <FormRow label={<span className="text-gray-500 dark:text-gray-400">Per {unit} of weight</span>}>
          <input
            key={perUnit}
            type="text"
            inputMode="decimal"
            aria-label={`Protein grams per ${unit}`}
            defaultValue={perUnit}
            onChange={(e) => { e.target.value = cleanDecimal(e.target.value); }}
            onBlur={(e) => {
              const v = parseDecimal(e.target.value);
              if (v > 0) updatePrefs({ proteinPerKg: +(unit === 'lb' ? v * 2.2046 : v).toFixed(3) });
            }}
            className={field}
          />
          <span className="text-sm text-gray-400 whitespace-nowrap">g</span>
          {worksOut !== null && <span className="text-sm text-gray-400 whitespace-nowrap">= {worksOut} g</span>}
        </FormRow>
      ) : (
        <FormRow label={<span className="text-gray-500 dark:text-gray-400">Amount</span>}>
          <input
            type="text"
            inputMode="numeric"
            aria-label="Protein grams"
            value={grams}
            onChange={(e) => onGramsChange(e.target.value.replace(/\D/g, ''))}
            className={field}
          />
          <span className="text-sm text-gray-400">g</span>
        </FormRow>
      )}
    </>
  );
}
