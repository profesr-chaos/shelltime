import { useEffect, useMemo, useState } from 'react';
import type { Project, ProjectHistory } from '@shared/types';
import { useProjects } from '@/hooks/useProjects';
import { groupByCategory } from '@/lib/projects';
import { currentMonthStr, minutesToHhMm, formatDateShort, formatMonth } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { ColorDot } from '@/components/ui/Badge';
import { TextInput, Select } from '@/components/ui/Inputs';
import { PlusIcon, SearchIcon, ChevronRightIcon } from '@/components/icons';
import { AddEditProjectModal } from '@/components/AddEditProjectModal';

export function Projects({ onProjectsChanged }: { onProjectsChanged?: () => void }) {
  const { projects, refresh } = useProjects(true);
  const [search, setSearch] = useState('');
  const [hoursByProject, setHoursByProject] = useState<Map<number, number>>(new Map());
  const [commentsByProject, setCommentsByProject] = useState<Map<number, number>>(new Map());
  const [editing, setEditing] = useState<Project | 'new' | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('mousedown', close);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('blur', close);
    };
  }, [contextMenu]);

  useEffect(() => {
    window.api.dashboard.getMonthlySummary(currentMonthStr()).then((summary) => {
      setHoursByProject(new Map(summary.byProject.map((bp) => [bp.project.id, bp.minutes])));
    });
    window.api.notes.listForMonth(currentMonthStr()).then((notes) => {
      const map = new Map<number, number>();
      for (const n of notes) map.set(n.projectId, (map.get(n.projectId) ?? 0) + 1);
      setCommentsByProject(map);
    });
  }, [projects]);

  const refreshAll = () => {
    refresh();
    onProjectsChanged?.();
  };

  const filtered = projects.filter(
    (p) => p.code.toLowerCase().includes(search.toLowerCase()) || p.name.toLowerCase().includes(search.toLowerCase())
  );
  const active = filtered.filter((p) => p.isActive);
  const inactive = filtered.filter((p) => !p.isActive);
  const activeGroups = groupByCategory(
    [...active].sort((a, b) => a.code.localeCompare(b.code)),
    (p) => p.category,
    (p) => hoursByProject.get(p.id) ?? 0
  );
  const showCategoryHeaders = activeGroups.some((g) => g.category !== null);
  const openContextMenu = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, project });
  };
  const toggleCat = (key: string) =>
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Project Management</h1>
        <div className="flex gap-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width={16} height={16} />
            <TextInput placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56 pl-9" />
          </div>
          <Button variant="primary" icon={<PlusIcon />} onClick={() => setEditing('new')}>Add Project</Button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[32px_140px_1fr_140px_140px] border-b border-slate-100 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <span />
          <span>Project Code</span>
          <span>Name</span>
          <span className="text-right">Comments MTD</span>
          <span className="text-right">Hours MTD</span>
        </div>
        {activeGroups.map((g) => {
          const key = g.category ?? '__other';
          const isCollapsed = collapsedCats.has(key);
          const catMinutes = g.items.reduce((s, p) => s + (hoursByProject.get(p.id) ?? 0), 0);
          return (
          <div key={key}>
            {showCategoryHeaders && (
              <button onClick={() => toggleCat(key)} className="flex w-full items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-6 py-2 text-left hover:bg-slate-100">
                <ChevronRightIcon className={`text-slate-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} width={14} height={14} />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{g.category ?? 'Other'}</span>
                <span className="text-[11px] font-medium tabular-nums text-slate-400">{g.items.length} · {minutesToHhMm(catMinutes)}</span>
              </button>
            )}
            {!isCollapsed && g.items.map((p) => (
              <ProjectRow key={p.id} project={p} hours={hoursByProject.get(p.id) ?? 0} comments={commentsByProject.get(p.id) ?? 0} onEdit={() => setEditing(p)} onContextMenu={(e) => openContextMenu(e, p)} />
            ))}
          </div>
          );
        })}
        {active.length === 0 && <p className="px-6 py-6 text-sm text-slate-400">No projects yet - add one to get started.</p>}

        {inactive.length > 0 && (
          <div className="border-t border-slate-100">
            <button
              onClick={() => setShowInactive((v) => !v)}
              className="flex w-full items-center gap-2 px-6 py-3 text-sm text-slate-500 hover:bg-slate-50"
            >
              <ChevronRightIcon className={`transition-transform ${showInactive ? 'rotate-90' : ''}`} width={16} height={16} />
              Inactive Projects ({inactive.length})
            </button>
            {showInactive && inactive.map((p) => (
              <ProjectRow key={p.id} project={p} hours={hoursByProject.get(p.id) ?? 0} comments={commentsByProject.get(p.id) ?? 0} onEdit={() => setEditing(p)} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, project: p }); }} />
            ))}
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setEditing(contextMenu.project);
              setContextMenu(null);
            }}
          >
            Edit project
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={async () => {
              await window.api.projects.setActive(contextMenu.project.id, !contextMenu.project.isActive);
              setContextMenu(null);
              refreshAll();
            }}
          >
            {contextMenu.project.isActive ? 'Archive project' : 'Restore project'}
          </button>
        </div>
      )}

      {editing && (
        <AddEditProjectModal
          project={editing === 'new' ? undefined : editing}
          categories={[...new Set(projects.map((p) => p.category).filter((c): c is string => !!c))].sort()}
          onClose={() => setEditing(null)}
          onSaved={refreshAll}
        />
      )}
    </div>
  );
}

function ProjectRow({ project, hours, comments, onEdit, onContextMenu }: { project: Project; hours: number; comments: number; onEdit: () => void; onContextMenu: (e: React.MouseEvent) => void }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ProjectHistory | null>(null);
  const [month, setMonth] = useState('all');

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !history) window.api.projects.history(project.id).then(setHistory);
  };

  const months = useMemo(
    () => (history ? [...new Set(history.notes.map((n) => n.date.slice(0, 7)))].sort().reverse() : []),
    [history]
  );

  const notes = useMemo(() => {
    if (!history) return [];
    const list = month === 'all' ? history.notes : history.notes.filter((n) => n.date.slice(0, 7) === month);
    return [...list].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  }, [history, month]);

  return (
    <div className="border-b border-slate-50 last:border-0">
      <div className="grid grid-cols-[32px_140px_1fr_140px_140px] items-center px-6 py-4 hover:bg-slate-50" onContextMenu={onContextMenu}>
        <button
          onClick={toggle}
          aria-label={open ? 'Hide comments' : 'Show comments'}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600"
        >
          <ChevronRightIcon className={`transition-transform ${open ? 'rotate-90' : ''}`} width={16} height={16} />
        </button>
        <button onClick={onEdit} className="flex items-center gap-2 text-left text-xs font-semibold text-slate-400">
          <ColorDot color={project.color} /> {project.code}
        </button>
        <button onClick={onEdit} className="text-left font-semibold text-slate-900">{project.name}</button>
        <span className="text-right font-medium text-slate-700">{comments}</span>
        <span className="text-right font-medium text-slate-700">{minutesToHhMm(hours)}</span>
      </div>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Comments</h3>
            <div className="w-44">
              <Select value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="all">All dates</option>
                {months.map((m) => (
                  <option key={m} value={m}>{formatMonth(m)}</option>
                ))}
              </Select>
            </div>
          </div>
          {!history && <p className="text-sm text-slate-400">Loading…</p>}
          {history && notes.length === 0 && <p className="text-sm text-slate-400">No comments for this period.</p>}
          {notes.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="w-40 pb-2 font-semibold">Date</th>
                  <th className="pb-2 font-semibold">Comment</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((n) => (
                  <tr key={n.id} className="border-t border-slate-200 align-top">
                    <td className="py-2 pr-4 whitespace-nowrap text-slate-500">{formatDateShort(n.date)}</td>
                    <td className="py-2 whitespace-pre-wrap text-slate-700">{n.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
