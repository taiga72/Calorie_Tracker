import { useState } from 'react';
import { useStore } from '@/store';
import { Brain, Plus, X } from 'lucide-react';

const MAX_MEMORY_NOTES = 20;
const MAX_NOTE_LENGTH = 200;

/**
 * Facts the AI coach should always keep in mind ("I train Mon/Wed/Fri",
 * "I work night shifts"). Sent with every coach request; saved with the account.
 */
export function CoachMemoryEditor({ compact = false }: { compact?: boolean }) {
  const { settings, updatePrefs } = useStore();
  const notes = settings.prefs?.coachMemory ?? [];
  const [draft, setDraft] = useState('');
  const full = notes.length >= MAX_MEMORY_NOTES;

  const add = () => {
    const text = draft.trim().slice(0, MAX_NOTE_LENGTH);
    if (!text || full) return;
    updatePrefs({ coachMemory: [...notes, text] });
    setDraft('');
  };

  return (
    <div>
      {!compact && (
        <p className="text-xs text-gray-400 mb-3">
          Things your coach should always remember — your schedule, preferences or anything that changes its advice.
        </p>
      )}
      {notes.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {notes.map((n, i) => (
            <li key={`${i}-${n}`} className="flex items-start gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
              <span className="flex-1 text-xs text-gray-700 dark:text-gray-200 leading-relaxed">{n}</span>
              <button
                onClick={() => updatePrefs({ coachMemory: notes.filter((_, j) => j !== i) })}
                aria-label={`Forget "${n}"`}
                className="text-gray-300 hover:text-red-500 -mr-1 p-0.5"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          maxLength={MAX_NOTE_LENGTH}
          disabled={full}
          aria-label="Something for your coach to remember"
          placeholder={full ? 'Memory is full — remove one to add more' : notes.length ? 'Add another…' : 'e.g. I train Mon, Wed and Fri'}
          className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 ring-accent-500/30 disabled:opacity-50"
        />
        <button
          onClick={add}
          disabled={!draft.trim() || full}
          aria-label="Remember this"
          className="w-9 h-9 flex-shrink-0 rounded-xl bg-accent-600 text-white flex items-center justify-center disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

/** Settings → AI coach memory. */
export function CoachMemorySection() {
  return (
    <div className="card p-5 mt-4">
      <div className="flex items-center gap-2 mb-1">
        <Brain size={18} className="text-accent-600" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Coach memory</h2>
      </div>
      <CoachMemoryEditor />
    </div>
  );
}
