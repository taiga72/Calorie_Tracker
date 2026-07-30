import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store';
import { Modal } from '@/components/Modal';
import { estimateMeal, compressImage, RateLimitError, type ParsedMeal } from '@/lib/gemini';
import { toKey, fromKey, formatHeaderDate, isToday } from '@/lib/dateUtils';
import type { MealType, MealEntry, FoodItem } from '@/types';
import { Camera, Type, Sparkles, Loader2, AlertCircle, Check, Scale, Clock, Calendar, Plus, Trash2, ChevronDown } from 'lucide-react';

type Mode = 'food' | 'weight';
type FoodInput = 'text' | 'image' | 'both';

const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

const emptyItem = (): FoodItem => ({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

function sumItems(items: FoodItem[]) {
  return items.reduce(
    (acc, it) => ({
      calories: acc.calories + (Number(it.calories) || 0),
      protein: acc.protein + (Number(it.protein) || 0),
      carbs: acc.carbs + (Number(it.carbs) || 0),
      fat: acc.fat + (Number(it.fat) || 0),
      fiber: acc.fiber + (Number(it.fiber) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

interface LogModalProps {
  open: boolean;
  onClose: () => void;
  targetDate?: string;
  editMeal?: MealEntry | null;
  weightDate?: string | null;
  initialMode?: Mode;
}

export function LogModal({ open, onClose, targetDate, editMeal, weightDate, initialMode }: LogModalProps) {
  const { settings, addMeal, updateMeal, logWeight, logWeightForDate, deleteWeight, weights } = useStore();
  const isEdit = !!editMeal;
  const isWeightEdit = !!weightDate;
  const existingWeight = isWeightEdit ? weights.find((w) => w.date === weightDate) : undefined;

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

  // Edit-mode fields
  const [editItems, setEditItems] = useState<FoodItem[]>([]);
  const [totalCalInput, setTotalCalInput] = useState('');

  useEffect(() => {
    if (rateLimitSecs === null) return;
    if (rateLimitSecs <= 0) { setRateLimitSecs(null); return; }
    const t = setTimeout(() => setRateLimitSecs((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [rateLimitSecs]);

  // When opening, seed edit fields from editMeal or weight edit
  useEffect(() => {
    if (!open) return;
    if (editMeal) {
      setMode('food');
      setMealType(editMeal.mealType);
      setEditItems(editMeal.items.length ? editMeal.items.map((i) => ({ ...i })) : [emptyItem()]);
      setTotalCalInput(String(editMeal.calories));
      setImagePreview(editMeal.imageData ?? null);
      setResult(null);
      setError(null);
    } else if (isWeightEdit) {
      setMode('weight');
      setError(null);
      setResult(null);
      setRateLimitSecs(null);
      setEditItems([]);
      setWeightVal(existingWeight ? String((settings.weightUnit === 'lb' ? existingWeight.weight * 2.2046 : existingWeight.weight).toFixed(1)) : '');
    } else {
      reset();
      if (initialMode) setMode(initialMode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editMeal, weightDate, initialMode]);

  const reset = () => {
    setText(''); setImagePreview(null); setImageB64(null);
    setMealType('auto'); setError(null); setResult(null);
    setFoodInput('text'); setWeightVal(''); setRateLimitSecs(null);
    setEditItems([]);
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
      date: targetDate || toKey(new Date()),
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

  // Edit-mode item helpers
  const updateItem = (idx: number, patch: Partial<FoodItem>) => {
    setEditItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => {
    setEditItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  };
  const addItem = () => {
    setEditItems((prev) => [...prev, emptyItem()]);
  };

  const applyTotalCal = () => {
    const newCal = Math.max(0, parseFloat(totalCalInput) || 0);
    setTotalCalInput(String(newCal));
    const oldCal = editTotals.calories;
    if (oldCal <= 0 || newCal === oldCal) return;
    const ratio = newCal / oldCal;
    setEditItems((prev) => prev.map((it) => ({
      ...it,
      calories: Math.round(it.calories * ratio),
      protein: +(it.protein * ratio).toFixed(1),
      carbs: +(it.carbs * ratio).toFixed(1),
      fat: +(it.fat * ratio).toFixed(1),
      fiber: +(it.fiber * ratio).toFixed(1),
    })));
  };

  const onSaveEdit = () => {
    if (!editMeal) return;
    const items = editItems.map((it) => ({
      name: it.name.trim() || 'Item',
      calories: Math.round(Number(it.calories) || 0),
      protein: Number(it.protein) || 0,
      carbs: Number(it.carbs) || 0,
      fat: Number(it.fat) || 0,
      fiber: Number(it.fiber) || 0,
    }));
    const totals = sumItems(items);
    updateMeal(editMeal.id, {
      mealType: mealType === 'auto' ? editMeal.mealType : (mealType as MealType),
      items,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      fiber: totals.fiber,
      imageData: imagePreview ?? undefined,
    });
    close();
  };

  const onSaveWeight = () => {
    const v = parseFloat(weightVal);
    if (!v || v <= 0) { setError('Enter a valid weight.'); return; }
    if (weightDate) logWeightForDate(v, weightDate);
    else logWeight(v);
    close();
  };

  const onDeleteWeight = () => {
    if (weightDate) deleteWeight(weightDate);
    close();
  };

  const title = isEdit
    ? 'Edit meal'
    : isWeightEdit ? (existingWeight ? 'Edit weight' : 'Add weight')
    : targetDate && !isToday(targetDate) ? `Log · ${formatHeaderDate(fromKey(targetDate))}` : 'Quick log';

  const editTotals = sumItems(editItems);

  return (
    <Modal open={open} onClose={close} title={title}>
      {/* Mode toggle (hidden in edit / weight-edit mode) */}
      {!isEdit && !isWeightEdit && (
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
          <span>
            Rate limit reached. Please wait <strong className="tabular-nums">{rateLimitSecs}s</strong> before trying again.
          </span>
        </div>
      )}

      {!isEdit && mode === 'food' && targetDate && !isToday(targetDate) && (
        <div className="flex items-center gap-2 bg-blue-50 text-blue-700 text-xs rounded-xl p-2.5 mb-4">
          <Calendar size={14} className="flex-shrink-0" />
          <span>Logging for <strong>{formatHeaderDate(fromKey(targetDate))}</strong></span>
        </div>
      )}

      {isEdit ? (
        /* ---- Edit form (itemized) ---- */
        <div>
          {/* Meal type selector */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3">
            {MEAL_TYPES.map((t) => (
              <Pill key={t} active={mealType === t} onClick={() => setMealType(t)}>{t}</Pill>
            ))}
          </div>

          {/* Photo banner */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
          {imagePreview ? (
            <div className="relative mb-2">
              <img src={imagePreview} alt="meal" className="w-full h-32 object-cover rounded-2xl" />
              <button
                onClick={() => { setImagePreview(null); setImageB64(null); }}
                className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm text-white rounded-full w-7 h-7 flex items-center justify-center text-xs"
                aria-label="Remove photo"
              >
                ✕
              </button>
            </div>
          ) : null}
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-gray-50 text-gray-500 font-semibold py-2.5 rounded-xl text-sm mb-3"
          >
            <Camera size={16} /> {imagePreview ? 'Change photo' : 'Add photo'}
          </button>

          {/* AI Estimation callout */}
          {editMeal?.reasoning && (
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3.5 mb-3">
              <p className="text-[10px] font-bold text-emerald-700 tracking-wider mb-1">✨ AI ESTIMATION NOTE</p>
              <p className="text-xs text-gray-600 italic leading-relaxed">{editMeal.reasoning}</p>
            </div>
          )}

          {/* Quick calorie override */}
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Total calories</label>
            <div className="flex items-center bg-gray-50 rounded-xl px-3 py-3">
              <input
                type="number"
                inputMode="numeric"
                value={totalCalInput}
                onChange={(e) => setTotalCalInput(e.target.value)}
                onBlur={applyTotalCal}
                className="flex-1 bg-transparent text-xl font-bold text-gray-900 outline-none"
              />
              <span className="text-xs text-gray-400">kcal</span>
            </div>
          </div>

          {/* Live aggregated macro summary */}
          <div className="grid grid-cols-5 gap-2 mb-3">
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              <p className="text-sm font-bold text-gray-900">{Math.round(editTotals.calories)}</p>
              <p className="text-[10px] text-gray-400">kcal</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              <p className="text-sm font-bold text-emerald-600">{editTotals.protein.toFixed(1)}</p>
              <p className="text-[10px] text-gray-400">Protein</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              <p className="text-sm font-bold text-orange-500">{editTotals.carbs.toFixed(0)}</p>
              <p className="text-[10px] text-gray-400">Carbs</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              <p className="text-sm font-bold text-amber-500">{editTotals.fat.toFixed(1)}</p>
              <p className="text-[10px] text-gray-400">Fat</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              <p className="text-sm font-bold text-purple-500">{editTotals.fiber.toFixed(1)}</p>
              <p className="text-[10px] text-gray-400">Fiber</p>
            </div>
          </div>

          {/* Collapsible advanced item breakdown */}
          <details className="group mb-3">
            <summary className="flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-500 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors list-none [&::-webkit-details-marker]:hidden">
              <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
              Advanced item breakdown ({editItems.length} items)
            </summary>
            <div className="space-y-2 mt-2">
              {editItems.map((it, i) => (
                <div key={i} className="bg-white rounded-xl p-3 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={it.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      placeholder="Food item (e.g. 100g cooked white rice)"
                      className="flex-1 bg-gray-50 rounded-lg px-2.5 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 ring-emerald-500/30"
                    />
                    <button
                      onClick={() => removeItem(i)}
                      disabled={editItems.length <= 1}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    <ItemNumInput label="kcal" value={it.calories} onChange={(v) => updateItem(i, { calories: v })} />
                    <ItemNumInput label="P" value={it.protein} onChange={(v) => updateItem(i, { protein: v })} />
                    <ItemNumInput label="C" value={it.carbs} onChange={(v) => updateItem(i, { carbs: v })} />
                    <ItemNumInput label="F" value={it.fat} onChange={(v) => updateItem(i, { fat: v })} />
                    <ItemNumInput label="Fb" value={it.fiber} onChange={(v) => updateItem(i, { fiber: v })} />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addItem}
              className="w-full flex items-center justify-center gap-2 bg-gray-50 text-gray-500 font-semibold py-2.5 rounded-xl text-sm mt-2 active:scale-[.99] transition-transform"
            >
              <Plus size={16} /> Add item
            </button>
          </details>

          <button
            onClick={onSaveEdit}
            className="w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-2xl text-sm mt-1 flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
          >
            <Check size={16} /> Save changes
          </button>
        </div>
      ) : mode === 'food' ? (
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

            <button
              onClick={onEstimate}
              disabled={loading || (rateLimitSecs !== null && rateLimitSecs > 0)}
              className="w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-2xl text-sm mt-4 flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[.99] transition-transform"
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Estimating…</> : rateLimitSecs !== null && rateLimitSecs > 0 ? <><Clock size={18} /> Retry in {rateLimitSecs}s</> : <><Sparkles size={18} /> Estimate with AI</>}
            </button>
          </div>
        )
      ) : (
        /* ---- Weight mode ---- */
        <div>
          {isWeightEdit && weightDate ? (
            <p className="text-xs text-gray-400 mb-3">
              {existingWeight ? 'Update or delete the weight for ' : 'Add a weight for '}
              <strong>{formatHeaderDate(fromKey(weightDate))}</strong>.
            </p>
          ) : (
            <p className="text-xs text-gray-400 mb-3">Log your weight for today. Overwrites any existing entry for today.</p>
          )}
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
            <Check size={18} /> {existingWeight ? 'Update weight' : 'Save weight'}
          </button>
          {isWeightEdit && existingWeight && (
            <button
              onClick={onDeleteWeight}
              className="w-full bg-red-50 text-red-600 font-semibold py-3 rounded-2xl text-sm mt-2 flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
            >
              <Trash2 size={16} /> Delete weight
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

function ItemNumInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="bg-gray-50 rounded-lg px-1.5 py-1.5 text-center">
      <input
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-transparent text-sm font-bold text-gray-900 outline-none text-center"
      />
      <p className="text-[9px] text-gray-400 font-semibold mt-0.5">{label}</p>
    </div>
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
