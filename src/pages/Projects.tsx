import { useEffect, useState } from 'react';
import type { Project } from '@shared/types';
import { useProjects } from '@/hooks/useProjects';
import { currentMonthStr, minutesToHoursLabel } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Badge, ColorDot } from '@/components/ui/Badge';
import { TextInput } from '@/components/ui/Inputs';
import { PlusIcon, SearchIcon, ChevronRightIcon } from '@/components/icons';
import { AddEditProjectModal } from '@/components/AddEditProjectModal';

export function Projects({ onProjectsChanged }: { onProjectsChanged?: () => void }) {
  const { projects, refresh } = useProjects(true);
  const [search, setSearch] = useState('');
  const [hoursByProject, setHoursByProject] = useState<Map<number, number>>(new Map());
  const [editing, setEditing] = useState<Project | 'new' | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    window.api.dashboard.getMonthlySummary(currentMonthStr()).then((summary) => {
      setHoursByProject(new Map(summary.byProject.map((bp) => [bp.project.id, bp.minutes])));
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
        <div className="grid grid-cols-[1fr_140px_140px] border-b border-slate-100 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <span>Code / Name</span>
          <span>Status</span>
          <span className="text-right">Hours MTD</span>
        </div>
        {active.map((p) => (
          <ProjectRow key={p.id} project={p} hours={hoursByProject.get(p.id) ?? 0} onClick={() => setEditing(p)} />
        ))}
        {active.length === 0 && <p className="px-6 py-6 text-sm text-slate-400">No projects yet — add one to get started.</p>}

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
              <ProjectRow key={p.id} project={p} hours={hoursByProject.get(p.id) ?? 0} onClick={() => setEditing(p)} />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <AddEditProjectModal
          project={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={refreshAll}
        />
      )}
    </div>
  );
}

function ProjectRow({ project, hours, onClick }: { project: Project; hours: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="grid w-full grid-cols-[1fr_140px_140px] items-center border-b border-slate-50 px-6 py-4 text-left last:border-0 hover:bg-slate-50"
    >
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <ColorDot color={project.color} /> {project.code}
        </p>
        <p className="mt-0.5 font-semibold text-slate-900">{project.name}</p>
      </div>
      <span>
        <Badge tone={project.isActive ? 'green' : 'slate'}>{project.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
      </span>
      <span className="text-right font-medium text-slate-700">{minutesToHoursLabel(hours)}</span>
    </button>
  );
}
