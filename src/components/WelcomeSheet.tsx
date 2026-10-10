import { Modal } from '@/components/Modal';
import { Target, Utensils, Sparkles, BarChart3, CalendarDays, Check, ChevronRight } from 'lucide-react';

/**
 * First run: three things to do, and where the rest of the app lives.
 * Steps tick off as they're done; it isn't shown again once closed.
 */
export function WelcomeSheet({ open, onClose, name, goalSet, mealLogged, onSetGoal, onLogMeal }: {
  open: boolean;
  onClose: () => void;
  name: string;
  goalSet: boolean;
  mealLogged: boolean;
  onSetGoal: () => void;
  onLogMeal: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={`Welcome${name ? `, ${name}` : ''} 👋`}>
      <p className="text-sm text-gray-500 dark:text-gray-400 -mt-1 mb-4">Two quick steps and you're set.</p>
      <div className="space-y-2">
        <Step n={1} done={goalSet} icon={<Target size={18} />} title="Set your goal" sub="Your calorie target and pace, in about a minute" onClick={onSetGoal} />
        <Step n={2} done={mealLogged} icon={<Utensils size={18} />} title="Log your first meal" sub="Snap a photo, type it, or say it — the AI does the counting" onClick={onLogMeal} />
      </div>

      <p className="text-11 font-semibold text-gray-500 dark:text-gray-400 mt-5 mb-2">Where things are</p>
      <ul className="space-y-2.5 text-sm text-gray-700 dark:text-gray-200">
        <Tip icon={<Sparkles size={15} className="text-accent-600" />} text="The ✨ button is your AI coach — ask it anything about your eating and progress." />
        <Tip icon={<CalendarDays size={15} className="text-accent-600" />} text="Calendar shows every day at a glance, and lets you search past meals." />
        <Tip icon={<BarChart3 size={15} className="text-accent-600" />} text="Statistics shows your trends, and when you'll reach your goal." />
      </ul>

      <button onClick={onClose} className="w-full mt-6 bg-accent-600 text-white font-semibold py-3.5 rounded-2xl text-sm active:scale-[.99] transition-transform">
        {goalSet && mealLogged ? "All set — let's go" : 'Got it'}
      </button>
    </Modal>
  );
}

function Step({ n, done, icon, title, sub, onClick }: { n: number; done: boolean; icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={done}
      className={`w-full flex items-center gap-3 rounded-2xl p-3.5 text-left transition-colors ${done ? 'bg-accent-50 dark:bg-accent-950' : 'card'}`}
    >
      <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-accent-600 text-white' : 'bg-accent-50 dark:bg-accent-950 text-accent-600'}`}>
        {done ? <Check size={18} strokeWidth={3} /> : icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-bold ${done ? 'text-accent-700 dark:text-accent-300 line-through decoration-2' : 'text-gray-900 dark:text-white'}`}>{n}. {title}</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">{sub}</span>
      </span>
      {!done && <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />}
    </button>
  );
}

function Tip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <span className="leading-snug">{text}</span>
    </li>
  );
}
