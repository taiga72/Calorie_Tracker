import { reminderMessage, type ReminderId } from '@/lib/reminders';
import { Bell, X } from 'lucide-react';

export function ReminderBanner({ id, onLog, onDismiss }: { id: ReminderId; onLog: () => void; onDismiss: () => void }) {
  const { title, body } = reminderMessage(id);
  return (
    <div
      role="status"
      className="fixed top-3 inset-x-3 z-50 max-w-md mx-auto bg-white dark:bg-gray-900 border border-accent-100 dark:border-accent-900 shadow-lg rounded-2xl p-3 flex items-start gap-3 animate-[slideDown_.25s_ease-out]"
    >
      <div className="w-9 h-9 rounded-xl bg-accent-50 dark:bg-accent-950 flex items-center justify-center flex-shrink-0">
        <Bell size={17} className="text-accent-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-white">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{body}</p>
        <button onClick={onLog} className="mt-2 text-xs font-semibold text-white bg-accent-600 px-3 py-1.5 rounded-full active:scale-95 transition-transform">
          {id === 'weighIn' ? 'Log weight' : `Log ${id.toLowerCase()}`}
        </button>
      </div>
      <button onClick={onDismiss} aria-label="Dismiss reminder" className="text-gray-300 hover:text-gray-500 p-1 flex-shrink-0">
        <X size={16} />
      </button>
    </div>
  );
}
