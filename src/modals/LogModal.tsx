import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store';
import { Modal } from '@/components/Modal';
import { estimateMeal, compressImage, RateLimitError, type ParsedMeal } from '@/lib/gemini';
import { toKey, formatHeaderDate, isToday } from '@/lib/dateUtils';
import type { MealType, MealEntry, FoodItem } from '@/types';
import { Camera, Type, Sparkles, Loader2, AlertCircle, Check, Scale, Clock, Calendar } from 'lucide-react';

type Mode = 'food' | 'weight';
type FoodInput = 'text' | 'image' | 'both';

const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

interface LogModalProps {
  open: boolean;
  onClose: () => void;
  targetDate?: string;
  editMeal?: MealEntry | null;
}

export function LogModal({ open, onClose, targetDate, editMeal }: LogModalProps) {
  const { settings, addMeal, updateMeal, logWeight } = useStore();
  const isEdit = !!editMeal;

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

  const [editName, setEditName] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');
  const [editFiber, setEditFiber] = useState('');

  useEffect(() => {
    if (rateLimitSecs === null) return;
    if (rateLimitSecs <= 0) { setRateLimitSecs(null); return; }
    const t = setTimeout(() => setRateLimitSecs((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [rateLimitSecs]);

  useEffect(() => {
    if (!open) return;
    if (editMeal) {
      setMode('food');
      setMealType(editMeal.mealType);
      setEditName(editMeal.items.map((i) => i.name).join(', '));
      setEditCalories(String(Math.round(editMeal.calories)));
      setEditProtein(editMeal.protein.toFixed(1));
      setEditCarbs(editMeal.carbs.toFixed(1));
      setEditFat(editMeal.fat.toFixed(1));
      setEditFiber(editMeal.fiber.toFixed(1));
      setImagePreview(editMeal.imageData ?? null);
      setResult(null); setError(null);
    } else {
      reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editMeal]);

  const reset = () => {
    setText(''); setImagePreview(null); setImageB64(null);
    setMealType('auto'); setError(null); setResult(null);
    setFoodInput('text'); setWeightVal(''); setRateLimitSecs(null);
    setEditName(''); setEditCalories(''); setEditProtein(''); setEditCarbs(''); setEditFat(''); setEditFiber('');
  };

  const close = () => { reset(); onClose(); };

  const onFile = async (file: File) => {
    try {
      const { dataUrl, base64 } = await compressImage(file);
      setImageB64(base64);
      setImagePreview(dataUrl);
      setFoodInput((prev) => (text.trim() ? 'both' : 'image'));
    } catch {
      setError('Could not process the image. Try another photo.');
    }
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
      if (e instanceof RateLimitError) { setError(null); setRateLimitSecs(e.retryAfterSec); }
      else { setRateLimitSecs(null); setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    } finally {
      setLoading(false);
    }
  };

  const onSave = () => {
    if (!result) return;
    addMeal({
      date: targetDate || toKey(new Date()),
      mealType: result.mealType,
      items: result.items,
      calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat, fiber: result.fiber,
      reasoning: result.reasoning,
      imageData: imagePreview ?? undefined,
    });
    close();
  };

  const onSaveEdit = () => {
    if (!editMeal) return;
    const cal = parseFloat(editCalories) || 0;
    const protein = parseFloat(editProtein) || 0;
    const carbs = parseFloat(editCarbs) || 0;
    const fat = parseFloat(editFat) || 0;
    const fiber = parseFloat(editFiber) || 0;
    const names = editName.split(',').map((s) => s.trim()).filter(Boolean);
    const items: FoodItem[] = names.length
      ? names.map((name) => ({
          name,
          calories: cal / names.length,
          protein: protein / names.length,
          carbs: carbs / names.length,
          fat: fat / names.length,
          fiber: fiber / names.length,
        }))
      : [{ name: 'Meal', calories: cal, protein, carbs, fat, fiber }];
    updateMeal(editMeal.id, {
      mealType: mealType === 'auto' ? editMeal.mealType : mealType,
      items, calories: cal, protein, carbs, fat, fiber,
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

  const title = isEdit ? 'Edit meal'
    : targetDate && !isToday(targetDate) ? `Log · ${formatHeaderDate(targetDate)}` : 'Quick log';

  return (
    <Modal open={open} onClose={close} title={title}>
      {!isEdit && (
        <div className="flex gap-2 mb-4">
          <ModeBtn active={mode === 'food'} onClick={() => { setMode('food'); setError(null); }} Icon={Sparkles} label="Food (AI)" />
          <ModeBtn active={mode === 'weight'} onClick={() => { setMode('weight'); setError(null); }} Icon={Scale} label="Weight" />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-600 text-xs rounded-xl p-3 mb-4">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {rateLimitSecs !== null && rateLimitSecs > 0 && (
        <div className="flex items-start gap-2 bg-orange-50 text-orange-600 text-xs rounded-xl p-3 mb-4">
          <Clock size={16} className="flex-shrink-0 mt-0.5 animate-pulse" />
          <span>Rate limit reached. Please wait <strong className="tabular-nums">{rateLimitSecs}s</strong> before trying again.</span>
        </div>
      )}

      {!isEdit && mode === 'food' && targetDate && !isToday(targetDate) && (
        <div className="flex items-center gap-2 bg-blue-50 text-blue-700 text-xs rounded-xl p-2.5 mb-4">
          <Calendar size={14} className="flex-shrink-0" />
          <span>Logging for <strong>{formatHeaderDate(targetDate)}</strong></span>
        </div>
      )}

      {isEdit ? (
        <div>
          {imagePreview && (
            <div className="relative mb-3">
              <img src={imagePreview} alt="meal" className="w-full h-40 object-cover rounded-2xl" />
              <button onClick={() => { setImagePreview(null); setImageB64(null); }}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">×</button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          {!imagePreview && (
            <button onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-gray-50 text-gray-500 font-semibold py-3 rounded-xl text-sm mb-3">
              <Camera size={16} /> Change photo
            </button>
          )}

          <Field label="Food name">
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none" />
          </Field>

          <div className="mt-3">
            <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Meal type</label>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {MEAL_TYPES.map((t) => <Pill key={t} active={mealType === t} onClick={() => setMealType(t)}>{t}</Pill>)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="Calories (kcal)"><NumInput value={editCalories} onChange={setEditCalories} /></Field>
            <Field label="Protein (g)"><NumInput value={editProtein} onChange={setEditProtein} /></Field>
            <Field label="Carbs (g)"><NumInput value={editCarbs} onChange={setEditCarbs} /></Field>
            <Field label="Fat (g)"><NumInput value={editFat} onChange={setEditFat} /></Field>
            <Field label="Fiber (g)"><NumInput value={editFiber} onChange={setEditFiber} /></Field>
          </div>

          <button onClick={onSaveEdit}
            className="w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-2xl text-sm mt-4 flex items-center justify-center gap-2 active:scale-[.99] transition-transform">
            <Check size={16} /> Save changes
          </button>
        </div>
      ) : mode === 'food' ? (
        result ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">{result.mealType}</span>
              <span className="text-sm font-bold text-orange-500">{Math.round(result.calories)} kcal</span>
            </div>
            {imagePreview && <img src={imagePreview} alt="meal" className="w-full h-36 object-cover rounded-2xl mb-3" />}
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
            {result.reasoning && <p className="text-[11px] text-gray-400 italic bg-gray-50 rounded-xl p-3 mb-4">{result.reasoning}</p>}
            <div className="flex gap-2">
              <button onClick={() => setResult(null)} className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm">Redo</button>
              <button onClick={onSave} className="flex-1 bg-emerald-600 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                <Check size={16} /> Save meal
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex gap-2 mb-3">
              <InputToggle active={foodInput !== 'image'} onClick={() => setFoodInput(text.trim() || imageB64 ? 'both' : 'text')} Icon={Type} label="Text" />
              <InputToggle active={foodInput !== 'text'} onClick={() => fileRef.current?.click()} Icon={Camera} label="Photo" />
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />

            {imagePreview && (
              <div className="relative mb-3">
                <img src={imagePreview} alt="preview" className="w-full h-40 object-cover rounded-2xl" />
                <button onClick={() => { setImagePreview(null); setImageB64(null); setFoodInput('text'); }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">×</button>
              </div>
            )}

            <textarea value={text} onChange={(e) => { setText(e.target.value); if (imageB64) setFoodInput(e.target.value.trim() ? 'both' : 'image'); }}
              placeholder="e.g. grilled chicken breast 200g, brown rice 1 cup, steamed broccoli"
              rows={3} className="w-full bg-gray-50 rounded-2xl p-3 text-sm text-gray-900 outline-none resize-none focus:ring-2 ring-emerald-500/30" />

            <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar">
              <Pill active={mealType === 'auto'} onClick={() => setMealType('auto')}>Auto</Pill>
              {MEAL_TYPES.map((t) => <Pill key={t} active={mealType === t} onClick={() => setMealType(t)}>{t}</Pill>)}
            </div>

            <button onClick={onEstimate} disabled={loading || (rateLimitSecs !== null && rateLimitSecs > 0)}
              className="w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-2xl text-sm mt-4 flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[.99] transition-transform">
              {loading ? <><Loader2 size={18} className="animate-spin" /> Estimating…</>
                : rateLimitSecs !== null && rateLimitSecs > 0 ? <><Clock size={18} /> Retry in {rateLimitSecs}s</>
                : <><Sparkles size={18} /> Estimate with AI</>}
            </button>
          </div>
        )
      ) : (
        <div>
          <p className="text-xs text-gray-400 mb-3">Log your weight for today. Overwrites any existing entry for today.</p>
          <div className="flex items-center bg-gray-50 rounded-2xl px-4 py-4">
            <input type="number" inputMode="decimal" value={weightVal} onChange={(e) => setWeightVal(e.target.value)}
              placeholder="0.0" className="flex-1 bg-transparent text-2xl font-bold text-gray-900 outline-none" />
            <span className="text-sm font-semibold text-gray-400">{settings.weightUnit}</span>
          </div>
          <button onClick={onSaveWeight}
            className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-2xl text-sm mt-4 flex items-center justify-center gap-2 active:scale-[.99] transition-transform">
            <Check size={18} /> Save weight
          </button>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label className="text-xs font-semibold text-gray-400 mb-1.5 block">{label}</label>{children}</div>);
}

function NumInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center bg-gray-50 rounded-xl px-3 py-2.5">
      <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm font-semibold text-gray-900 outline-none" />
    </div>
  );
}

function ModeBtn({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: typeof Sparkles; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors ${active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
      <Icon size={15} /> {label}
    </button>
  );
}

function InputToggle({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: typeof Type; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors ${active ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
      {label === 'Photo' ? <Camera size={15} /> : <Icon size={15} />} {label}
    </button>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
      {children}
    </button>
  );
}
