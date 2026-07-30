interface Point { label: string; value: number }

interface CalorieLineChartProps {
  data: Point[];
  goal?: number;
  height?: number;
}

export function CalorieLineChart({ data, goal, height = 160 }: CalorieLineChartProps) {
  const width = 600;
  const padX = 24;
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

  const ticks = 5;
  const tickValues: number[] = [];
  for (let i = 0; i <= ticks; i++) {
    const v = minV + ((maxV - minV) * i) / ticks;
    tickValues.push(Math.round(v));
  }

  return (
    <div className="w-full">
      <div className="flex">
        {/* Y-axis label column */}
        <div className="w-8 flex-shrink-0 relative" style={{ height }}>
          {tickValues.map((tv, i) => (
            <span
              key={`yl-${i}`}
              className="absolute right-0 pr-1.5 text-[9px] text-gray-400 font-semibold leading-none -translate-y-1/2"
              style={{ top: `${yFor(tv)}px` }}
            >
              {tv}
            </span>
          ))}
        </div>

        {/* Chart */}
        <div className="flex-1 pl-2 min-w-0">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
            <defs>
              <linearGradient id="calArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F97316" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Y-axis grid lines */}
            {tickValues.map((tv, i) => {
              const y = yFor(tv);
              return (
                <line key={`tick-${i}`} x1={padX} x2={width - padX} y1={y} y2={y} stroke="#F3F4F6" strokeWidth={1} />
              );
            })}
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
              <g key={`pt-${i}`}>
                <circle cx={p[0]} cy={p[1]} r={2.5} fill="#F97316" />
                <text x={p[0]} y={p[1] - 6} textAnchor="middle" fontSize={9} fill="#F97316" fontWeight={700}>
                  {Math.round(data[i].value)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex mt-1">
        <div className="w-8 flex-shrink-0" />
        <div className="flex-1 pl-2 flex justify-between text-[9px] text-gray-400 font-medium px-1">
          <span>{data[0].label}</span>
          <span className="text-orange-500 font-semibold">Avg {Math.round(avg)}</span>
          <span>{data[data.length - 1].label}</span>
        </div>
      </div>
    </div>
  );
}
