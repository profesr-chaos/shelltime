import { CheckIcon } from './icons';

interface FinishedForTodayProps {
  finished: boolean;
  onStop: () => void;
  onUnfinish: () => void;
  disabled?: boolean;
  bordered?: boolean;
  className?: string;
}

/** "Finished for today" toggle. Checking it stops the timer; unchecking just clears the flag and
 * stays idle, so ending and un-ending the day are symmetric — a plain checkbox, not a one-way trip.
 * (Start a project when you're ready to actually time again.) */
export function FinishedForToday({
  finished,
  onStop,
  onUnfinish,
  disabled = false,
  bordered = true,
  className = '',
}: FinishedForTodayProps) {
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={finished}
        disabled={disabled}
        onClick={() => (finished ? onUnfinish() : onStop())}
        className={`no-drag group flex items-center gap-2 rounded-full text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-50 ${
          bordered ? 'border px-3 py-1.5' : ''
        } ${
          finished
            ? `text-amber ${bordered ? 'border-amber bg-amber-50 dark:border-amber dark:bg-amber/10' : ''}`
            : `text-slate-500 hover:text-amber dark:text-slate-300 ${bordered ? 'border-slate-200 hover:border-amber dark:border-slate-600 dark:hover:border-amber' : ''}`
        }`}
      >
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-[5px] border text-white transition-colors ${
            finished ? 'border-amber bg-amber' : 'border-slate-300 group-hover:border-amber dark:border-slate-500'
          }`}
        >
          {finished && <CheckIcon width={12} height={12} />}
        </span>
        Finished for today
      </button>
    </div>
  );
}
