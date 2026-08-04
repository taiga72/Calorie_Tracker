import type { MealType, FoodItem } from '@/types';

// Read API key from Vite environment variables first
const ENV_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Use a valid current Gemini model name
const MODEL = 'gemini-3.5-flash';
const VERSION = 'v1beta';

function endpoint(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/${VERSION}/models/${MODEL}:generateContent?key=${apiKey}`;
}

const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function normalizeImageMime(mime: string | undefined): string {
  const m = (mime || '').trim().toLowerCase();
  return SUPPORTED_IMAGE_MIME_TYPES.has(m) ? m : 'image/jpeg';
}

export function resolveApiKey(userKey?: string): string {
  const key = (userKey && userKey.trim()) || ENV_API_KEY;
  if (!key) {
    throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your environment settings.');
  }
  return key;
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
  images?: Array<{ data: string; mimeType: string }>
): Promise<ParsedMeal> {
  const key = resolveApiKey(apiKey);

  const parts: GeminiPart[] = [{ text: SYSTEM_PROMPT }];
  const hasImages = images && images.length > 0;
  const userText = text.trim() || (hasImages
    ? `Estimate the total nutrition across all ${images!.length === 1 ? 'attached image' : `${images!.length} attached images`} combined.`
    : '');
  parts.push({ text: userText });
  if (hasImages) {
    for (const img of images!) {
      if (typeof img.data === 'string' && img.data.length > 0) {
        parts.push({ inlineData: { mimeType: normalizeImageMime(img.mimeType), data: img.data.trim() } });
      }
    }
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096 },
  };

  const res = await fetch(endpoint(key), {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
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

    throw new Error(`Gemini API error (${res.status}): ${detail || res.statusText}`);
  }

  const data: { candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[] } = await res.json();
  const candidate = data?.candidates?.[0];
  // Concatenate every part's text — the response can be split across multiple
  // parts, and using only the first one silently drops the rest of the JSON.
  const textOut = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();

  if (!textOut) throw new Error('Gemini returned an empty response.');

  let parsed: ParsedMeal | undefined;
  try {
    // With responseMimeType: 'application/json' the text is normally already
    // pure JSON; only fall back to extracting a {...} substring if that fails.
    parsed = JSON.parse(textOut);
  } catch {
    const match = textOut.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        // fall through — handled by the !parsed check below
      }
    }
  }

  if (!parsed) {
    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new Error("Gemini's response was cut off before it finished. Try describing fewer items, or fewer/smaller photos, at once.");
    }
    throw new Error("Could not parse Gemini's response as JSON.");
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
      resolve({ data: result.slice(comma + 1), mimeType: normalizeImageMime(file.type) });
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

const COMPRESS_MAX = 480;
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
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
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