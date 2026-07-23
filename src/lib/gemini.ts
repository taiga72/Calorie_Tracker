import type { MealType, FoodItem } from '@/types';

export class RateLimitError extends Error {
  retryAfterSec: number;
  constructor(retryAfterSec: number) {
    super('Rate limited');
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

const COMPRESS_MAX = 400;
const COMPRESS_QUALITY = 0.7;

/** Compress an image file via canvas to a small JPEG data URL. */
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
        resolve({ dataUrl, base64: { data: dataUrl.slice(comma + 1), mimeType: 'image/jpeg' } });
      };
      img.onerror = () => reject(new Error('Failed to load image for compression.'));
      img.src = src;
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

const SYSTEM_PROMPT = `You are a nutrition assistant. Estimate calories and macros for meals.
Return ONLY valid JSON, no markdown, no code fences.
Schema: { "mealType": "Breakfast"|"Lunch"|"Dinner"|"Snack", "items": [{ "name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number }], "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number, "reasoning": string }`;

export async function estimateMeal(
  apiKey: string,
  text: string,
  image?: { data: string; mimeType: string },
): Promise<ParsedMeal> {
  if (!apiKey) throw new Error('Add your Gemini API key in Settings to use AI estimation.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const parts: unknown[] = [{ text: text || 'Estimate this meal from the photo.' }];
  if (image) {
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
  }
  const body = { contents: [{ parts }], systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] } };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    const ra = Number(res.headers.get('Retry-After') || 15);
    throw new RateLimitError(ra);
  }
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const json = await res.json();
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
  if (!raw) throw new Error('No response from Gemini.');
  const cleaned = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as ParsedMeal;
}
