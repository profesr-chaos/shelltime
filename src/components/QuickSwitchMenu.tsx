import { useEffect, useRef, useState } from 'react';
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
  const [recentIds, setRecentIds] = useState<Set<number> | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    window.api.projects.recentIds().then((ids) => setRecentIds(new Set(ids)));
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const active = projects.filter((p) => p.isActive);
  const recent = recentIds ? active.filter((p) => recentIds.has(p.id)) : active;
  // Recent-only view is only worth it when it actually shortens the list.
  const showRecentView = !showAll && recent.length > 0 && recent.length < active.length;

  // Full view groups by category (alphabetical, uncategorised last); skip headers entirely when
  // no project has a category.
  const categories = [...new Set(active.map((p) => p.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b));
  const uncategorised = active.filter((p) => !p.category);

  const row = (p: Project) => (
    <button
      key={p.id}
      onClick={() => {
        onSelect(p.id);
        onClose();
      }}
      disabled={p.id === activeProjectId}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:cursor-default disabled:opacity-40 dark:hover:bg-slate-700"
    >
      <ColorDot color={p.color} className="shrink-0" />
      <span className="shrink-0 whitespace-nowrap font-medium text-slate-800 dark:text-slate-100">{p.code}</span>
      <span className="min-w-0 flex-1 truncate text-slate-400">{p.name}</span>
    </button>
  );

  return (
    <div
      ref={ref}
      className={`absolute z-40 w-72 rounded-xl border border-slate-200 bg-white py-2 shadow-xl dark:border-slate-700 dark:bg-slate-800 ${anchorClassName}`}
    >
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</p>
      <div className="max-h-56 overflow-y-auto">
        {showRecentView ? (
          <>
            {recent.map(row)}
            <button
              onClick={() => setShowAll(true)}
              className="w-full px-3 py-2 text-left text-sm font-medium text-amber hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              More +
            </button>
          </>
        ) : (
          <>
            {categories.map((cat) => (
              <div key={cat}>
                <p className="px-3 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300 dark:text-slate-500">{cat}</p>
                {active.filter((p) => p.category === cat).map(row)}
              </div>
            ))}
            {categories.length > 0 && uncategorised.length > 0 && (
              <p className="px-3 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300 dark:text-slate-500">Other</p>
            )}
            {uncategorised.map(row)}
          </>
        )}
        {active.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No active projects</p>}
      </div>
    </div>
  );
}
