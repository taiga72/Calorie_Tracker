import type { GeminiEstimate, MealType } from '../types'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AQ.Ab8RN6InG_lJeThIdBJZR3LEcRrJ9vtf8n8WhIcZn2GWDeyZZA'

const MODEL = 'gemini-1.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`

interface GeminiResponse {
  candidates?: Array<{ content: { parts: Array<{ text: string }> } }>
  error?: { message: string }
}

async function callGemini(prompt: string, imageBase64?: string, mimeType?: string): Promise<string> {
  const parts: Array<Record<string, unknown>> = [{ text: prompt }]

  if (imageBase64 && mimeType) {
    parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } })
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    const msg = errBody?.error?.message || `Gemini request failed (${res.status})`
    throw new Error(msg)
  }

  const data: GeminiResponse = await res.json()
  if (data.error) throw new Error(data.error.message)

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no content.')
  return text
}

function parseEstimate(text: string): GeminiEstimate {
  const cleaned = text.replace(/```json|```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse nutrition estimate.')
  const parsed = JSON.parse(match[0])

  return {
    calories: Math.round(Number(parsed.calories) || 0),
    protein: Math.round(Number(parsed.protein) || 0),
    carbs: Math.round(Number(parsed.carbs) || 0),
    fat: Math.round(Number(parsed.fat) || 0),
    fiber: Math.round(Number(parsed.fiber) || 0),
    food_items: Array.isArray(parsed.food_items) ? parsed.food_items : [],
    reasoning: String(parsed.reasoning || ''),
  }
}

const SYSTEM_PROMPT = `You are a nutrition estimation assistant. Estimate the calories and macronutrients for the described meal or food photo.
Return ONLY a JSON object (no markdown fences) with this exact shape:
{
  "calories": number,
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams),
  "fiber": number (grams),
  "food_items": [{ "name": string, "quantity": string, "calories": number, "protein": number, "carbs": number, "fat": number }],
  "reasoning": string (brief explanation of the estimate)
}
Be realistic and conservative. If you cannot identify the food, provide your best guess and note the uncertainty in reasoning.`

export async function estimateMealFromText(description: string, mealType: MealType): Promise<GeminiEstimate> {
  const prompt = `${SYSTEM_PROMPT}\n\nMeal type: ${mealType}\nDescription: ${description}`
  const text = await callGemini(prompt)
  return parseEstimate(text)
}

export async function estimateMealFromPhoto(imageBase64: string, mimeType: string, mealType: MealType): Promise<GeminiEstimate> {
  const prompt = `${SYSTEM_PROMPT}\n\nMeal type: ${mealType}\nAnalyze this food photo and estimate the nutrition.`
  const text = await callGemini(prompt, imageBase64, mimeType)
  return parseEstimate(text)
}
