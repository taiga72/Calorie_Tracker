import { describe, expect, it } from 'vitest';
import { friendlyAiError } from '@/lib/aiErrors';

const err = (message: string, status?: number) => Object.assign(new Error(message), { status });

describe('friendlyAiError', () => {
  it('explains common failures in plain words', () => {
    expect(friendlyAiError(err('Network error while contacting Gemini.', 0))).toMatch(/check your connection/);
    expect(friendlyAiError(err('Gemini API error (503): overloaded', 503))).toMatch(/busy/);
    expect(friendlyAiError(err('Gemini API error (403): denied', 403))).toMatch(/API key/);
    expect(friendlyAiError(err("Could not parse Gemini's response as JSON."))).toMatch(/didn't come through/);
    expect(friendlyAiError(err("Gemini's response was cut off before it finished."))).toMatch(/fewer items/);
    expect(friendlyAiError('weird')).toMatch(/Something went wrong/);
  });
});
