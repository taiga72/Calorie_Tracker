/**
 * Turns an AI (Gemini) failure into something a person can act on, instead
 * of "Gemini API error (503): …".
 */
export function friendlyAiError(e: unknown): string {
  const status = (e as { status?: number } | null)?.status;
  const msg = e instanceof Error ? e.message : '';
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offline || status === 0 || /network|failed to fetch/i.test(msg)) {
    return "Couldn't reach the AI — check your connection and try again.";
  }
  if (/api key is not configured/i.test(msg)) return 'The AI isn\'t set up yet: add a Gemini API key to use it.';
  if (status === 400 && /api key/i.test(msg)) return "The Gemini API key isn't working — check it and try again.";
  if (status === 401 || status === 403) return "The Gemini API key isn't working — check it and try again.";
  if (status === 503 || status === 500 || status === 502 || status === 504) return 'The AI is busy right now. Try again in a moment.';
  if (/cut off/i.test(msg)) return 'That was too much to estimate in one go — try fewer items or photos at once.';
  if (/parse|empty response|missing items|json/i.test(msg)) return "The AI's answer didn't come through properly. Try again.";
  if (/image|canvas/i.test(msg)) return "Couldn't read that photo — try another one.";
  return "Something went wrong with the AI. Try again.";
}
