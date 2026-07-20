import { useEffect, useRef, useState } from 'react';
import type { Project } from '@shared/types';
import { groupByCategory } from '@/lib/projects';
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

  // Full view groups by category (alphabetical, uncategorised last). Suppress headers entirely when
  // nothing is categorised, so a category-free setup looks exactly as it did before.
  const groups = groupByCategory(active, (p) => p.category);
  const hasCategories = groups.some((g) => g.category !== null);

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
        ) : hasCategories ? (
          groups.map((g) => (
            <div key={g.category ?? '__other'} className="mb-1 last:mb-0">
              <div className="sticky top-0 flex items-center gap-2 bg-slate-50/95 px-3 py-1 backdrop-blur dark:bg-slate-900/80">
                <span className="h-1.5 w-1.5 rounded-full bg-amber/70" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">{g.category ?? 'Other'}</span>
                <span className="text-[10px] font-medium tabular-nums text-slate-300 dark:text-slate-600">{g.items.length}</span>
              </div>
              {g.items.map(row)}
            </div>
          ))
        ) : (
          active.map(row)
        )}
        {active.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No active projects</p>}
      </div>
    </div>
  );
}
