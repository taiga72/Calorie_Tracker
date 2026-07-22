interface Point { label: string; value: number }

interface CalorieLineChartProps {
  data: Point[];
  goal?: number;
  height?: number;
}

export function CalorieLineChart({ data, goal, height = 160 }: CalorieLineChartProps) {
  const width = 600;
  const padX = 16;
  const padY = 20;
  if (data.length === 0) {
    return <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data yet</div>;
  }
  const values = data.map((d) => d.value);
  const maxV = Math.max(...values, goal ?? 0, 1) * 1.15;
  const minV = 0;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0;
  const yFor = (v: number) => padY + innerH - ((v - minV) / (maxV - minV)) * innerH;
  const xFor = (i: number) => padX + i * xStep;

  const points = data.map((d, i) => [xFor(i), yFor(d.value)] as const);
  const linePath = points
    .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1][0]} ${padY + innerH} L ${points[0][0]} ${padY + innerH} Z`;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const avgY = yFor(avg);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        <defs>
          <linearGradient id="calArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F97316" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
          </linearGradient>
        </defs>
        {goal && goal > 0 && (
          <line
            x1={padX} x2={width - padX}
            y1={yFor(goal)} y2={yFor(goal)}
            stroke="#E5E7EB" strokeDasharray="4 4" strokeWidth={1}
          />
        )}
        <path d={areaPath} fill="url(#calArea)" />
        <path d={linePath} fill="none" stroke="#F97316" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <line x1={padX} x2={width - padX} y1={avgY} y2={avgY} stroke="#FB923C" strokeDasharray="6 4" strokeWidth={1.2} strokeOpacity={0.7} />
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill="#F97316" />
        ))}
      </svg>
      <div className="flex justify-between mt-1 text-[9px] text-gray-400 font-medium px-1">
        <span>{data[0].label}</span>
        <span className="text-orange-500 font-semibold">Avg {Math.round(avg)}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}
