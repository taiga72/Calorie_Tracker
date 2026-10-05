import type { CoachMessage } from '@/lib/geminiCoach';

/**
 * The coach conversation is kept on this device (per account) so closing the
 * sheet doesn't throw it away. Only the most recent messages are kept, and
 * fewer still are sent back to the model with each question.
 */
const KEY_PREFIX = 'cc_coach_chat:';
export const MAX_STORED_MESSAGES = 40;
export const MAX_HISTORY_SENT = 12;

export function loadCoachChat(userId: string | undefined): CoachMessage[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(KEY_PREFIX + userId);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is CoachMessage =>
        !!m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string',
    );
  } catch {
    return [];
  }
}

export function saveCoachChat(userId: string | undefined, messages: CoachMessage[]): void {
  if (!userId) return;
  try {
    if (messages.length === 0) localStorage.removeItem(KEY_PREFIX + userId);
    else localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  } catch {
    // Storage full or blocked: the chat just won't survive a reload.
  }
}
