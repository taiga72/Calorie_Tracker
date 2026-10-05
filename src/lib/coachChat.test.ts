import { beforeEach, describe, expect, it } from 'vitest';
import { loadCoachChat, saveCoachChat, MAX_STORED_MESSAGES } from '@/lib/coachChat';

beforeEach(() => localStorage.clear());

describe('coach chat history', () => {
  it('keeps the conversation per account', () => {
    saveCoachChat('u1', [{ role: 'user', text: 'Hi' }, { role: 'model', text: 'Hello!' }]);
    expect(loadCoachChat('u1')).toHaveLength(2);
    expect(loadCoachChat('u2')).toEqual([]);
    expect(loadCoachChat(undefined)).toEqual([]);
  });

  it('keeps only the most recent messages', () => {
    const many = Array.from({ length: MAX_STORED_MESSAGES + 10 }, (_, i) => ({ role: 'user' as const, text: `m${i}` }));
    saveCoachChat('u1', many);
    const kept = loadCoachChat('u1');
    expect(kept).toHaveLength(MAX_STORED_MESSAGES);
    expect(kept[kept.length - 1].text).toBe(`m${MAX_STORED_MESSAGES + 9}`);
  });

  it('clears on a new chat and ignores junk', () => {
    saveCoachChat('u1', [{ role: 'user', text: 'Hi' }]);
    saveCoachChat('u1', []);
    expect(loadCoachChat('u1')).toEqual([]);
    localStorage.setItem('cc_coach_chat:u1', '{"not":"a list"}');
    expect(loadCoachChat('u1')).toEqual([]);
  });
});
