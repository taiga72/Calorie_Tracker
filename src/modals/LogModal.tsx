import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store';
import { Modal } from '@/components/Modal';
import { useUndoToast } from '@/components/UndoToastProvider';
import { estimateMeal, compressImage, RateLimitError, type ParsedMeal } from '@/lib/gemini';
import { fromKey, formatHeaderDate, isToday, todayKey } from '@/lib/dateUtils';
import { kgToUnit } from '@/lib/units';
import { defaultPinName, findDuplicatePin, pinFromMeal } from '@/lib/pinnedMeals';
import { photoToDataUrl } from '@/lib/photoStorage';
import { useSpeechInput } from '@/lib/useSpeechInput';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { PinEditor } from '@/components/PinEditor';
import { MealPhoto } from '@/components/MealPhoto';
import { ItemReestimate } from '@/components/ItemReestimate';
import { PinMealButton } from '@/components/PinMealButton';
import type { MealType, MealEntry, FoodItem, PinnedMeal } from '@/types';
import { Camera, Type, Sparkles, Loader2, AlertCircle, Check, Scale, Clock, Calendar, Plus, Trash2, ChevronDown, Pin, Pencil, Mic } from 'lucide-react';
import { haptic } from '@/lib/appearance';
import { lastLogMethod, mealTypeForTime, rememberLogMethod, type LogMethod } from '@/lib/logPrefs';
import { friendlyAiError } from '@/lib/aiErrors';

type Mode = 'food' | 'weight';
type FoodInput = 'text' | 'image' | 'both';

const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

const emptyItem = (): FoodItem => ({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

function dataUrlToB64(dataUrl: string): { data: string; mimeType: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  return m ? { mimeType: m[1], data: m[2] } : null;
}

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
  const { settings, addMeal, updateMeal, deleteMeal, logWeight, logWeightForDate, deleteWeight, weights, pinned, pinMeal, unpinMeal, updatePin, restorePin } = useStore();
  const { requestUndo, notify } = useUndoToast();
  const isEdit = !!editMeal;
  const isWeightEdit = !!weightDate;
  const existingWeight = isWeightEdit ? weights.find((w) => w.date === weightDate) : undefined;

  const [mode, setMode] = useState<Mode>('food');
  const [foodInput, setFoodInput] = useState<FoodInput>('text');
  const [text, setText] = useState('');
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageB64s, setImageB64s] = useState<Array<{ data: string; mimeType: string }>>([]);
  const [mealType, setMealType] = useState<MealType | 'auto'>('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // AI failures can be retried in place.
  const [retry, setRetry] = useState<(() => void) | null>(null);
  // How the last meal was logged: the sheet opens ready for that.
  const [method, setMethod] = useState<LogMethod | null>(null);
  const usedVoice = useRef(false);
  /** The time-of-day meal type is only a guess until the user taps one. */
  const typePicked = useRef(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const pinnedFirst = method === null || method === 'pinned';
  const [rateLimitSecs, setRateLimitSecs] = useState<number | null>(null);
  const [result, setResult] = useState<ParsedMeal | null>(null);
  const [weightVal, setWeightVal] = useState('');
  // Set when the result came from a pin, so "Pin this meal" isn't offered again.
  const [fromPin, setFromPin] = useState(false);
  const [pinOnSave, setPinOnSave] = useState(false);
  const [editingPin, setEditingPin] = useState<PinnedMeal | null>(null);

  // Dictation is added after whatever was already typed.
  const textBeforeSpeech = useRef('');
  const speech = useSpeechInput((transcript) => {
    const base = textBeforeSpeech.current;
    setText(base && transcript ? `${base}${/[\s,]$/.test(base) ? '' : ', '}${transcript}` : base || transcript);
  });
  const onMic = () => {
    if (speech.listening) { speech.stop(); return; }
    textBeforeSpeech.current = text.trim();
    usedVoice.current = true;
    speech.start();
  };
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit-mode fields
  const [editItems, setEditItems] = useState<FoodItem[]>([]);
  const [totalCalInput, setTotalCalInput] = useState('');
  const [editNote, setEditNote] = useState('');
  // Editing can also move a meal to another day (e.g. logged on the wrong one).
  const [editDate, setEditDate] = useState('');
  const [editReasoning, setEditReasoning] = useState<string | null>(null);

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
      setEditDate(editMeal.date);
      setEditItems(editMeal.items.length ? editMeal.items.map((i) => ({ ...i })) : [emptyItem()]);
      setTotalCalInput(String(editMeal.calories));
      const prevPhotos = editMeal.imageDatas ?? (editMeal.imageData ? [editMeal.imageData] : []);
      setImagePreviews(prevPhotos);
      // Editing works from imagePreviews (which may be stored-photo
      // references); they're converted for Gemini only on re-estimate.
      setImageB64s([]);
      setEditReasoning(editMeal.reasoning ?? null);
      setEditNote('');
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
    usedVoice.current = false;
    setText(''); setImagePreviews([]); setImageB64s([]);
    // A new meal for today starts on the meal it most likely is (changeable).
    typePicked.current = false;
    setMealType(!targetDate || isToday(targetDate) ? mealTypeForTime() : 'auto'); setError(null); setRetry(null); setResult(null);
    setMethod(lastLogMethod());
    setFoodInput('text'); setWeightVal(''); setRateLimitSecs(null);
    setEditItems([]); setFromPin(false); setPinOnSave(false); setEditingPin(null);
  };

  // Typed last time: open with the cursor in the box.
  useEffect(() => {
    if (!open || editMeal || isWeightEdit || method !== 'text') return;
    const t = setTimeout(() => textRef.current?.focus({ preventScroll: true }), 350);
    return () => clearTimeout(t);
  }, [open, method, editMeal, isWeightEdit]);

  const close = () => { speech.stop(); reset(); onClose(); };

  const onFiles = async (files: File[]) => {
    try {
      const processed = await Promise.all(files.map((f) => compressImage(f)));
      setImagePreviews((prev) => [...prev, ...processed.map((p) => p.dataUrl)]);
      setImageB64s((prev) => [...prev, ...processed.map((p) => p.base64)]);
      setFoodInput(text.trim() ? 'both' : 'image');
    } catch {
      setError('Could not process one or more images. Try again.');
    }
  };

  const removePhoto = (idx: number) => {
    setImagePreviews((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) setFoodInput('text');
      return next;
    });
    setImageB64s((prev) => prev.filter((_, i) => i !== idx));
  };

  const onEstimate = async () => {
    setError(null);
    setRetry(null);
    if (foodInput === 'text' && !text.trim()) {
      setError('Describe your meal or attach a photo.');
      return;
    }
    setLoading(true);
    rememberLogMethod(imageB64s.length > 0 ? 'photo' : usedVoice.current ? 'voice' : 'text');
    try {
      const parsed = await estimateMeal(settings.geminiApiKey, text, imageB64s.length > 0 ? imageB64s : undefined);
      if (mealType !== 'auto') parsed.mealType = mealType;
      setFromPin(false);
      setResult(parsed);
    } catch (e) {
      if (e instanceof RateLimitError) {
        setError(null);
        setRateLimitSecs(e.retryAfterSec);
      } else {
        setRateLimitSecs(null);
        setError(friendlyAiError(e));
        setRetry(() => () => void onEstimate());
      }
    } finally {
      setLoading(false);
    }
  };

  const onSave = () => {
    if (!result) return;
    haptic('success');
    if (pinOnSave) pinMeal(pinFromMeal(result));
    const id = addMeal({
      date: targetDate || todayKey(),
      mealType: result.mealType,
      items: result.items,
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
      fiber: result.fiber,
      reasoning: result.reasoning,
      imageDatas: imagePreviews.length > 0 ? imagePreviews : undefined,
    });
    // Confirm it landed (the sheet just closes otherwise), with a way back.
    const what = result.items.length > 1 ? result.mealType.toLowerCase() : defaultPinName(result.items, result.mealType);
    const short = what.length > 18 ? `${what.slice(0, 17).trimEnd()}…` : what;
    if (id) requestUndo(`Logged ${short} · ${Math.round(result.calories)} kcal`, () => deleteMeal(id));
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

  const onReestimate = async () => {
    setError(null);
    setRetry(null);
    if (!editNote.trim() && imagePreviews.length === 0) {
      setError('Add a note or photo to re-estimate.');
      return;
    }
    setLoading(true);
    try {
      const dataUrls = await Promise.all(imagePreviews.map(photoToDataUrl));
      const photos = dataUrls
        .map((d) => (d ? dataUrlToB64(d) : null))
        .filter((x): x is { data: string; mimeType: string } => x !== null);
      const parsed = await estimateMeal(settings.geminiApiKey, editNote, photos.length > 0 ? photos : undefined);
      setEditItems(parsed.items.length ? parsed.items : [emptyItem()]);
      setTotalCalInput(String(Math.round(parsed.calories)));
      setEditReasoning(parsed.reasoning ?? null);
    } catch (e) {
      if (e instanceof RateLimitError) {
        setError(null);
        setRateLimitSecs(e.retryAfterSec);
      } else {
        setRateLimitSecs(null);
        setError(friendlyAiError(e));
        setRetry(() => () => void onReestimate());
      }
    } finally {
      setLoading(false);
    }
  };

  const onSaveEdit = () => {
    haptic('success');
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
    const movedTo = /^\d{4}-\d{2}-\d{2}$/.test(editDate) && editDate !== editMeal.date ? editDate : undefined;
    updateMeal(editMeal.id, {
      ...(movedTo ? { date: movedTo } : {}),
      mealType: mealType === 'auto' ? editMeal.mealType : (mealType as MealType),
      items,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      fiber: totals.fiber,
      reasoning: editReasoning ?? undefined,
      imageDatas: imagePreviews.length > 0 ? imagePreviews : undefined,
    });
    close();
  };

  const onSaveWeight = () => {
    const v = parseFloat(weightVal);
    if (!v || v <= 0) { setError('Enter a valid weight.'); return; }
    haptic('success');
    if (weightDate) logWeightForDate(v, weightDate);
    else logWeight(v);
    notify(`Weight saved · ${v} ${settings.weightUnit}`);
    close();
  };

  const onDeleteWeight = () => {
    if (weightDate && existingWeight) {
      const restoreValue = kgToUnit(existingWeight.weight, settings.weightUnit);
      deleteWeight(weightDate);
      requestUndo('Weight entry deleted', () => logWeightForDate(restoreValue, weightDate));
    }
    close();
  };

  const title = editingPin
    ? 'Edit pinned meal'
    : isEdit
    ? 'Edit meal'
    : isWeightEdit ? (existingWeight ? 'Edit weight' : 'Add weight')
    : targetDate && !isToday(targetDate) ? `Log · ${formatHeaderDate(fromKey(targetDate))}` : 'Quick log';

  const editTotals = sumItems(editItems);

  // Swiping a pin away unpins it everywhere; Undo puts it back.
  const onUnpin = (pin: PinnedMeal) => {
    unpinMeal(pin.id);
    requestUndo('Meal unpinned', () => restorePin(pin));
  };

  // Re-logs a pinned meal — no Gemini call. It lands in the normal result
  // view so it can still be reviewed (or redone) before saving.
  const onPickPinned = (pin: PinnedMeal) => {
    rememberLogMethod('pinned');
    setError(null);
    setFromPin(true);
    setPinOnSave(false);
    setResult({
      mealType: mealType === 'auto' || !typePicked.current ? pin.mealType : mealType,
      items: pin.items.map((i) => ({ ...i })),
      calories: pin.calories,
      protein: pin.protein,
      carbs: pin.carbs,
      fat: pin.fat,
      fiber: pin.fiber,
      reasoning: '',
    });
  };

  const resultAlreadyPinned = !!result && !!findDuplicatePin(pinned, result);

  return (
    <Modal open={open} onClose={close} title={title}>
      {/* Mode toggle (hidden in edit / weight-edit mode) */}
      {!isEdit && !isWeightEdit && !editingPin && (
        <div className="flex gap-2 mb-4">
          <ModeBtn active={mode === 'food'} onClick={() => { setMode('food'); setError(null); }} Icon={Sparkles} label="Food (AI)" />
          <ModeBtn active={mode === 'weight'} onClick={() => { setMode('weight'); setError(null); }} Icon={Scale} label="Weight" />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 text-xs rounded-xl p-3 mb-4">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          {retry && !loading && (
            <button onClick={() => retry()} className="flex-shrink-0 font-semibold underline">Try again</button>
          )}
        </div>
      )}

      {rateLimitSecs !== null && rateLimitSecs > 0 && (
        <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-300 text-xs rounded-xl p-3 mb-4">
          <Clock size={16} className="flex-shrink-0 mt-0.5 animate-pulse" />
          <span>
            Rate limit reached. Please wait <strong className="tabular-nums">{rateLimitSecs}s</strong> before trying again.
          </span>
        </div>
      )}

      {!isEdit && mode === 'food' && targetDate && !isToday(targetDate) && (
        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs rounded-xl p-2.5 mb-4">
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

          {/* Day — move the meal if it was logged on the wrong one */}
          <label className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2 mb-3 text-xs">
            <Calendar size={14} className="flex-shrink-0 text-gray-400" />
            <span className="font-medium text-gray-500 dark:text-gray-400">Day</span>
            <input
              type="date"
              aria-label="Meal date"
              value={editDate}
              max={todayKey()}
              onChange={(e) => setEditDate(e.target.value)}
              className="ml-auto bg-transparent font-semibold text-gray-900 dark:text-white outline-none text-right"
            />
          </label>
          {editMeal && editDate && editDate !== editMeal.date && (
            <p className="text-11 text-blue-600 dark:text-blue-400 -mt-2 mb-3 px-1">
              Will move to {formatHeaderDate(fromKey(editDate))}
            </p>
          )}

          {/* Photo gallery */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) onFiles(files); e.target.value = ''; }}
          />
          {imagePreviews.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative flex-shrink-0">
                  <MealPhoto src={src} alt="dish" className="w-24 h-24 rounded-2xl object-cover" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-black/40 backdrop-blur-sm text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-shrink-0 w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-1 text-gray-400 active:scale-95 transition-transform"
              >
                <Camera size={20} />
                <span className="text-10 font-semibold">Add photo</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-semibold py-2.5 rounded-xl text-sm mb-3"
            >
              <Camera size={16} /> Add photo
            </button>
          )}

          {/* Re-estimate with AI */}
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Modifications / notes</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="e.g. Added a side salad and extra sauce"
                className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 ring-accent-500/30"
              />
              <button
                onClick={onReestimate}
                disabled={loading || (rateLimitSecs !== null && rateLimitSecs > 0)}
                className="flex-shrink-0 bg-accent-50 dark:bg-accent-950 text-accent-700 dark:text-accent-300 font-semibold px-3 rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-40 active:scale-95 transition-transform"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Re-estimate
              </button>
            </div>
          </div>

          {/* AI Estimation callout */}
          {editReasoning && (
            <div className="bg-accent-50/70 dark:bg-accent-950/50 border border-accent-100 dark:border-accent-900 rounded-2xl p-3.5 mb-3">
              <p className="text-10 font-bold text-accent-700 dark:text-accent-400 tracking-wider mb-1">✨ AI ESTIMATION NOTE</p>
              <p className="text-xs text-gray-600 dark:text-gray-300 italic leading-relaxed">{editReasoning}</p>
            </div>
          )}

          {/* Quick calorie override */}
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Total calories</label>
            <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-3">
              <input
                type="number"
                inputMode="numeric"
                value={totalCalInput}
                onChange={(e) => setTotalCalInput(e.target.value)}
                onBlur={applyTotalCal}
                className="flex-1 bg-transparent text-xl font-bold text-gray-900 dark:text-white outline-none"
              />
              <span className="text-xs text-gray-400">kcal</span>
            </div>
          </div>

          {/* Live aggregated macro summary */}
          <div className="grid grid-cols-5 gap-2 mb-3">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{Math.round(editTotals.calories)}</p>
              <p className="text-10 text-gray-400">kcal</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
              <p className="text-sm font-bold text-emerald-600">{editTotals.protein.toFixed(1)}</p>
              <p className="text-10 text-gray-400">Protein</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
              <p className="text-sm font-bold text-orange-500">{editTotals.carbs.toFixed(0)}</p>
              <p className="text-10 text-gray-400">Carbs</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
              <p className="text-sm font-bold text-amber-500">{editTotals.fat.toFixed(1)}</p>
              <p className="text-10 text-gray-400">Fat</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
              <p className="text-sm font-bold text-purple-500">{editTotals.fiber.toFixed(1)}</p>
              <p className="text-10 text-gray-400">Fiber</p>
            </div>
          </div>

          {/* Collapsible advanced item breakdown */}
          <details className="group mb-3">
            <summary className="flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors list-none [&::-webkit-details-marker]:hidden">
              <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
              {editItems.length > 1 ? `Items (${editItems.length}) — edit or re-estimate each` : 'Item details'}
            </summary>
            <div className="space-y-2 mt-2">
              {editItems.map((it, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={it.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      placeholder="Food item (e.g. 100g cooked white rice)"
                      className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-2 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 ring-accent-500/30"
                    />
                    {editItems.length > 1 && it.name.trim() && (
                      <PinMealButton item={it} mealType={mealType === 'auto' ? (editMeal?.mealType ?? 'Snack') : mealType} size={15} />
                    )}
                    <ItemReestimate
                      item={it}
                      others={editItems.filter((_, j) => j !== i).map((x) => x.name)}
                      onApply={(next) => {
                        updateItem(i, next);
                        const totals = sumItems(editItems.map((x, j) => (j === i ? next : x)));
                        setTotalCalInput(String(Math.round(totals.calories)));
                      }}
                    />
                    <button
                      onClick={() => removeItem(i)}
                      disabled={editItems.length <= 1}
                      className="flex-shrink-0 w-10 h-10 -m-1 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-30 transition-colors"
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
              className="w-full flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-semibold py-2.5 rounded-xl text-sm mt-2 active:scale-[.99] transition-transform"
            >
              <Plus size={16} /> Add item
            </button>
          </details>

          <button
            onClick={onSaveEdit}
            className="w-full bg-accent-600 text-white font-semibold py-3.5 rounded-2xl text-sm mt-1 flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
          >
            <Check size={16} /> Save changes
          </button>
        </div>
      ) : mode === 'food' ? (
        editingPin ? (
          <PinEditor
            key={editingPin.id}
            pin={editingPin}
            onCancel={() => setEditingPin(null)}
            onSave={(patch) => { updatePin(editingPin.id, patch); setEditingPin(null); }}
            onDelete={() => { onUnpin(editingPin); setEditingPin(null); }}
          />
        ) : result ? (
          /* ---- Result view ---- */
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-accent-100 text-accent-700 text-xs font-bold px-2.5 py-1 rounded-full">{result.mealType}</span>
              <span className="text-sm font-bold text-orange-500">{Math.round(result.calories)} kcal</span>
            </div>

            {imagePreviews[0] && (
              <MealPhoto src={imagePreviews[0]} alt="meal" className="w-full h-36 object-cover rounded-2xl mb-3" />
            )}

            <div className="space-y-2 mb-3">
              {result.items.map((it, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-50 dark:border-gray-800">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{it.name}</p>
                    <p className="text-11 text-orange-500 font-semibold mt-0.5">
                      {Math.round(it.calories)} kcal · P {it.protein.toFixed(1)}g · C {it.carbs.toFixed(0)}g · F {it.fat.toFixed(1)}g
                    </p>
                  </div>
                  {result.items.length > 1 && <PinMealButton item={it} mealType={result.mealType} size={15} />}
                  <ItemReestimate
                    item={it}
                    others={result.items.filter((_, j) => j !== i).map((x) => x.name)}
                    onApply={(next) => setResult((r) => {
                      if (!r) return r;
                      const items = r.items.map((x, j) => (j === i ? next : x));
                      return { ...r, items, ...sumItems(items) };
                    })}
                  />
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
                <div key={m.l} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center">
                  <p className={`text-sm font-bold ${m.c}`}>{m.v.toFixed(m.l === 'Carbs' ? 0 : 1)}g</p>
                  <p className="text-10 text-gray-400">{m.l}</p>
                </div>
              ))}
            </div>

            {result.reasoning && (
              <p className="text-11 text-gray-400 italic bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-4">{result.reasoning}</p>
            )}

            {!fromPin && (
              resultAlreadyPinned ? (
                <p className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                  <Pin size={13} className="text-accent-600" /> Already in your pinned meals
                </p>
              ) : (
                <button
                  onClick={() => setPinOnSave((v) => !v)}
                  aria-pressed={pinOnSave}
                  className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3 text-xs font-semibold border transition-colors ${
                    pinOnSave
                      ? 'bg-accent-50 dark:bg-accent-950 border-accent-200 dark:border-accent-800 text-accent-700 dark:text-accent-300'
                      : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <Pin size={14} className={pinOnSave ? 'fill-current' : ''} />
                  <span className="flex-1 text-left">Pin this meal for one-tap logging</span>
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${pinOnSave ? 'border-accent-600 bg-accent-600' : 'border-gray-300 dark:border-gray-600'}`}>
                    {pinOnSave && <Check size={10} className="text-white" strokeWidth={3} />}
                  </span>
                </button>
              )
            )}

            <div className="flex gap-2">
              <button onClick={() => setResult(null)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold py-3 rounded-xl text-sm">
                Redo
              </button>
              <button onClick={onSave} className="flex-1 bg-accent-600 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                <Check size={16} /> Save meal
              </button>
            </div>
          </div>
        ) : (
          /* ---- Input view ---- */
          <div className="flex flex-col">
            {/* Pinned meals first for people who mostly re-log pins; below the
                input for those who usually type, talk or snap. */}
            <div className={pinnedFirst ? 'mb-4' : 'order-last mt-5'}>
              <div className="flex items-center gap-1.5 mb-2">
                <Pin size={13} className="text-gray-400" />
                <p className="text-xs font-semibold text-gray-400">
                  Pinned meals{pinned.length > 0 ? ' · no AI needed · swipe to unpin' : ''}
                </p>
              </div>
              {pinned.length === 0 ? (
                <p className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
                  Pin a meal you eat often (tap the pin on any logged meal, or after an estimate) to re-log it here in one tap.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar">
                  {pinned.map((pin) => (
                    <div key={pin.id} className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800">
                      <SwipeToDelete onDelete={() => onUnpin(pin)} label="Unpin meal">
                        <div className="flex items-center">
                          <button
                            onClick={() => onPickPinned(pin)}
                            className="flex-1 min-w-0 flex items-center gap-3 pl-3 py-2.5 text-left"
                          >
                            <span className="flex-1 min-w-0 text-sm font-semibold text-gray-900 dark:text-white truncate">{pin.name}</span>
                            <span className="text-xs font-semibold text-orange-500 flex-shrink-0">{Math.round(pin.calories)} kcal</span>
                          </button>
                          <button
                            onClick={() => setEditingPin(pin)}
                            aria-label={`Edit ${pin.name}`}
                            className="flex-shrink-0 px-3 py-2.5 text-gray-400 hover:text-accent-600 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      </SwipeToDelete>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {method === 'photo' && imagePreviews.length === 0 && (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full mb-3 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent-300 dark:border-accent-800 bg-accent-50/60 dark:bg-accent-950/40 text-accent-700 dark:text-accent-300 py-5 text-sm font-semibold active:scale-[.99] transition-transform"
              >
                <Camera size={20} /> Take or choose a photo
              </button>
            )}

            {/* Input type toggle */}
            <div className="flex gap-2 mb-3">
              <InputToggle active={foodInput !== 'image'} onClick={() => setFoodInput(text.trim() || imageB64s.length > 0 ? 'both' : 'text')} Icon={Type} label="Text" />
              <InputToggle active={foodInput !== 'text'} onClick={() => fileRef.current?.click()} Icon={Camera} label="Photo" />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) onFiles(files); e.target.value = ''; }}
            />

            {imagePreviews.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    <MealPhoto src={src} alt="preview" className="w-24 h-24 rounded-2xl object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-black/40 backdrop-blur-sm text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                      aria-label="Remove photo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-shrink-0 w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-1 text-gray-400 active:scale-95 transition-transform"
                >
                  <Camera size={20} />
                  <span className="text-10 font-semibold">Add photo</span>
                </button>
              </div>
            )}

            <div className="relative">
              <textarea
                ref={textRef}
                value={text}
                onChange={(e) => { setText(e.target.value); if (imageB64s.length > 0) setFoodInput(e.target.value.trim() ? 'both' : 'image'); }}
                placeholder={speech.supported ? 'e.g. grilled chicken breast 200g, brown rice 1 cup — or tap the mic and say it' : 'e.g. grilled chicken breast 200g, brown rice 1 cup, steamed broccoli'}
                rows={3}
                className={`w-full bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 text-sm text-gray-900 dark:text-white outline-none resize-none focus:ring-2 ring-accent-500/30 ${speech.supported ? 'pr-14' : ''}`}
              />
              {speech.supported && (
                <button
                  onClick={onMic}
                  aria-label={speech.listening ? 'Stop voice input' : 'Speak your meal'}
                  aria-pressed={speech.listening}
                  className={`absolute right-2.5 bottom-3.5 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    speech.listening ? 'bg-red-500 text-white' : 'bg-white dark:bg-gray-900 text-accent-600 shadow-sm border border-gray-100 dark:border-gray-700'
                  } ${method === 'voice' && !speech.listening && !text ? 'ring-2 ring-accent-400 ring-offset-2 ring-offset-gray-50 dark:ring-offset-gray-800' : ''}`}
                >
                  {speech.listening && <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />}
                  <Mic size={18} className="relative" />
                </button>
              )}
            </div>
            {speech.listening && <p className="text-11 text-red-500 font-semibold mt-1.5">Listening… say what you ate</p>}
            {speech.error && !speech.listening && <p className="text-11 text-amber-600 mt-1.5">{speech.error}</p>}

            {/* Meal type selector */}
            <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar">
              <Pill active={mealType === 'auto'} onClick={() => { typePicked.current = true; setMealType('auto'); }}>Auto</Pill>
              {MEAL_TYPES.map((t) => (
                <Pill key={t} active={mealType === t} onClick={() => { typePicked.current = true; setMealType(t); }}>{t}</Pill>
              ))}
            </div>

            <button
              onClick={onEstimate}
              disabled={loading || (rateLimitSecs !== null && rateLimitSecs > 0)}
              className="w-full bg-accent-600 text-white font-semibold py-3.5 rounded-2xl text-sm mt-4 flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[.99] transition-transform"
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
          <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-2xl px-4 py-4">
            <input
              type="number"
              inputMode="decimal"
              value={weightVal}
              onChange={(e) => setWeightVal(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-transparent text-2xl font-bold text-gray-900 dark:text-white outline-none"
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
              className="w-full bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 font-semibold py-3 rounded-2xl text-sm mt-2 flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
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
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-1.5 py-1.5 text-center">
      <input
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-transparent text-sm font-bold text-gray-900 dark:text-white outline-none text-center"
      />
      <p className="text-9 text-gray-400 font-semibold mt-0.5">{label}</p>
    </div>
  );
}

function ModeBtn({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: typeof Sparkles; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors ${active ? 'bg-gray-900 dark:bg-accent-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}
    >
      <Icon size={15} /> {label}
    </button>
  );
}

function InputToggle({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: typeof Type; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors ${active ? 'bg-accent-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}
    >
      {label === 'Photo' ? <Camera size={15} /> : <Icon size={15} />} {label}
    </button>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${active ? 'bg-gray-900 dark:bg-accent-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}
    >
      {children}
    </button>
  );
}
