import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Settings } from '@/types';

let settings: Settings;
const updatePrefs = vi.fn((p: Settings['prefs']) => { settings = { ...settings, prefs: { ...settings.prefs, ...p } }; });
vi.mock('@/store', () => ({ useStore: () => ({ settings, updatePrefs }) }));

const { ProteinTarget } = await import('@/components/ProteinTarget');

beforeEach(() => {
  updatePrefs.mockClear();
  settings = { calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: -0.5, weightUnit: 'kg', geminiApiKey: '' };
});

describe('ProteinTarget', () => {
  it('sets protein as fixed grams', () => {
    const onGramsChange = vi.fn();
    render(<ProteinTarget grams="120" onGramsChange={onGramsChange} latestWeightKg={80} />);
    expect(screen.getByRole('button', { name: 'Grams' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Protein grams'), { target: { value: '130' } });
    expect(onGramsChange).toHaveBeenCalledWith('130');
  });

  it('switches to grams per kg of body weight, showing the grams that works out to', () => {
    const { rerender } = render(<ProteinTarget grams="120" onGramsChange={vi.fn()} latestWeightKg={80} />);
    fireEvent.click(screen.getByRole('button', { name: 'Per kg' }));
    expect(updatePrefs).toHaveBeenCalledWith({ proteinPerKg: 1.6 });
    rerender(<ProteinTarget grams="120" onGramsChange={vi.fn()} latestWeightKg={80} />);
    expect(screen.getByLabelText('Protein grams per kg')).toHaveValue('1.6');
    expect(screen.getByText('= 128 g')).toBeInTheDocument();
  });

  it('back to grams clears the per-kg setting', () => {
    settings.prefs = { proteinPerKg: 1.6 };
    render(<ProteinTarget grams="120" onGramsChange={vi.fn()} latestWeightKg={80} />);
    fireEvent.click(screen.getByRole('button', { name: 'Grams' }));
    expect(updatePrefs).toHaveBeenCalledWith({ proteinPerKg: null });
  });
});
