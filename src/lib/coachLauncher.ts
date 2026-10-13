/**
 * Opens the AI coach from anywhere (e.g. "Ask the coach" on an insight),
 * optionally with a question already typed in for the user to send.
 */
export const OPEN_COACH_EVENT = 'cc:open-coach';

export function openCoach(question?: string): void {
  window.dispatchEvent(new CustomEvent<string | undefined>(OPEN_COACH_EVENT, { detail: question }));
}
