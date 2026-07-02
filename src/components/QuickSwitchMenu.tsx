import { useEffect, useRef } from 'react';
import type { Project } from '@shared/types';
import { ColorDot } from './ui/Badge';

interface QuickSwitchMenuProps {
  projects: Project[];
  activeProjectId: number | null;
  onSelect: (projectId: number) => void;
  onClose: () => void;
  anchorClassName?: string;
  heading?: string;
}

export function QuickSwitchMenu({ projects, activeProjectId, onSelect, onClose, anchorClassName = '', heading = 'Switch to' }: QuickSwitchMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const active = projects.filter((p) => p.isActive);

  return (
    <div
      ref={ref}
      className={`absolute z-40 w-72 rounded-xl border border-slate-200 bg-white py-2 shadow-xl dark:border-slate-700 dark:bg-slate-800 ${anchorClassName}`}
    >
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</p>
      <div className="max-h-64 overflow-y-auto">
        {active.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              onSelect(p.id);
              onClose();
            }}
            disabled={p.id === activeProjectId}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:cursor-default disabled:opacity-40 dark:hover:bg-slate-700`}
          >
            <ColorDot color={p.color} className="shrink-0" />
            <span className="shrink-0 whitespace-nowrap font-medium text-slate-800 dark:text-slate-100">{p.code}</span>
            <span className="min-w-0 flex-1 truncate text-slate-400">{p.name}</span>
          </button>
        ))}
        {active.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No active projects</p>}
      </div>
    </div>
  );
}
