import { describe, expect, it } from 'vitest';
import { HOME_LAYOUT, resolveLayout, toLayout, visibleCards } from '@/lib/layout';

describe('card layouts', () => {
  it('defaults to the standard Home', () => {
    expect(visibleCards(undefined, HOME_LAYOUT)).toEqual(['summary', 'brief', 'meals']);
  });

  it('keeps a saved order and hidden cards', () => {
    const saved = { order: ['meals', 'summary', 'brief', 'quickPins', 'forecast', 'milestones'] as const, hidden: ['brief'] as const };
    expect(visibleCards({ order: [...saved.order], hidden: [...saved.hidden] }, HOME_LAYOUT)).toEqual(['meals', 'summary', 'quickPins', 'forecast', 'milestones']);
  });

  it('adds cards a saved layout predates, after the card they follow', () => {
    const items = resolveLayout({ order: ['meals', 'summary', 'brief'], hidden: [] }, HOME_LAYOUT);
    expect(items.map((i) => i.id)).toEqual(['meals', 'summary', 'brief', 'quickPins', 'forecast', 'milestones']);
    expect(items.find((i) => i.id === 'quickPins')?.visible).toBe(false);
  });

  it('round-trips', () => {
    const items = resolveLayout(undefined, HOME_LAYOUT);
    expect(resolveLayout(toLayout(items), HOME_LAYOUT)).toEqual(items);
  });
});
