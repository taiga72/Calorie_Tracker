interface CalorieRingProps {
  consumed: number;
  goal: number;
  size?: number;
  stroke?: number;
}

export function CalorieRing({ consumed, goal, size = 140, stroke = 12 }: CalorieRingProps) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const offset = circ - pct * circ;
  const over = consumed > goal && goal > 0;
  const remaining = Math.max(goal - consumed, 0);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={over ? '#ef4444' : '#10b981'}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-bold tabular-nums ${over ? 'text-red-500' : 'text-gray-900'}`}>
          {Math.round(consumed)}
        </span>
        <span className="text-[11px] text-gray-400 font-medium">/ {goal} kcal</span>
        {goal > 0 && (
          <span className="text-[10px] text-gray-300 mt-0.5">
            {over ? `${Math.round(consumed - goal)} over` : `${Math.round(remaining)} left`}
          </span>
        )}
      </div>
    </div>
  );
}
