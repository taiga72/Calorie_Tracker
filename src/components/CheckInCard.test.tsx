import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CheckIn } from '@/types';

let checkins: CheckIn[] = [];
const saveCheckIn = vi.fn((date: string, patch: Partial<CheckIn>) => {
  const prev = checkins.find((c) => c.date === date);
  checkins = [...checkins.filter((c) => c.date !== date), { ...prev, ...patch, date, createdAt: 1 }];
});
vi.mock('@/store', () => ({ useStore: () => ({ checkins, saveCheckIn }) }));

const { CheckInCard, checkInSummary } = await import('@/components/CheckInCard');

beforeEach(() => {
  checkins = [];
  vi.clearAllMocks();
});

describe('CheckInCard', () => {
  it('saves each answer for the day', () => {
    render(<CheckInCard date="2026-10-13" />);
    fireEvent.click(screen.getByLabelText('Sleep: Good'));
    expect(saveCheckIn).toHaveBeenCalledWith('2026-10-13', { sleep: 4 });
  });

  it('collapses to a summary once all four are answered, and can be edited', () => {
    checkins = [{ date: '2026-10-13', sleep: 2, energy: 3, hunger: 5, mood: 4, createdAt: 1 }];
    render(<CheckInCard date="2026-10-13" />);
    expect(screen.getByText("Today's check-in")).toBeInTheDocument();
    expect(screen.getByText(/Sleep poor/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Edit check-in'));
    expect(screen.getByText('How are you today?')).toBeInTheDocument();
    expect(screen.getByLabelText('Hunger: Starving')).toHaveAttribute('aria-checked', 'true');
  });

  it('summarises only what was answered', () => {
    expect(checkInSummary({ date: 'x', mood: 5, createdAt: 1 })).toBe('😄 Mood great');
    expect(checkInSummary(undefined)).toBe('');
  });
});
