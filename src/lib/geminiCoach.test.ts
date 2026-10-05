import { describe, it, expect } from 'vitest';
import { cleanCoachText } from '@/lib/geminiCoach';

describe('cleanCoachText', () => {
  it('strips markdown emphasis, code marks, headings and bullets', () => {
    expect(cleanCoachText('**Great week!** You hit `1,850 kcal` on *average*.')).toBe('Great week! You hit 1,850 kcal on average.');
    expect(cleanCoachText('## Summary\n- Logged 6 days\n- Protein was low\n')).toBe('Summary Logged 6 days Protein was low');
    expect(cleanCoachText('```\nNice work.\n```')).toBe('Nice work.');
    expect(cleanCoachText('* Focus on protein *')).toBe('Focus on protein');
  });

  it('leaves normal text alone', () => {
    const t = "Solid week: 5 of 7 days within goal. Next, add protein at breakfast — e.g. Greek yogurt.";
    expect(cleanCoachText(t)).toBe(t);
  });

  it('keeps underscores and asterisk-free math-like text intact', () => {
    expect(cleanCoachText('Aim for 120–130 g protein/day.')).toBe('Aim for 120–130 g protein/day.');
  });
});

describe('cleanCoachText for chat replies', () => {
  it('strips markdown but keeps lines and lists', () => {
    const reply = '**Good question!** Here is the plan:\n\n* Eat `150 g` protein\n- Walk daily\n1. Sleep 8 hours\n\n\n\nYou got this.';
    expect(cleanCoachText(reply, { keepLines: true })).toBe(
      'Good question! Here is the plan:\n\n• Eat 150 g protein\n• Walk daily\n1. Sleep 8 hours\n\nYou got this.',
    );
  });
});
