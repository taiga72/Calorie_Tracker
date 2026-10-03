import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { dateTicks, dayIndex, niceTicks, valueAt, type TrendPoint } from '@/lib/trends';
import { formatShortDate } from '@/lib/dateUtils';

interface TrendChartProps {
  /** X range (inclusive dates). */
  start: string;
  end: string;
  /** Recorded values, drawn as light dots. */
  raw: TrendPoint[];
  /** The smoothed trend, drawn as the line. */
  line: TrendPoint[];
  /** Short ranges: the line simply joins the daily values (dots drawn solid). */
  rawIsLine?: boolean;
  /** e.g. today's not-yet-finished total — a hollow dot, not part of the line. */
  pending?: TrendPoint | null;
  pendingLabel?: string;
  reference?: { value: number; label: string };
  domain: [number, number];
  color: string;
  format: (v: number) => string;
  rawLabel: string;
  lineLabel: string;
  height?: number;
  ariaLabel: string;
}

const PAD = { top: 14, right: 46, bottom: 22, left: 36 };
const TOUCH_HOLD_MS = 2500;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => { if (el.clientWidth > 0) setWidth(el.clientWidth); };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * A time-series chart for longer ranges: daily values as light dots, a bold
 * smoothed trend line, one end label, and a crosshair (drag/hover/arrow keys)
 * that reads out any day. Values aren't printed on every point — that was
 * unreadable past a week.
 */
export function TrendChart({
  start, end, raw, line, rawIsLine = false, pending, pendingLabel = 'So far', reference, domain, color, format,
  rawLabel, lineLabel, height = 170, ariaLabel,
}: TrendChartProps) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<string | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current); }, []);

  const x0 = dayIndex(start);
  const span = Math.max(1, dayIndex(end) - x0);
  const plotW = Math.max(40, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const [lo, hi] = domain;
  const xFor = (date: string) => PAD.left + ((dayIndex(date) - x0) / span) * plotW;
  const yFor = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;

  const yTicks = useMemo(() => niceTicks(lo, hi, 4).filter((t) => t >= lo && t <= hi), [lo, hi]);
  const xTicks = useMemo(() => dateTicks(start, end, width < 360 ? 5 : 7), [start, end, width]);

  const rawByDate = useMemo(() => new Map(raw.map((p) => [p.date, p.value])), [raw]);
  // Every date the crosshair can stop on, in order.
  const stops = useMemo(() => {
    const set = new Set<string>([...raw.map((p) => p.date), ...line.map((p) => p.date)]);
    if (pending) set.add(pending.date);
    return [...set].sort();
  }, [raw, line, pending]);

  const linePath = line.map((p, i) => `${i ? 'L' : 'M'}${xFor(p.date).toFixed(1)},${yFor(p.value).toFixed(1)}`).join(' ');
  const last = line[line.length - 1];
  const dotR = span > 120 ? 1.6 : span > 40 ? 2.2 : 3;

  const nearest = (clientX: number, rect: DOMRect) => {
    const day = x0 + ((clientX - rect.left - PAD.left) / plotW) * span;
    let best: string | null = null;
    let bestDist = Infinity;
    for (const d of stops) {
      const dist = Math.abs(dayIndex(d) - day);
      if (dist < bestDist) { best = d; bestDist = dist; }
    }
    return best;
  };

  const onPointer = (e: ReactPointerEvent<SVGRectElement>) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setActive(nearest(e.clientX, (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect()));
  };
  const onPointerEnd = (e: ReactPointerEvent) => {
    // A finger lifts off the chart; keep the readout up briefly so it can be read.
    if (e.pointerType === 'mouse') return;
    holdTimer.current = setTimeout(() => setActive(null), TOUCH_HOLD_MS);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = active ? stops.indexOf(active) : stops.length;
    const next = stops[Math.min(stops.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))];
    setActive(next ?? null);
  };

  const activeRaw = active ? rawByDate.get(active) : undefined;
  // The trend at any day (between its points), so every readout has it.
  const activeLine = active ? valueAt(line, active) : undefined;
  const activePending = active && pending?.date === active ? pending.value : undefined;
  const tipX = active ? xFor(active) : 0;
  const tipLeft = Math.min(Math.max(tipX - 85, 0), width - 170);

  return (
    <div ref={wrapRef} className="relative w-full select-none" data-chart>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="block outline-none focus-visible:ring-2 ring-emerald-500/40 rounded-lg"
        style={{ touchAction: 'pan-y' }}
      >
        {/* Recessive grid: solid hairlines, muted labels. */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.left} x2={PAD.left + plotW} y1={yFor(t)} y2={yFor(t)} className="stroke-gray-100 dark:stroke-gray-800" strokeWidth={1} />
            <text x={PAD.left - 6} y={yFor(t)} dy="0.32em" textAnchor="end" fontSize={10} className="fill-gray-400">
              {t.toLocaleString()}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text
            key={`x${t.date}`}
            x={xFor(t.date)}
            y={height - 6}
            fontSize={10}
            textAnchor={i === 0 && xFor(t.date) < PAD.left + 12 ? 'start' : 'middle'}
            className="fill-gray-400"
          >
            {t.label}
          </text>
        ))}

        {reference && reference.value >= lo && reference.value <= hi && (
          <g>
            <line x1={PAD.left} x2={PAD.left + plotW} y1={yFor(reference.value)} y2={yFor(reference.value)} className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1} />
            {/* At the left end, clear of the trend's end label on the right. */}
            <text
              x={PAD.left + 3}
              y={yFor(reference.value) - 4}
              fontSize={9}
              paintOrder="stroke"
              strokeWidth={3}
              className="fill-gray-400 stroke-white dark:stroke-gray-900"
            >
              {reference.label}
            </text>
          </g>
        )}

        {/* Daily values: light dots behind the trend. */}
        {raw.map((p) => (
          <circle key={`r${p.date}`} cx={xFor(p.date)} cy={yFor(p.value)} r={dotR} fill={color} fillOpacity={rawIsLine ? 1 : 0.28} />
        ))}

        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {pending && pending.value >= lo && pending.value <= hi && (
          <circle cx={xFor(pending.date)} cy={yFor(pending.value)} r={3.5} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="2 2" />
        )}

        {/* One direct label: where the trend ends. */}
        {last && !active && (
          <g>
            <circle cx={xFor(last.date)} cy={yFor(last.value)} r={4} fill={color} className="stroke-white dark:stroke-gray-900" strokeWidth={2} />
            <text x={xFor(last.date) + 7} y={yFor(last.value)} dy="0.32em" fontSize={10} fontWeight={700} className="fill-gray-700 dark:fill-gray-200">
              {format(last.value)}
            </text>
          </g>
        )}

        {active && (
          <g pointerEvents="none">
            <line x1={tipX} x2={tipX} y1={PAD.top} y2={PAD.top + plotH} className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1} />
            {activeLine !== undefined && <circle cx={tipX} cy={yFor(activeLine)} r={4} fill={color} className="stroke-white dark:stroke-gray-900" strokeWidth={2} />}
            {activeRaw !== undefined && <circle cx={tipX} cy={yFor(activeRaw)} r={3} fill={color} />}
          </g>
        )}

        {/* Hit area: the whole plot, so the pointer only has to find the date. */}
        <rect
          x={PAD.left}
          y={0}
          width={plotW}
          height={height}
          fill="transparent"
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onPointerUp={onPointerEnd}
          onPointerCancel={() => setActive(null)}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null); }}
        />
      </svg>

      {active && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 w-[170px] rounded-xl bg-white/95 dark:bg-gray-800/95 shadow-md border border-gray-100 dark:border-gray-700 px-2.5 py-1.5 text-[11px]"
          style={{ left: tipLeft }}
        >
          <p className="text-gray-400 font-medium">
            {formatShortDate(active)}
          </p>
          {activePending !== undefined && <Row color={color} value={format(activePending)} label={pendingLabel} dashed />}
          {activeRaw !== undefined && <Row color={color} value={format(activeRaw)} label={rawLabel} faint={!rawIsLine} />}
          {activeLine !== undefined && !rawIsLine && <Row color={color} value={format(activeLine)} label={lineLabel} />}
        </div>
      )}

      {/* The numbers, for screen readers. */}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead><tr><th>Date</th><th>{lineLabel}</th></tr></thead>
        <tbody>
          {line.map((p) => <tr key={p.date}><td>{p.date}</td><td>{format(p.value)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function Row({ color, value, label, faint, dashed }: { color: string; value: string; label: string; faint?: boolean; dashed?: boolean }) {
  return (
    <p className="flex items-center gap-1.5 mt-0.5">
      <span
        className="inline-block w-3 h-0 border-t-2 flex-shrink-0"
        style={{ borderColor: color, opacity: faint ? 0.4 : 1, borderStyle: dashed ? 'dashed' : 'solid' }}
      />
      <span className="font-bold text-gray-900 dark:text-white">{value}</span>
      <span className="text-gray-400 truncate">{label}</span>
    </p>
  );
}
