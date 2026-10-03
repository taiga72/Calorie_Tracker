import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrendChart } from '@/components/TrendChart';

const raw = Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, value: 1800 + (i % 5) * 100 }));
const line = raw.slice(1).map((p) => ({ ...p, value: 2000 }));

function renderChart(extra: Partial<Parameters<typeof TrendChart>[0]> = {}) {
  return render(
    <TrendChart
      start="2026-09-01" end="2026-09-30" raw={raw} line={line} domain={[1500, 2500]}
      color="#F97316" format={(v) => Math.round(v).toLocaleString()}
      rawLabel="kcal that day" lineLabel="7-day average" ariaLabel="Calories" {...extra}
    />,
  );
}

describe('TrendChart', () => {
  it('labels only the end of the trend, not every point', () => {
    const { container } = renderChart();
    const svgTexts = Array.from(container.querySelectorAll('svg text')).map((t) => t.textContent);
    expect(svgTexts.filter((t) => t === '2,000')).toHaveLength(2); // y tick + end label
    expect(container.querySelectorAll('circle').length).toBe(raw.length + 1); // dots + end marker
  });

  it('reads out a day with the arrow keys (crosshair)', () => {
    renderChart();
    const svg = screen.getByRole('img', { name: 'Calories' });
    fireEvent.keyDown(svg, { key: 'ArrowLeft' });
    const tip = screen.getByRole('status');
    expect(tip).toHaveTextContent('Sep 30');
    expect(tip).toHaveTextContent('2,200');
    expect(tip).toHaveTextContent('kcal that day');
    expect(tip).toHaveTextContent('7-day average');
  });

  it('shows an in-progress day separately', () => {
    renderChart({ pending: { date: '2026-09-30', value: 1600 }, pendingLabel: 'Today so far' });
    fireEvent.keyDown(screen.getByRole('img', { name: 'Calories' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('status')).toHaveTextContent('Today so far');
  });

  it('draws a reference line for the goal', () => {
    renderChart({ reference: { value: 2000, label: 'Goal' } });
    expect(screen.getByText('Goal')).toBeInTheDocument();
  });

  it('keeps a data table for screen readers', () => {
    renderChart();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(line.length + 1);
  });
});
