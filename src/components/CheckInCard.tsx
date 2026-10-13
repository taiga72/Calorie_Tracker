import { useState } from 'react';
import { HeartPulse, Pencil } from 'lucide-react';
import { useStore } from '@/store';
import type { CheckIn } from '@/types';

type Field = 'sleep' | 'energy' | 'hunger' | 'mood';

/** The questions, with a face for each answer (1 → 5). */
export const CHECKIN_FIELDS: { key: Field; label: string; faces: string[]; words: string[] }[] = [
  { key: 'sleep', label: 'Sleep', faces: ['😫', '😪', '😐', '🙂', '😊'], words: ['Awful', 'Poor', 'OK', 'Good', 'Great'] },
  { key: 'energy', label: 'Energy', faces: ['🪫', '😮‍💨', '😐', '🙂', '⚡'], words: ['Drained', 'Low', 'OK', 'Good', 'High'] },
  { key: 'hunger', label: 'Hunger', faces: ['😌', '🙂', '😐', '😋', '🤤'], words: ['None', 'Little', 'Some', 'Hungry', 'Starving'] },
  { key: 'mood', label: 'Mood', faces: ['😞', '🙁', '😐', '🙂', '😄'], words: ['Low', 'Meh', 'OK', 'Good', 'Great'] },
];

export function checkInSummary(c: CheckIn | undefined): string {
  if (!c) return '';
  return CHECKIN_FIELDS
    .filter((f) => c[f.key])
    .map((f) => `${f.faces[c[f.key]! - 1]} ${f.label} ${f.words[c[f.key]! - 1].toLowerCase()}`)
    .join(' · ');
}

/**
 * Home: four taps on how the day feels. The coach uses the answers to spot
 * patterns ("you eat more after short nights").
 */
export function CheckInCard({ date }: { date: string }) {
  const { checkins, saveCheckIn } = useStore();
  const today = checkins.find((c) => c.date === date);
  const answered = CHECKIN_FIELDS.filter((f) => today?.[f.key]).length;
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const complete = answered === CHECKIN_FIELDS.length && !editing;

  if (complete) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <HeartPulse size={16} className="text-rose-500" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Today's check-in</h2>
          <button onClick={() => setEditing(true)} aria-label="Edit check-in" className="ml-auto p-2 -m-2 text-gray-400 hover:text-accent-600 rounded-full">
            <Pencil size={14} />
          </button>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed">{checkInSummary(today)}</p>
        {today?.note && <p className="text-11 text-gray-400 mt-1 italic">“{today.note}”</p>}
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <HeartPulse size={16} className="text-rose-500" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">How are you today?</h2>
        <span className="ml-auto text-10 text-gray-400">{answered}/{CHECKIN_FIELDS.length}</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {CHECKIN_FIELDS.map((f) => (
          <div key={f.key} className="flex items-center gap-2" role="radiogroup" aria-label={f.label}>
            <span className="w-14 text-11 font-semibold text-gray-500 dark:text-gray-400">{f.label}</span>
            <div className="flex-1 grid grid-cols-5 gap-1">
              {f.faces.map((face, i) => {
                const value = i + 1;
                const selected = today?.[f.key] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${f.label}: ${f.words[i]}`}
                    title={f.words[i]}
                    onClick={() => saveCheckIn(date, { [f.key]: value })}
                    className={`h-9 rounded-xl text-lg leading-none flex items-center justify-center transition-all ${
                      selected ? 'bg-accent-100 dark:bg-accent-900 ring-2 ring-accent-500 scale-105' : 'bg-gray-50 dark:bg-gray-800 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {face}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {answered > 0 && (
        <input
          value={note ?? today?.note ?? ''}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => { if (note !== null && note.trim() !== (today?.note ?? '')) saveCheckIn(date, { note: note.trim() || undefined }); }}
          placeholder="Anything to note? (optional)"
          aria-label="Check-in note"
          className="mt-2.5 w-full bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-accent-200"
        />
      )}
      {editing && (
        <button onClick={() => setEditing(false)} className="mt-2 w-full text-xs font-semibold text-accent-600 py-1.5">Done</button>
      )}
    </div>
  );
}
