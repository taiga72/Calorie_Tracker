import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CalorieLineChart } from '@/components/CalorieLineChart';

const data = [
  { label: 'Mon', value: 70 },
  { label: 'Tue', value: 71 },
  { label: 'Wed', value: 69.5 },
];

describe('CalorieLineChart', () => {
  it('renders "No data yet" for an empty series', () => {
    const { getByText } = render(<CalorieLineChart data={[]} />);
    expect(getByText('No data yet')).toBeInTheDocument();
  });

  it('uses the given color for the line and gradient fill', () => {
    const { container } = render(<CalorieLineChart data={data} color="#3B82F6" />);
    const linePath = container.querySelectorAll('path')[1];
    expect(linePath.getAttribute('stroke')).toBe('#3B82F6');
    const stop = container.querySelector('stop');
    expect(stop?.getAttribute('stop-color')).toBe('#3B82F6');
  });

  it('gives each rendered instance a unique gradient id, so two charts on one page do not collide', () => {
    const { container } = render(
      <div>
        <CalorieLineChart data={data} />
        <CalorieLineChart data={data} />
      </div>
    );
    const ids = Array.from(container.querySelectorAll('linearGradient')).map((el) => el.id);
    expect(new Set(ids).size).toBe(2);

    const fills = Array.from(container.querySelectorAll('path[fill^="url(#"]')).map((el) => el.getAttribute('fill'));
    expect(fills).toEqual([`url(#${ids[0]})`, `url(#${ids[1]})`]);
  });
});
