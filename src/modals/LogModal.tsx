import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { estimateMeal, fileToBase64, RateLimitError, isApiKeyConfigured } from '@/lib/gemini';
import { Modal } from '@/components/Modal';
import { todayKey } from '@/lib/dateUtils';
import type { MealType, ParsedMeal } from '@/types';
import { Camera, Type, Sparkles, Loader2, AlertCircle, Clock, Check, Plus } from 'lucide-react';

interface LogModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type MealTypeOption = MealType | 'auto';

export function LogModal({ open, onClose, onSaved }: LogModalProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<'text' | 'photo'>('text');
  const [text, setText] = useState('');
  const [mealType, setMealType] = useState<MealTypeOption>('auto');
  const [image, setImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitSecs, setRateLimitSecs] = useState<number | null>(null);
  const [result, setResult] = useState<ParsedMeal | null>(null);
  const [weightVal, setWeightVal] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rateLimitSecs === null) return;
    if (rateLimitSecs <= 0) {
      setRateLimitSecs(null);
      return;
    }
    const t = setTimeout(() => setRateLimitSecs((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [rateLimitSecs]);

  const reset = () => {
    setMode('text');
    setText('');
    setMealType('auto');
    setImage(null);
    setImagePreview(null);
    setError(null);
    setResult(null);
    setWeightVal('');
    setRateLimitSecs(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (file: File) => {
    fileToBase64(file)
      .then((b64) => {
        setImage(b64);
        const reader = new FileReader();
        reader.onload = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to read image.'));
  };

  const onEstimate = async () => {
    if (!isApiKeyConfigured()) {
      setError('Gemini API key is not configured. Set VITE_GEMINI_API_KEY in your environment.');
      return;
    }
    if (!text.trim() && !image) {
      setError('Please describe your meal or upload a photo.');
      return;
    }

    setLoading(true);
    setError(null);
    setRateLimitSecs(null);
    try {
      const parsed = await estimateMeal(text, image ?? undefined);
      if (mealType !== 'auto') parsed.mealType = mealType;
      setResult(parsed);
    } catch (e) {
      if (e instanceof RateLimitError) {
        setError(null);
        setRateLimitSecs(e.retryAfterSec);
      } else {
        setRateLimitSecs(null);
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    if (!result || !user) return;
    const scaleFactor = weightVal ? parseFloat(weightVal) / 100 : 1;
    const scaled: ParsedMeal = {
      ...result,
      calories: Math.round(result.calories * scaleFactor),
      protein: Math.round(result.protein * scaleFactor),
      carbs: Math.round(result.carbs * scaleFactor),
      fat: Math.round(result.fat * scaleFactor),
      fiber: Math.round(result.fiber * scaleFactor),
      items: result.items.map((it) => ({
        ...it,
        calories: Math.round(it.calories * scaleFactor),
        protein: Math.round(it.protein * scaleFactor),
        carbs: Math.round(it.carbs * scaleFactor),
        fat: Math.round(it.fat * scaleFactor),
        fiber: Math.round(it.fiber * scaleFactor),
      })),
    };

    const { error: insertError } = await supabase.from('meals').insert({
      meal_type: scaled.mealType,
      logged_at: new Date().toISOString(),
      calories: scaled.calories,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      fiber: scaled.fiber,
      food_items: scaled.items,
      reasoning: scaled.reasoning,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }
    reset();
    onSaved();
    onClose();
  };

  const mealTypes: MealTypeOption[] = ['auto', 'Breakfast', 'Lunch', 'Dinner', 'Snack'];

  return (
    <Modal open={open} onClose={handleClose} title="Log a Meal" maxWidth="max-w-lg">
      {!result ? (
        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-2xl">
            <button
              onClick={() => setMode('text')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                mode === 'text'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Type size={16} /> Text
            </button>
            <button
              onClick={() => setMode('photo')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                mode === 'photo'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Camera size={16} /> Photo
            </button>
          </div>

          {/* Meal type selector */}
          <div className="flex flex-wrap gap-2">
            {mealTypes.map((mt) => (
              <button
                key={mt}
                onClick={() => setMealType(mt)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                  mealType === mt
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {mt === 'auto' ? 'Auto-detect' : mt}
              </button>
            ))}
          </div>

          {/* Text input */}
          {mode === 'text' && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe your meal... e.g. '2 eggs, 2 slices of toast, and a black coffee'"
              rows={4}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          )}

          {/* Photo input */}
          {mode === 'photo' && (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              className="relative cursor-pointer border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl overflow-hidden hover:border-primary-400 transition-colors"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Meal preview" className="w-full h-48 object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
                  <Camera size={32} className="mb-2" />
                  <p className="text-sm">Click or drag to upload a photo</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-600 text-xs rounded-xl p-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {rateLimitSecs !== null && rateLimitSecs > 0 && (
            <div className="flex items-start gap-2 bg-orange-50 text-orange-600 text-xs rounded-xl p-3">
              <Clock size={16} className="flex-shrink-0 mt-0.5 animate-pulse" />
              <span>
                Rate limit reached. Please wait{' '}
                <strong className="tabular-nums">{rateLimitSecs}s</strong> before trying again.
              </span>
            </div>
          )}

          <button
            onClick={onEstimate}
            disabled={loading || (rateLimitSecs !== null && rateLimitSecs > 0)}
            className="w-full bg-primary-500 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[.99] transition-transform hover:bg-primary-600"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Estimating…
              </>
            ) : rateLimitSecs !== null && rateLimitSecs > 0 ? (
              <>
                <Clock size={18} /> Retry in {rateLimitSecs}s
              </>
            ) : (
              <>
                <Sparkles size={18} /> Estimate with AI
              </>
            )}
          </button>
        </div>
      ) : (
        /* Results view */
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
            <Check size={20} />
            <span className="font-semibold text-sm">Meal Estimated</span>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {result.mealType}
              </span>
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {result.calories}
                <span className="text-sm font-normal text-gray-400 ml-1">kcal</span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <MacroPill label="Protein" value={result.protein} unit="g" color="text-blue-600 dark:text-blue-400" />
              <MacroPill label="Carbs" value={result.carbs} unit="g" color="text-amber-600 dark:text-amber-400" />
              <MacroPill label="Fat" value={result.fat} unit="g" color="text-rose-600 dark:text-rose-400" />
            </div>
            <div className="space-y-1.5">
              {result.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-300">{item.name}</span>
                  <span className="text-gray-400 dark:text-gray-500 tabular-nums">
                    {item.calories} kcal
                  </span>
                </div>
              ))}
            </div>
            {result.reasoning && (
              <p className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-400 dark:text-gray-500 italic">
                {result.reasoning}
              </p>
            )}
          </div>

          {/* Portion adjustment */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Portion size (100% = as estimated)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="25"
                max="300"
                step="5"
                value={weightVal || '100'}
                onChange={(e) => setWeightVal(e.target.value)}
                className="flex-1 accent-primary-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums w-12 text-right">
                {weightVal || '100'}%
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-600 text-xs rounded-xl p-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setResult(null);
                setError(null);
              }}
              className="flex-1 py-3.5 rounded-2xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Redo
            </button>
            <button
              onClick={onSave}
              className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={18} /> Log Meal
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function MacroPill({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="text-center bg-white dark:bg-gray-800 rounded-xl py-2">
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className={`text-sm font-bold ${color}`}>
        {value}
        <span className="text-xs font-normal ml-0.5">{unit}</span>
      </p>
    </div>
  );
}
