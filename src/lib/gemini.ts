import type { MealType, FoodItem } from '@/types';

// Models ordered by priority
const MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const VERSION = 'v1beta';

function endpoint(modelName: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/${VERSION}/models/${modelName}:generateContent?key=${apiKey}`;
}

export class RateLimitError extends Error {
  retryAfterSec: number;
  constructor(retryAfterSec: number, detail: string) {
    super(`Rate limit reached across all fallback models. ${detail}`);
    this.name = 'RateLimitError';
    this.retryAfterSec = retryAfterSec;
  }
}

export interface ParsedMeal {
  mealType: MealType;
  items: FoodItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  reasoning: string;
}

const SYSTEM_PROMPT = `You are a precise nutrition estimator. The user will describe or show a meal via text and/or an image.
Estimate the nutritional content and respond with ONLY a JSON object (no markdown, no backticks) with this exact shape:
{
  "mealType": "Breakfast" | "Lunch" | "Dinner" | "Snack",
  "items": [{ "name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number }],
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number,
  "reasoning": string
}
Rules:
- mealType must be inferred from the foods and time of day if known; default to the meal that best fits the description.
- All macro values are in grams. calories in kcal. fiber in grams.
- items should list each distinct food/drink component with its own macros.
- The top-level totals must equal the sum across items.
- reasoning should be one or two short sentences explaining how you estimated portions/macros.
- Output ONLY the JSON object.`;

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiErrorBody {
  error?: { message?: string; details?: { retryDelay?: string }[] };
}

function parseRetrySecs(res: Response, body: GeminiErrorBody | null): number {
  const retryAfter = res.headers.get('Retry-After');
  if (retryAfter) {
    const secs = parseInt(retryAfter, 10);
    if (!Number.isNaN(secs)) return Math.min(Math.max(secs, 1), 120);
  }
  const retryInfo = res.headers.get('Retry-Info');
  if (retryInfo) {
    const m = retryInfo.match(/(\d+)\s*s/i);
    if (m) return Math.min(Math.max(parseInt(m[1], 10), 1), 120);
  }
  if (body?.error?.details && Array.isArray(body.error.details)) {
    for (const d of body.error.details) {
      if (d?.retryDelay) {
        const m = d.retryDelay.match(/(\d+)\s*s/i);
        if (m) return Math.min(Math.max(parseInt(m[1], 10), 1), 120);
      }
    }
  }
  return 30;
}

export async function estimateMeal(
  apiKey: string,
  text: string,
  imageBase64?: { data: string; mimeType: string }
): Promise<ParsedMeal> {
  if (!apiKey) throw new Error('No Gemini API key set. Add one in Settings.');

  const parts: GeminiPart[] = [{ text: SYSTEM_PROMPT }];
  const userText = text.trim() || (imageBase64 ? 'Estimate this meal from the attached image.' : '');
  parts.push({ text: userText });
  if (imageBase64) {
    parts.push({ inlineData: { mimeType: imageBase64.mimeType, data: imageBase64.data } });
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json' },
  };

  let lastErrorDetail = '';
  let maxRetrySecs = 30;

  // Try each model in sequence until one succeeds
  for (const modelName of MODELS) {
    try {
      const res = await fetch(endpoint(modelName, apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let detail = '';
        let parsedBody: GeminiErrorBody | null = null;
        try {
          parsedBody = (await res.json()) as GeminiErrorBody;
          detail = parsedBody?.error?.message || JSON.stringify(parsedBody);
        } catch {
          detail = await res.text().catch(() => '');
        }

        // If rate-limited (429), catch it and attempt the next model in the list
        if (res.status === 429) {
          console.warn(`[Gemini Fallback] Model ${modelName} hit rate limit (429). Trying next fallback model...`);
          lastErrorDetail = detail || 'Rate limit exceeded.';
          maxRetrySecs = parseRetrySecs(res, parsedBody);
          continue; // Move to the next model in MODELS
        }

        throw new Error(`Gemini API error (${res.status}): ${detail || res.statusText}`);
      }

      const data: { candidates?: { content?: { parts?: GeminiPart[] } }[] } = await res.json();
      const textOut: string | undefined =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        data?.candidates?.[0]?.content?.parts?.map((p: GeminiPart) => p.text).join('');

      if (!textOut) throw new Error('Gemini returned an empty response.');

      let parsed: ParsedMeal;
      const match = textOut.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('Could not parse Gemini response as JSON.');
      }

      try {
        parsed = JSON.parse(match[0]);
      } catch {
        throw new Error('Failed to parse clean JSON object from Gemini response.');
      }

      if (!parsed.items || !Array.isArray(parsed.items)) {
        throw new Error('Gemini response missing items array.');
      }
      const validTypes: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
      if (!validTypes.includes(parsed.mealType)) {
        parsed.mealType = 'Snack';
      }
      parsed.items = parsed.items.map((it) => ({
        name: String(it.name || 'Item'),
        calories: Number(it.calories) || 0,
        protein: Number(it.protein) || 0,
        carbs: Number(it.carbs) || 0,
        fat: Number(it.fat) || 0,
        fiber: Number(it.fiber) || 0,
      }));
      const sum = (sel: (i: FoodItem) => number) => parsed.items.reduce((a, b) => a + sel(b), 0);
      parsed.calories = Number(parsed.calories) || sum((i) => i.calories);
      parsed.protein = Number(parsed.protein) || sum((i) => i.protein);
      parsed.carbs = Number(parsed.carbs) || sum((i) => i.carbs);
      parsed.fat = Number(parsed.fat) || sum((i) => i.fat);
      parsed.fiber = Number(parsed.fiber) || sum((i) => i.fiber);
      parsed.reasoning = String(parsed.reasoning || '');

      return parsed; // Return successfully on the first model that works
    } catch (err: any) {
      // If it's a non-429 error (e.g. invalid JSON, bad request), rethrow immediately
      if (!err?.message?.includes('429') && err.name !== 'RateLimitError') {
        throw err;
      }
    }
  }

  // If all models in the list failed due to rate limits
  throw new RateLimitError(maxRetrySecs, lastErrorDetail || 'All fallback models reached their free rate limits.');
}

export function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve({ data: result.slice(comma + 1), mimeType: file.type || 'image/jpeg' });
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}