import { useCallback, useEffect, useState } from 'react';
import type { DailyEntry, DailyTargetStatus, Note } from '@shared/types';
import { useProjects } from '@/hooks/useProjects';
import { useTimer } from '@/hooks/useTimer';
import { todayIso, formatMonthDay, workdayNumberOfYear, minutesToHhMm, secondsToHms } from '@/lib/format';
import { StatCard } from '@/components/ui/StatCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button, IconButton } from '@/components/ui/Button';
import { ColorDot } from '@/components/ui/Badge';
import { PencilIcon, PlusIcon, PlayIcon, CloseIcon } from '@/components/icons';
import { ManualTimeModal } from '@/components/ManualTimeModal';
import { FillRestOfDayModal } from '@/components/FillRestOfDayModal';

export function Today() {
  const date = todayIso();
  const { projects, refresh: refreshProjects } = useProjects(false);
  const { state: timerState, liveActiveSeconds, start, switchProject } = useTimer();

  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [target, setTarget] = useState<DailyTargetStatus | null>(null);
  const [yesterdayMinutes, setYesterdayMinutes] = useState(0);
  const [notesByProject, setNotesByProject] = useState<Map<number, number>>(new Map());
  const [editEntry, setEditEntry] = useState<DailyEntry | 'new' | null>(null);
  const [fillOpen, setFillOpen] = useState(false);

  const load = useCallback(() => {
    window.api.entries.getDaily(date).then(setEntries);
    window.api.targets.getDailyStatus(date).then(setTarget);
    window.api.notes.list(date).then((notes: Note[]) => {
      const map = new Map<number, number>();
      for (const n of notes) map.set(n.projectId, (map.get(n.projectId) ?? 0) + 1);
      setNotesByProject(map);
    });
    const y = new Date(date + 'T00:00:00');
    y.setDate(y.getDate() - 1);
    const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    window.api.entries.getDailyTotal(yStr).then(setYesterdayMinutes);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (timerState.status !== 'idle') load();
  }, [timerState.status, timerState.activeProjectId, load]);

  const trackedMinutes = entries.reduce((s, e) => s + (e.projectId === timerState.activeProjectId ? 0 : e.durationMinutes), 0)
    + (timerState.activeProjectId !== null ? liveActiveSeconds / 60 : 0);

  const targetMinutes = target?.targetMinutes ?? 480;
  const remainingMinutes = Math.max(0, targetMinutes - trackedMinutes);
  const pct = targetMinutes > 0 ? trackedMinutes / targetMinutes : 0;

  const rows = projects.map((project) => {
    const isActive = project.id === timerState.activeProjectId && timerState.status === 'running';
    const entry = entries.find((e) => e.projectId === project.id);
    const minutes = isActive ? liveActiveSeconds / 60 : entry?.durationMinutes ?? 0;
    return { project, isActive, minutes, hasEntry: (entry?.durationMinutes ?? 0) > 0 };
  });

  rows.sort((a, b) => {
    const aMinutes = Math.floor(a.minutes);
    const bMinutes = Math.floor(b.minutes);
    if (aMinutes !== bMinutes) return bMinutes - aMinutes;
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.project.code.localeCompare(b.project.code);
  });

  const trackedDeltaPct = yesterdayMinutes > 0 ? Math.round(((trackedMinutes - yesterdayMinutes) / yesterdayMinutes) * 100) : null;
  const remainingDeltaPct = targetMinutes > 0 ? -Math.round((remainingMinutes / targetMinutes) * 100) : null;

  const weekday = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long' });
  const monthDay = formatMonthDay(date);

  const removeEntry = (projectId: number, code: string) => {
    if (!window.confirm(`Remove ${code} from today's distribution? This deletes its tracked time for today.`)) return;
    window.api.entries.delete(date, projectId).then(load);
  };

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Today, {monthDay}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {weekday} · Workday {workdayNumberOfYear(date)} of {new Date(date).getFullYear()}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" icon={<PlusIcon />} onClick={() => setEditEntry('new')}>
            New Entry
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatCard label="Tracked" value={minutesToHhMm(trackedMinutes)} delta={trackedDeltaPct !== null ? `${trackedDeltaPct >= 0 ? '+' : ''}${trackedDeltaPct}%` : undefined} deltaTone={trackedDeltaPct !== null && trackedDeltaPct >= 0 ? 'good' : 'bad'} />
        <StatCard label="Daily Target" value={minutesToHhMm(targetMinutes)} />
        <StatCard label="Remaining" value={minutesToHhMm(remainingMinutes)} delta={remainingDeltaPct !== null ? `${remainingDeltaPct}%` : undefined} deltaTone={remainingMinutes <= 0 ? 'good' : 'bad'} />
      </div>

      <div className="mt-8">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            {minutesToHhMm(trackedMinutes)} / {minutesToHhMm(targetMinutes)}
          </span>
          <span className="text-slate-400">
            {remainingMinutes <= 0 ? 'Target reached' : `${Math.round(pct * 100)}% · ${minutesToHhMm(remainingMinutes)} remaining`}
          </span>
        </div>
        <ProgressBar fraction={pct} tone="amber" paused={timerState.status === 'paused'} />
        {remainingMinutes > 0 && (
          <button onClick={() => setFillOpen(true)} className="mt-3 text-sm font-medium text-amber hover:underline">
            Fill rest of day
          </button>
        )}
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Project Distribution</h2>
          <IconButton label="Add project to today" onClick={() => setEditEntry('new')} className="h-8 w-8">
            <PlusIcon width={16} height={16} />
          </IconButton>
        </div>
        <div className="flex flex-col gap-3">
          {rows.length === 0 && <p className="text-sm text-slate-400">No active projects yet — add one from the Projects page.</p>}
          {rows.map(({ project, isActive, minutes, hasEntry }) => {
            const noteCount = notesByProject.get(project.id) ?? 0;
            const entry = entries.find((e) => e.projectId === project.id);
            return (
              <div
                key={project.id}
                className={`flex items-center justify-between rounded-xl border px-5 py-4 transition-colors ${
                  isActive ? 'border-amber bg-amber-50/60' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ColorDot color={project.color} />
                  <div>
                    <p className="font-bold text-slate-900">{project.code}</p>
                    <p className="text-sm text-slate-500">{project.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {noteCount > 0 && (
                    <span className="flex items-center gap-1 text-sm text-slate-400">💬 {noteCount}</span>
                  )}
                  <span className={`font-mono text-lg tabular-nums ${isActive ? 'font-bold text-amber' : 'text-slate-700'}`}>
                    {secondsToHms(minutes * 60)}
                  </span>
                  {!isActive && (
                    <IconButton
                      label="Start timing this project"
                      variant="primary"
                      onClick={() => (timerState.activeProjectId === null ? start(project.id) : switchProject(project.id))}
                      className="h-8 w-8"
                    >
                      <PlayIcon width={14} height={14} />
                    </IconButton>
                  )}
                  <IconButton
                    label="Edit entry"
                    onClick={() => setEditEntry(entry ?? { id: 0, date, projectId: project.id, durationMinutes: 0, source: 'manual', createdAt: '', updatedAt: '', project })}
                    className="h-8 w-8"
                  >
                    <PencilIcon width={16} height={16} />
                  </IconButton>
                  {!isActive && hasEntry && (
                    <IconButton
                      label="Remove from today"
                      onClick={() => removeEntry(project.id, project.code)}
                      className="h-8 w-8"
                    >
                      <CloseIcon width={16} height={16} />
                    </IconButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editEntry && (
        <ManualTimeModal
          date={date}
          mode={editEntry === 'new' ? 'add' : 'edit'}
          projects={projects}
          initialProjectId={editEntry === 'new' ? undefined : editEntry.projectId}
          currentMinutes={editEntry === 'new' ? 0 : editEntry.durationMinutes}
          onClose={() => setEditEntry(null)}
          onSaved={() => {
            load();
            refreshProjects();
          }}
        />
      )}

      {fillOpen && (
        <FillRestOfDayModal date={date} projects={projects} onClose={() => setFillOpen(false)} onSaved={load} />
      )}
    </div>
  );
}
