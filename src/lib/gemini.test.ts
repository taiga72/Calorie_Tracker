import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { estimateMeal, resolveApiKey, RateLimitError, fileToBase64 } from '@/lib/gemini';

function mockResponse(status: number, jsonBody: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `Status ${status}`,
    headers: { get: (name: string) => headers[name] ?? null },
    json: async () => jsonBody,
    text: async () => JSON.stringify(jsonBody),
  } as unknown as Response;
}

function geminiTextResponse(parsedMeal: Record<string, unknown>) {
  return mockResponse(200, {
    candidates: [{ content: { parts: [{ text: JSON.stringify(parsedMeal) }] } }],
  });
}

describe('resolveApiKey', () => {
  it('returns the trimmed user key when provided', () => {
    expect(resolveApiKey('  my-key  ')).toBe('my-key');
  });

  it('falls back to the default key when the user key is empty or whitespace', () => {
    expect(resolveApiKey('')).not.toBe('');
    expect(resolveApiKey('   ')).not.toBe('');
    expect(resolveApiKey(undefined)).not.toBe('');
  });
});

describe('estimateMeal', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a well-formed successful response', async () => {
    fetchMock.mockResolvedValueOnce(
      geminiTextResponse({
        mealType: 'Lunch',
        items: [{ name: 'Chicken', calories: 200, protein: 30, carbs: 0, fat: 5, fiber: 0 }],
        calories: 200,
        protein: 30,
        carbs: 0,
        fat: 5,
        fiber: 0,
        reasoning: 'Estimated from description.',
      })
    );

    const result = await estimateMeal('user-key', 'grilled chicken');
    expect(result.mealType).toBe('Lunch');
    expect(result.items).toHaveLength(1);
    expect(result.calories).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('gemini-3.5-flash:generateContent');
  });

  it('extracts JSON even when wrapped in markdown code fences', async () => {
    const raw = '```json\n' + JSON.stringify({
      mealType: 'Snack',
      items: [{ name: 'Apple', calories: 95, protein: 0, carbs: 25, fat: 0, fiber: 4 }],
      calories: 95,
      protein: 0,
      carbs: 25,
      fat: 0,
      fiber: 4,
      reasoning: 'An apple.',
    }) + '\n```';
    fetchMock.mockResolvedValueOnce(mockResponse(200, { candidates: [{ content: { parts: [{ text: raw }] } }] }));

    const result = await estimateMeal('user-key', 'an apple');
    expect(result.items[0].name).toBe('Apple');
  });

  it('defaults an invalid mealType to Snack', async () => {
    fetchMock.mockResolvedValueOnce(
      geminiTextResponse({
        mealType: 'Brunch',
        items: [{ name: 'Waffles', calories: 400, protein: 8, carbs: 50, fat: 15, fiber: 2 }],
        calories: 400,
        protein: 8,
        carbs: 50,
        fat: 15,
        fiber: 2,
        reasoning: '',
      })
    );

    const result = await estimateMeal('user-key', 'waffles');
    expect(result.mealType).toBe('Snack');
  });

  it('sums item macros when top-level totals are missing', async () => {
    fetchMock.mockResolvedValueOnce(
      geminiTextResponse({
        mealType: 'Breakfast',
        items: [
          { name: 'Eggs', calories: 150, protein: 12, carbs: 1, fat: 10, fiber: 0 },
          { name: 'Toast', calories: 120, protein: 4, carbs: 22, fat: 2, fiber: 2 },
        ],
        reasoning: '',
      })
    );

    const result = await estimateMeal('user-key', 'eggs and toast');
    expect(result.calories).toBe(270);
    expect(result.protein).toBe(16);
    expect(result.carbs).toBe(23);
    expect(result.fat).toBe(12);
    expect(result.fiber).toBe(2);
  });

  it('coerces missing/non-numeric item fields to 0', async () => {
    fetchMock.mockResolvedValueOnce(
      geminiTextResponse({
        mealType: 'Snack',
        items: [{ name: undefined, calories: 'not-a-number' }],
        reasoning: '',
      })
    );

    const result = await estimateMeal('user-key', 'mystery snack');
    expect(result.items[0].name).toBe('Item');
    expect(result.items[0].calories).toBe(0);
    expect(result.items[0].protein).toBe(0);
  });

  it('rejects when the response text has no JSON object', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { candidates: [{ content: { parts: [{ text: 'no json here' }] } }] }));
    await expect(estimateMeal('user-key', 'text')).rejects.toThrow(/Could not parse Gemini response as JSON/);
  });

  it('rejects when items is missing from the parsed response', async () => {
    fetchMock.mockResolvedValueOnce(geminiTextResponse({ mealType: 'Snack', calories: 100, reasoning: '' }));
    await expect(estimateMeal('user-key', 'text')).rejects.toThrow(/missing items array/);
  });

  it('rejects when the response has no text content', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { candidates: [] }));
    await expect(estimateMeal('user-key', 'text')).rejects.toThrow(/empty response/);
  });

  it('throws a RateLimitError immediately on 429, parsing Retry-After header, without retrying', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(429, { error: { message: 'Too many requests' } }, { 'Retry-After': '45' })
    );

    const err = await estimateMeal('user-key', 'text').catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as InstanceType<typeof RateLimitError>).retryAfterSec).toBe(45);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('parses retryAfterSec from the error body when no Retry-After header is present', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(429, { error: { message: 'Quota exceeded', details: [{ retryDelay: '12s' }] } })
    );

    const err = await estimateMeal('user-key', 'text').catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as InstanceType<typeof RateLimitError>).retryAfterSec).toBe(12);
  });

  it('clamps an out-of-range retry delay into the 1-120s window', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(429, {}, { 'Retry-After': '99999' }));
    const err = await estimateMeal('user-key', 'text').catch((e) => e);
    expect((err as InstanceType<typeof RateLimitError>).retryAfterSec).toBe(120);
  });

  it('retries the same model once on a 503, then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(503, { error: { message: 'Overloaded' } }))
      .mockResolvedValueOnce(
        geminiTextResponse({
          mealType: 'Dinner',
          items: [{ name: 'Salmon', calories: 350, protein: 34, carbs: 0, fat: 20, fiber: 0 }],
          calories: 350,
          protein: 34,
          carbs: 0,
          fat: 20,
          fiber: 0,
          reasoning: '',
        })
      );

    const result = await estimateMeal('user-key', 'salmon');
    expect(result.mealType).toBe('Dinner');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Both attempts should hit the same (primary) model.
    expect(fetchMock.mock.calls[0][0]).toContain('gemini-3.5-flash:generateContent');
    expect(fetchMock.mock.calls[1][0]).toContain('gemini-3.5-flash:generateContent');
  }, 10000);

  it('falls back to the secondary model after the primary is exhausted on repeated 503s', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(503, { error: { message: 'Overloaded' } }))
      .mockResolvedValueOnce(mockResponse(503, { error: { message: 'Overloaded' } }))
      .mockResolvedValueOnce(
        geminiTextResponse({
          mealType: 'Snack',
          items: [{ name: 'Yogurt', calories: 120, protein: 10, carbs: 12, fat: 3, fiber: 0 }],
          calories: 120,
          protein: 10,
          carbs: 12,
          fat: 3,
          fiber: 0,
          reasoning: '',
        })
      );

    const result = await estimateMeal('user-key', 'yogurt');
    expect(result.mealType).toBe('Snack');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain('gemini-3.5-flash-lite:generateContent');
  }, 10000);

  it('does not retry or fall back on a non-transient error status', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(400, { error: { message: 'Bad request' } }));
    await expect(estimateMeal('user-key', 'text')).rejects.toThrow(/Gemini API error \(400\)/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('fileToBase64', () => {
  it('resolves with base64 data and mime type from a File', async () => {
    const file = new File(['hello world'], 'note.txt', { type: 'text/plain' });
    const result = await fileToBase64(file);
    expect(result.mimeType).toBe('text/plain');
    expect(result.data).toBe(btoa('hello world'));
  });
});
