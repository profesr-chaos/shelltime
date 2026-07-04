import { useState } from 'react';
import type { Project } from '@shared/types';
import { QuickSwitchMenu } from './QuickSwitchMenu';
import { CheckIcon } from './icons';

interface FinishedForTodayProps {
  finished: boolean;
  projects: Project[];
  onStop: () => void;
  onResume: (projectId: number) => void;
  disabled?: boolean;
  bordered?: boolean;
  menuAnchorClassName?: string;
  className?: string;
}

/** "Finished for today" toggle. Checking it stops the timer; unchecking prompts for a project to
 * resume on (the timer only runs while a project is active), so ending and restarting the day are
 * symmetric instead of leaving no obvious way back. */
export function FinishedForToday({
  finished,
  projects,
  onStop,
  onResume,
  disabled = false,
  bordered = true,
  menuAnchorClassName = 'top-9 right-0',
  className = '',
}: FinishedForTodayProps) {
  const [pickOpen, setPickOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={finished}
        disabled={disabled}
        onClick={() => (finished ? setPickOpen(true) : onStop())}
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
      {pickOpen && (
        <QuickSwitchMenu
          projects={projects}
          activeProjectId={null}
          onSelect={(id) => onResume(id)}
          onClose={() => setPickOpen(false)}
          anchorClassName={menuAnchorClassName}
          heading="Resume on"
        />
      )}
    </div>
  );
}
