import { describe, expect, it } from 'vitest';
import { dayStatus, goalTolerance, isOverGoal, isPartialDay } from '@/lib/goal';

describe('goal rules', () => {
  it('allows 5% over the goal', () => {
    expect(goalTolerance(2000)).toBe(100);
    expect(isOverGoal(2100, 2000)).toBe(false);
    expect(isOverGoal(2101, 2000)).toBe(true);
  });

  it('treats a finished day under half the goal as partly logged', () => {
    expect(isPartialDay(999, 2000)).toBe(true);
    expect(isPartialDay(1000, 2000)).toBe(false);
    expect(isPartialDay(0, 2000)).toBe(false);
  });

  it('classifies days', () => {
    expect(dayStatus(0, 2000)).toBe('empty');
    expect(dayStatus(400, 2000)).toBe('partial');
    expect(dayStatus(1900, 2000)).toBe('within');
    expect(dayStatus(2080, 2000)).toBe('within');
    expect(dayStatus(2300, 2000)).toBe('over');
  });

  it("doesn't call today partial while it's still going", () => {
    expect(dayStatus(400, 2000, { inProgress: true })).toBe('within');
  });
});
