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

  it('throws when no user key is given and no environment key is configured', () => {
    expect(() => resolveApiKey('')).toThrow(/Gemini API key is not configured/);
    expect(() => resolveApiKey('   ')).toThrow(/Gemini API key is not configured/);
    expect(() => resolveApiKey(undefined)).toThrow(/Gemini API key is not configured/);
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

  it('rejects immediately, without calling fetch, when no API key is available', async () => {
    await expect(estimateMeal('', 'some food')).rejects.toThrow(/Gemini API key is not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
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

  it('sends the API key in both the query string and the x-goog-api-key header', async () => {
    fetchMock.mockResolvedValueOnce(
      geminiTextResponse({ mealType: 'Snack', items: [], calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '' })
    );
    await estimateMeal('user-key', 'text');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('key=user-key');
    expect((init as RequestInit).headers).toMatchObject({ 'x-goog-api-key': 'user-key' });
  });

  it('attaches a single image with a normalized mime type', async () => {
    fetchMock.mockResolvedValueOnce(
      geminiTextResponse({ mealType: 'Snack', items: [], calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '' })
    );
    await estimateMeal('user-key', '', [{ data: 'BASE64DATA', mimeType: 'image/heic' }]);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    const parts = body.contents[0].parts;
    const imageParts = parts.filter((p: { inlineData?: unknown }) => p.inlineData);
    expect(imageParts).toHaveLength(1);
    expect(imageParts[0].inlineData).toEqual({ mimeType: 'image/jpeg', data: 'BASE64DATA' });
  });

  it('attaches multiple images, each with its own normalized mime type', async () => {
    fetchMock.mockResolvedValueOnce(
      geminiTextResponse({ mealType: 'Snack', items: [], calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '' })
    );
    await estimateMeal('user-key', '', [
      { data: 'FIRST', mimeType: 'image/png' },
      { data: 'SECOND', mimeType: 'image/heic' },
    ]);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    const parts = body.contents[0].parts;
    const imageParts = parts.filter((p: { inlineData?: unknown }) => p.inlineData);
    expect(imageParts).toHaveLength(2);
    expect(imageParts[0].inlineData).toEqual({ mimeType: 'image/png', data: 'FIRST' });
    expect(imageParts[1].inlineData).toEqual({ mimeType: 'image/jpeg', data: 'SECOND' });
  });

  it('uses a generic multi-image prompt when no text is given', async () => {
    fetchMock.mockResolvedValueOnce(
      geminiTextResponse({ mealType: 'Snack', items: [], calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '' })
    );
    await estimateMeal('user-key', '', [
      { data: 'A', mimeType: 'image/jpeg' },
      { data: 'B', mimeType: 'image/jpeg' },
    ]);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    const textPart = body.contents[0].parts[1];
    expect(textPart.text).toMatch(/2 attached images/);
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

  it('reassembles JSON split across multiple response parts', async () => {
    const json = JSON.stringify({
      mealType: 'Lunch',
      items: [{ name: 'Salad', calories: 220, protein: 6, carbs: 18, fat: 12, fiber: 5 }],
      calories: 220,
      protein: 6,
      carbs: 18,
      fat: 12,
      fiber: 5,
      reasoning: 'A salad.',
    });
    const half = Math.floor(json.length / 2);
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, {
        candidates: [{ content: { parts: [{ text: json.slice(0, half) }, { text: json.slice(half) }] } }],
      })
    );

    const result = await estimateMeal('user-key', 'a salad');
    expect(result.items[0].name).toBe('Salad');
    expect(result.calories).toBe(220);
  });

  it('gives a clear "cut off" error when the response is truncated by the token limit', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, {
        candidates: [{
          content: { parts: [{ text: '{"mealType": "Lunch", "items": [{"name": "Salad", "calories": 22' }] },
          finishReason: 'MAX_TOKENS',
        }],
      })
    );

    await expect(estimateMeal('user-key', 'a huge meal')).rejects.toThrow(/cut off/i);
  });

  it('falls back to a generic parse error for malformed JSON that was not truncated', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, {
        candidates: [{
          content: { parts: [{ text: '{"mealType": "Lunch", items: [}' }] },
          finishReason: 'STOP',
        }],
      })
    );

    await expect(estimateMeal('user-key', 'text')).rejects.toThrow(/Could not parse Gemini's response as JSON/);
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
    await expect(estimateMeal('user-key', 'text')).rejects.toThrow(/Could not parse Gemini's response as JSON/);
  });

  it('rejects when items is missing from the parsed response', async () => {
    fetchMock.mockResolvedValueOnce(geminiTextResponse({ mealType: 'Snack', calories: 100, reasoning: '' }));
    await expect(estimateMeal('user-key', 'text')).rejects.toThrow(/missing items array/);
  });

  it('rejects when the response has no text content', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { candidates: [] }));
    await expect(estimateMeal('user-key', 'text')).rejects.toThrow(/empty response/);
  });

  it('throws a RateLimitError on 429, parsing Retry-After header', async () => {
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

  it('throws immediately on a non-429 error status without retrying', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(503, { error: { message: 'Overloaded' } }));
    await expect(estimateMeal('user-key', 'text')).rejects.toThrow(/Gemini API error \(503\)/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

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
    expect(result.data).toBe(btoa('hello world'));
  });

  it('keeps a supported image mime type as-is', async () => {
    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    const result = await fileToBase64(file);
    expect(result.mimeType).toBe('image/png');
  });

  it('normalizes an unsupported mime type to image/jpeg', async () => {
    const file = new File(['data'], 'photo.heic', { type: 'image/heic' });
    const result = await fileToBase64(file);
    expect(result.mimeType).toBe('image/jpeg');
  });
});
