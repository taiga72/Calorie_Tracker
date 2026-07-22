import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store';
import { Modal } from '@/components/Modal';
import { estimateMeal, fileToBase64, RateLimitError, type ParsedMeal } from '@/lib/gemini';
import { toKey } from '@/lib/dateUtils';
import type { MealType } from '@/types';
import { Camera, Type, Sparkles, Loader2, AlertCircle, Check, Scale, Clock } from 'lucide-react';

type Mode = 'food' | 'weight';
type FoodInput = 'text' | 'image' | 'both';

const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export function LogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, addMeal, logWeight } = useStore();
  const [mode, setMode] = useState<Mode>('food');
  const [foodInput, setFoodInput] = useState<FoodInput>('text');
  const [text, setText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageB64, setImageB64] = useState<{ data: string; mimeType: string } | null>(null);
  const [mealType, setMealType] = useState<MealType | 'auto'>('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitSecs, setRateLimitSecs] = useState<number | null>(null);
  const [result, setResult] = useState<ParsedMeal | null>(null);
  const [weightVal, setWeightVal] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rateLimitSecs === null) return;
    if (rateLimitSecs <= 0) { setRateLimitSecs(null); return; }
    const t = setTimeout(() => setRateLimitSecs((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [rateLimitSecs]);

  const reset = () => {
    setText(''); setImagePreview(null); setImageB64(null);
    setMealType('auto'); setError(null); setResult(null);
    setFoodInput('text'); setWeightVal(''); setRateLimitSecs(null);
  };

  const close = () => { reset(); onClose(); };

  const onFile = async (file: File) => {
    const b64 = await fileToBase64(file);
    setImageB64(b64);
    setImagePreview(`data:${b64.mimeType};base64,${b64.data}`);
    setFoodInput((prev) => (text.trim() ? 'both' : 'image'));
  };

  const onEstimate = async () => {
    setError(null);
    if (foodInput === 'text' && !text.trim()) {
      setError('Describe your meal or attach a photo.');
      return;
    }
    setLoading(true);
    try {
      const parsed = await estimateMeal(settings.geminiApiKey, text, imageB64 ?? undefined);
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

  const onSave = () => {
    if (!result) return;
    addMeal({
      date: toKey(new Date()),
      mealType: result.mealType,
      items: result.items,
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
      fiber: result.fiber,
      reasoning: result.reasoning,
      imageData: imagePreview ?? undefined,
    });
    close();
  };

  const onSaveWeight = () => {
    const v = parseFloat(weightVal);
    if (!v || v <= 0) { setError('Enter a valid weight.'); return; }
    logWeight(v);
    close();
  };

  return (
    <Modal open={open} onClose={close} title="Quick log">
      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <ModeBtn active={mode === 'food'} onClick={() => { setMode('food'); setError(null); }} Icon={Sparkles} label="Food (AI)" />
        <ModeBtn active={mode === 'weight'} onClick={() => { setMode('weight'); setError(null); }} Icon={Scale} label="Weight" />
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-600 text-xs rounded-xl p-3 mb-4">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {rateLimitSecs !== null && rateLimitSecs > 0 && (
        <div className="flex items-start gap-2 bg-orange-50 text-orange-600 text-xs rounded-xl p-3 mb-4">
          <Clock size={16} className="flex-shrink-0 mt-0.5 animate-pulse" />
          <span>
            Rate limit reached. Please wait <strong className="tabular-nums">{rateLimitSecs}s</strong> before trying again.
          </span>
        </div>
      )}

      {mode === 'food' ? (
        result ? (
          /* ---- Result view ---- */
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">{result.mealType}</span>
              <span className="text-sm font-bold text-orange-500">{Math.round(result.calories)} kcal</span>
            </div>

            {imagePreview && (
              <img src={imagePreview} alt="meal" className="w-full h-36 object-cover rounded-2xl mb-3" />
            )}

            <div className="space-y-2 mb-3">
              {result.items.map((it, i) => (
                <div key={i} className="bg-white rounded-xl p-3 border border-gray-50">
                  <p className="text-sm font-semibold text-gray-900">{it.name}</p>
                  <p className="text-[11px] text-orange-500 font-semibold mt-0.5">
                    {Math.round(it.calories)} kcal · P {it.protein.toFixed(1)}g · C {it.carbs.toFixed(0)}g · F {it.fat.toFixed(1)}g
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { l: 'Protein', v: result.protein, c: 'text-emerald-600' },
                { l: 'Carbs', v: result.carbs, c: 'text-orange-500' },
                { l: 'Fat', v: result.fat, c: 'text-amber-500' },
                { l: 'Fiber', v: result.fiber, c: 'text-purple-500' },
              ].map((m) => (
                <div key={m.l} className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className={`text-sm font-bold ${m.c}`}>{m.v.toFixed(m.l === 'Carbs' ? 0 : 1)}g</p>
                  <p className="text-[10px] text-gray-400">{m.l}</p>
                </div>
              ))}
            </div>

            {result.reasoning && (
              <p className="text-[11px] text-gray-400 italic bg-gray-50 rounded-xl p-3 mb-4">{result.reasoning}</p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setResult(null)} className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm">
                Redo
              </button>
              <button onClick={onSave} className="flex-1 bg-emerald-600 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                <Check size={16} /> Save meal
              </button>
            </div>
          </div>
        ) : (
          /* ---- Input view ---- */
          <div>
            {/* Input type toggle */}
            <div className="flex gap-2 mb-3">
              <InputToggle active={foodInput !== 'image'} onClick={() => setFoodInput(text.trim() || imageB64 ? 'both' : 'text')} Icon={Type} label="Text" />
              <InputToggle active={foodInput !== 'text'} onClick={() => fileRef.current?.click()} Icon={Camera} label="Photo" />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />

            {imagePreview && (
              <div className="relative mb-3">
                <img src={imagePreview} alt="preview" className="w-full h-40 object-cover rounded-2xl" />
                <button
                  onClick={() => { setImagePreview(null); setImageB64(null); setFoodInput(text.trim() ? 'text' : 'text'); }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
                >
                  ×
                </button>
              </div>
            )}

            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); if (imageB64) setFoodInput(e.target.value.trim() ? 'both' : 'image'); }}
              placeholder="e.g. grilled chicken breast 200g, brown rice 1 cup, steamed broccoli"
              rows={3}
              className="w-full bg-gray-50 rounded-2xl p-3 text-sm text-gray-900 outline-none resize-none focus:ring-2 ring-emerald-500/30"
            />

            {/* Meal type selector */}
            <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar">
              <Pill active={mealType === 'auto'} onClick={() => setMealType('auto')}>Auto</Pill>
              {MEAL_TYPES.map((t) => (
                <Pill key={t} active={mealType === t} onClick={() => setMealType(t)}>{t}</Pill>
              ))}
            </div>

            {!settings.geminiApiKey && (
              <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg p-2.5 mt-3 flex items-center gap-1.5">
                <AlertCircle size={13} /> Add your Gemini API key in Settings to enable AI estimation.
              </p>
            )}

            <button
              onClick={onEstimate}
              disabled={loading || !settings.geminiApiKey || (rateLimitSecs !== null && rateLimitSecs > 0)}
              className="w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-2xl text-sm mt-4 flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[.99] transition-transform"
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Estimating…</> : rateLimitSecs !== null && rateLimitSecs > 0 ? <><Clock size={18} /> Retry in {rateLimitSecs}s</> : <><Sparkles size={18} /> Estimate with AI</>}
            </button>
          </div>
        )
      ) : (
        /* ---- Weight mode ---- */
        <div>
          <p className="text-xs text-gray-400 mb-3">Log your weight for today. Overwrites any existing entry for today.</p>
          <div className="flex items-center bg-gray-50 rounded-2xl px-4 py-4">
            <input
              type="number"
              inputMode="decimal"
              value={weightVal}
              onChange={(e) => setWeightVal(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-transparent text-2xl font-bold text-gray-900 outline-none"
            />
            <span className="text-sm font-semibold text-gray-400">{settings.weightUnit}</span>
          </div>
          <button
            onClick={onSaveWeight}
            className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-2xl text-sm mt-4 flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
          >
            <Check size={18} /> Save weight
          </button>
        </div>
      )}
    </Modal>
  );
}

function ModeBtn({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: typeof Sparkles; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors ${active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
    >
      <Icon size={15} /> {label}
    </button>
  );
}

function InputToggle({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: typeof Type; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors ${active ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}
    >
      {label === 'Photo' ? <Camera size={15} /> : <Icon size={15} />} {label}
    </button>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
    >
      {children}
    </button>
  );
}
