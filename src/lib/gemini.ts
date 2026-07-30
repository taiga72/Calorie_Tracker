import type { MealType, FoodItem } from '@/types';

const DEFAULT_API_KEY = 'AQ.Ab8RN6InG_lJeThIdBJZR3LEcRrJ9vtf8n8WhIcZn2GWDeyZZA';

const PRIMARY_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';
const VERSION = 'v1beta';
const RETRY_DELAY_MS = 1000;

function endpoint(apiKey: string, model: string): string {
  return `https://generativelanguage.googleapis.com/${VERSION}/models/${model}:generateContent?key=${apiKey}`;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function resolveApiKey(userKey?: string): string {
  return (userKey && userKey.trim()) || DEFAULT_API_KEY;
}

export class RateLimitError extends Error {
  retryAfterSec: number;
  constructor(retryAfterSec: number, detail: string) {
    super(`Rate limit reached. ${detail}`);
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
  imageB64s?: Array<{ data: string; mimeType: string }>
): Promise<ParsedMeal> {
  const key = resolveApiKey(apiKey);

  const parts: GeminiPart[] = [{ text: SYSTEM_PROMPT }];
  const hasImages = imageB64s && imageB64s.length > 0;
  const userText = text.trim() || (hasImages
    ? `Estimate the total nutrition across all ${imageB64s!.length === 1 ? 'attached image' : `${imageB64s!.length} attached images`} combined.`
    : '');
  parts.push({ text: userText });
  if (hasImages) {
    for (const img of imageB64s!) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    }
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json' },
  };

  return callWithFallback(key, body);
}

async function callWithFallback(key: string, body: unknown): Promise<ParsedMeal> {
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastErr: Error | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callModel(key, model, body);
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        if (err instanceof RateLimitError) throw lastErr;
        const status = (err as ApiError).status;
        const transient = status === 503 || status === 429;
        if (!transient) throw lastErr;
        if (attempt === 0) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
      }
    }
  }

  throw lastErr ?? new Error('All Gemini model attempts failed.');
}

interface ApiError extends Error {
  status?: number;
}

async function callModel(key: string, model: string, body: unknown): Promise<ParsedMeal> {
  const res = await fetch(endpoint(key, model), {
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

    if (res.status === 429) {
      const secs = parseRetrySecs(res, parsedBody);
      throw new RateLimitError(secs, detail || 'Too many requests. Please slow down.');
    }

    if (res.status === 503) {
      const err = new Error(`Gemini API error (503): ${detail || res.statusText}`) as ApiError;
      err.status = 503;
      throw err;
    }

    throw new Error(`Gemini API error (${res.status}): ${detail || res.statusText}`);
  }

  const data: { candidates?: { content?: { parts?: GeminiPart[] } }[] } = await res.json();
  const textOut: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    data?.candidates?.[0]?.content?.parts?.map((p: GeminiPart) => p.text).join('');

  if (!textOut) throw new Error('Gemini returned an empty response.');

  let parsed: ParsedMeal;
  // Always extract only the inner JSON object between curly braces
  const match = textOut.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Could not parse Gemini response as JSON.');
  }

  try {
    parsed = JSON.parse(match[0]);
  } catch (err) {
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
  return parsed;
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

const COMPRESS_MAX = 400;
const COMPRESS_QUALITY = 0.7;

export function compressImage(file: File): Promise<{ dataUrl: string; base64: { data: string; mimeType: string } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > COMPRESS_MAX || height > COMPRESS_MAX) {
          const ratio = Math.min(COMPRESS_MAX / width, COMPRESS_MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported.')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', COMPRESS_QUALITY);
        const comma = dataUrl.indexOf(',');
        resolve({
          dataUrl,
          base64: { data: dataUrl.slice(comma + 1), mimeType: 'image/jpeg' },
        });
      };
      img.onerror = () => reject(new Error('Failed to load image for compression.'));
      img.src = src;
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}
