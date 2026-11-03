import { describe, expect, it } from 'vitest';
import { HOME_LAYOUT, resolveLayout, toLayout, visibleCards } from '@/lib/layout';

describe('card layouts', () => {
  it('defaults to the standard Home', () => {
    // Today's log (meals, then exercise) before tips.
    expect(visibleCards(undefined, HOME_LAYOUT)).toEqual(['summary', 'brief', 'meals', 'activity', 'insights']);
  });

  it('keeps a saved order and hidden cards', () => {
    const saved = { order: ['meals', 'summary', 'brief', 'quickPins', 'forecast', 'milestones'] as const, hidden: ['brief'] as const };
    expect(visibleCards({ order: [...saved.order], hidden: [...saved.hidden] }, HOME_LAYOUT)).toEqual(['meals', 'activity', 'insights', 'summary', 'quickPins', 'forecast', 'milestones']);
  });

  it('adds cards a saved layout predates, after the card they follow', () => {
    const items = resolveLayout({ order: ['meals', 'summary', 'brief'], hidden: [] }, HOME_LAYOUT);
    expect(items.map((i) => i.id)).toEqual(['meals', 'activity', 'insights', 'forecast', 'milestones', 'summary', 'brief', 'quickPins']);
    expect(items.find((i) => i.id === 'quickPins')?.visible).toBe(false);
  });

  it('skips cards that no longer exist (e.g. the removed check-in)', () => {
    const saved = { order: ['summary', 'checkin', 'meals'], hidden: [] } as unknown as Parameters<typeof visibleCards>[0];
    expect(visibleCards(saved, HOME_LAYOUT)).not.toContain('checkin');
  });

  it('round-trips', () => {
    const items = resolveLayout(undefined, HOME_LAYOUT);
    expect(resolveLayout(toLayout(items), HOME_LAYOUT)).toEqual(items);
  });
});
