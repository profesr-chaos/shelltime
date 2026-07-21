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
  // Reports the menu's bottom edge (px from the window top) so the overlay window can grow to fit
  // it exactly, instead of guessing a fixed height and leaving empty space.
  onHeight?: (bottomPx: number) => void;
}

export function QuickSwitchMenu({ projects, activeProjectId, onSelect, onClose, anchorClassName = '', heading = 'Switch to', onHeight }: QuickSwitchMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Categories default open; a set holds the ones the user has collapsed.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Use 'click', not 'mousedown': the trigger button toggles on click, so a mousedown-based close
    // fires first and the click then reopens. But bind on the next tick — the click that opened this
    // menu is still bubbling to document, and binding now would let it immediately close the menu.
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener('click', onDown), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!onHeight || !ref.current) return;
    const report = () => ref.current && onHeight(Math.ceil(ref.current.getBoundingClientRect().bottom));
    report();
    const ro = new ResizeObserver(report);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [onHeight]);

  // Never offer the project you're already on — you can't switch to it.
  const active = projects.filter((p) => p.isActive && p.id !== activeProjectId);

  // Group by category (weighted ranking, uncategorised last). Suppress headers entirely when nothing
  // is categorised, so a category-free setup stays a plain flat list.
  const groups = groupByCategory(active, (p) => p.category);
  const hasCategories = groups.some((g) => g.category !== null);

  const toggle = (cat: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  const row = (p: Project) => (
    <button
      key={p.id}
      onClick={() => {
        onSelect(p.id);
        onClose();
      }}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
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
        {hasCategories
          ? groups.map((g) => {
              const cat = g.category ?? 'Other';
              const isOpen = !collapsed.has(cat);
              return (
                <div key={g.category ?? '__other'} className="mb-1 last:mb-0">
                  <button
                    onClick={() => toggle(cat)}
                    className="sticky top-0 flex w-full items-center gap-2 bg-slate-50/95 px-3 py-1 text-left backdrop-blur dark:bg-slate-900/80"
                  >
                    <span className="text-slate-400">{isOpen ? '▾' : '▸'}</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">{cat}</span>
                    <span className="text-[10px] font-medium tabular-nums text-slate-300 dark:text-slate-600">{g.items.length}</span>
                  </button>
                  {isOpen && g.items.map(row)}
                </div>
              );
            })
          : active.map(row)}
        {active.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No other active projects</p>}
      </div>
    </div>
  );
}
