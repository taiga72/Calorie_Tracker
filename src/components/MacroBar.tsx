interface MacroBarProps {
  protein: number; // grams
  carbs: number;
  fat: number;
  showLegend?: boolean;
}

export function MacroBar({ protein, carbs, fat, showLegend = true }: MacroBarProps) {
  const proteinCals = protein * 4;
  const carbCals = carbs * 4;
  const fatCals = fat * 9;
  const total = proteinCals + carbCals + fatCals || 1;
  const pPct = Math.round((proteinCals / total) * 100);
  const cPct = Math.round((carbCals / total) * 100);
  const fPct = Math.max(0, 100 - pPct - cPct);

  return (
    <div className="w-full">
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-gray-100">
        <div className="bg-emerald-500" style={{ width: `${pPct}%` }} />
        <div className="bg-orange-400" style={{ width: `${cPct}%` }} />
        <div className="bg-amber-300" style={{ width: `${fPct}%` }} />
      </div>
      {showLegend && (
        <div className="flex justify-between mt-2 text-xs">
          <span className="flex items-center gap-1.5 text-gray-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Protein {pPct}%
          </span>
          <span className="flex items-center gap-1.5 text-gray-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400" /> Carbs {cPct}%
          </span>
          <span className="flex items-center gap-1.5 text-gray-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-300" /> Fat {fPct}%
          </span>
        </div>
      )}
    </div>
  );
}
