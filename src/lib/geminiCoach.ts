import type { MealEntry, Settings, WeightEntry } from '@/types';
import { resolveApiKey, RateLimitError } from '@/lib/gemini';
import { kgToUnit } from '@/lib/units';
import { rangeKeys, toKey, formatShortDate } from '@/lib/dateUtils';

const PRIMARY_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';
const VERSION = 'v1beta';
const RETRY_DELAY_MS = 1000;

function endpoint(apiKey: string, model: string): string {
  return `https://generativelanguage.googleapis.com/${VERSION}/models/${model}:generateContent?key=${apiKey}`;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface CoachContext {
  settings: Settings;
  meals: MealEntry[];
  weights: WeightEntry[];
}

interface ApiError extends Error {
  status?: number;
}

interface GeminiErrorBody {
  error?: { message?: string; details?: { retryDelay?: string }[] };
}

function buildContextJson(ctx: CoachContext): string {
  const { settings, meals, weights } = ctx;
  const keys = rangeKeys(new Date(), 7);
  const recentMeals = keys.map((k) => {
    const dayMeals = meals.filter((m) => m.date === k);
    if (!dayMeals.length) return { date: k, logged: false };
    return {
      date: k,
      logged: true,
      totalCalories: Math.round(dayMeals.reduce((a, b) => a + b.calories, 0)),
      totalProtein: Math.round(dayMeals.reduce((a, b) => a + b.protein, 0)),
      totalCarbs: Math.round(dayMeals.reduce((a, b) => a + b.carbs, 0)),
      totalFat: Math.round(dayMeals.reduce((a, b) => a + b.fat, 0)),
      meals: dayMeals.map((m) => ({
        type: m.mealType,
        calories: Math.round(m.calories),
        items: m.items.map((i) => i.name),
      })),
    };
  });

  const recentWeights = weights
    .filter((w) => w.date >= keys[0])
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => ({
      date: w.date,
      weight: Number(kgToUnit(w.weight, settings.weightUnit).toFixed(1)),
    }));

  const profile = {
    unit: settings.weightUnit,
    dailyCalorieGoal: settings.calorieGoal,
    goalWeight: Number(kgToUnit(settings.goalWeight, settings.weightUnit).toFixed(1)),
    weeklyWeightTarget: Number(kgToUnit(Math.abs(settings.weeklyWeightTarget), settings.weightUnit).toFixed(2)),
    goalDirection: settings.weeklyWeightTarget <= 0 ? 'lose' : 'gain',
    bmr: settings.calc?.bmr ?? null,
    tdee: settings.calc?.tdee ?? null,
    dailyDeficit: settings.calc?.dailyDeficit ?? null,
    estimatedGoalDate: settings.calc?.estimatedGoalDate
      ? formatShortDate(toKey(new Date(settings.calc.estimatedGoalDate)))
      : null,
    recommendedMacros: settings.calc?.recommendedMacros ?? null,
    suggestedMealSplit: settings.calc?.suggestedMealSplit ?? null,
  };

  return JSON.stringify({ profile, recentMeals, recentWeights }, null, 2);
}

const COACH_SYSTEM_PROMPT = `You are an encouraging, knowledgeable AI nutrition and fitness coach inside a calorie-tracking app.
The user's profile and their past 7 days of meal/weight logs are provided as a JSON context block.
Give structured, warm, and actionable advice tailored to their actual data. Reference their real numbers when relevant.
Keep answers concise (3-5 sentences) unless the user asks for detail. Use plain language, no medical diagnoses, no prescribing. If they could be doing better, frame it positively.
Never invent stats that contradict the provided context. If data is missing, say so and give general guidance.`;

export interface CoachMessage {
  role: 'user' | 'model';
  text: string;
}

export async function askCoach(
  apiKey: string,
  ctx: CoachContext,
  history: CoachMessage[],
  userMessage: string,
): Promise<string> {
  const key = resolveApiKey(apiKey);
  const contextJson = buildContextJson(ctx);

  const contents = [
    { role: 'user', parts: [{ text: `${COACH_SYSTEM_PROMPT}\n\nUser context (JSON):\n${contextJson}` }] },
    { role: 'model', parts: [{ text: 'Got it. I have your profile and recent logs. What can I help you with?' }] },
    ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const body = { contents, generationConfig: { temperature: 0.7 } };
  return callWithFallback(key, body);
}

export interface CoachInsight {
  summary: string; // 2-sentence summary
  tip: string; // 1 actionable tip
}

const INSIGHT_SYSTEM_PROMPT = `You are an AI nutrition coach. Based on the user's profile and past 7 days of logs (provided as JSON), generate a short progress insight.
Respond with ONLY a JSON object (no markdown, no backticks) with this exact shape:
{
  "summary": "Two sentences summarizing their progress this week.",
  "tip": "One short, actionable tip for what to improve next."
}
Rules:
- Be encouraging but honest. Reference their real numbers (avg calories vs goal, protein, weight change) when available.
- If there is not enough logged data, acknowledge it briefly and give a sensible starter tip.
- Output ONLY the JSON object.`;

const INSIGHT_CACHE_KEY = 'cc_coach_insight';

interface CachedInsight {
  date: string; // YYYY-MM-DD
  insight: CoachInsight;
}

function readCache(): CachedInsight | null {
  try {
    const raw = localStorage.getItem(INSIGHT_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedInsight;
  } catch {
    return null;
  }
}

function writeCache(insight: CoachInsight): void {
  try {
    const entry: CachedInsight = { date: toKey(new Date()), insight };
    localStorage.setItem(INSIGHT_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // ignore storage failures
  }
}

export async function getOrFetchInsight(
  apiKey: string,
  ctx: CoachContext,
  force = false,
): Promise<CoachInsight> {
  if (!force) {
    const cached = readCache();
    if (cached && cached.date === toKey(new Date())) {
      return cached.insight;
    }
  }
  const insight = await getInsight(apiKey, ctx);
  writeCache(insight);
  return insight;
}

export async function getInsight(apiKey: string, ctx: CoachContext): Promise<CoachInsight> {
  const key = resolveApiKey(apiKey);
  const contextJson = buildContextJson(ctx);
  const body = {
    contents: [{ role: 'user', parts: [{ text: `${INSIGHT_SYSTEM_PROMPT}\n\nUser context (JSON):\n${contextJson}` }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.5 },
  };

  const text = await callWithFallback(key, body);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not parse coach insight response.');
  let parsed: CoachInsight;
  try {
    parsed = JSON.parse(match[0]) as CoachInsight;
  } catch {
    throw new Error('Failed to parse coach insight JSON.');
  }
  if (!parsed.summary || !parsed.tip) throw new Error('Insight response missing fields.');
  return { summary: String(parsed.summary), tip: String(parsed.tip) };
}

async function callWithFallback(key: string, body: unknown): Promise<string> {
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

  throw lastErr ?? new Error('All coach model attempts failed.');
}

async function callModel(key: string, model: string, body: unknown): Promise<string> {
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
      throw new RateLimitError(30, detail || 'Too many requests.');
    }

    if (res.status === 503) {
      const err = new Error(`Gemini API error (503): ${detail || res.statusText}`) as ApiError;
      err.status = 503;
      throw err;
    }

    throw new Error(`Gemini API error (${res.status}): ${detail || res.statusText}`);
  }

  const data: { candidates?: { content?: { parts?: { text?: string }[] } }[] } = await res.json();
  const textOut: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('');

  if (!textOut) throw new Error('Gemini returned an empty response.');
  return textOut;
}
