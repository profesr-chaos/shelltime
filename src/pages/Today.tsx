import { useCallback, useEffect, useState } from 'react';
import type { DailyEntry, DailyTargetStatus, Note, Project, Session } from '@shared/types';
import { useProjects } from '@/hooks/useProjects';
import { useTimer } from '@/hooks/useTimer';
import { todayIso, formatMonthDay, workdayNumberOfYear, minutesToHhMm, secondsToHms, formatClockTime, signedMinutesToHhMm } from '@/lib/format';
import { StatCard } from '@/components/ui/StatCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { IconButton } from '@/components/ui/Button';
import { ColorDot } from '@/components/ui/Badge';
import { PencilIcon, PlusIcon, PlayIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { ManualTimeModal } from '@/components/ManualTimeModal';
import { AddEditProjectModal } from '@/components/AddEditProjectModal';
import { DistributeDeltaModal } from '@/components/DistributeDeltaModal';
import { NotesModal } from '@/components/NotesModal';
import { FinishedForToday } from '@/components/FinishedForToday';
import { ReassignSessionModal } from '@/components/ReassignSessionModal';

const shiftDay = (date: string, delta: number): string => {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function Today() {
  const [date, setDate] = useState(todayIso());
  const isToday = date === todayIso();
  const { projects, refresh: refreshProjects } = useProjects(false);
  const { state: timerState, liveActiveSeconds, start, switchProject, stop } = useTimer();

  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [target, setTarget] = useState<DailyTargetStatus | null>(null);
  const [yesterdayMinutes, setYesterdayMinutes] = useState(0);
  const [notesByProject, setNotesByProject] = useState<Map<number, number>>(new Map());
  const [editEntry, setEditEntry] = useState<DailyEntry | 'new' | null>(null);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [distributeDelta, setDistributeDelta] = useState<number | null>(null);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [notesFor, setNotesFor] = useState<{ date: string; project: Project } | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [reassignSession, setReassignSession] = useState<Session | null>(null);

  const load = useCallback(() => {
    window.api.entries.getDaily(date).then(setEntries);
    window.api.targets.getDailyStatus(date).then(setTarget);
    window.api.notes.list(date).then((notes: Note[]) => {
      const map = new Map<number, number>();
      for (const n of notes) map.set(n.projectId, (map.get(n.projectId) ?? 0) + 1);
      setNotesByProject(map);
    });
    window.api.sessions.list(date).then(setSessions);
    const y = new Date(date + 'T00:00:00');
    y.setDate(y.getDate() - 1);
    const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    window.api.entries.getDailyTotal(yStr).then(setYesterdayMinutes);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-advance to the new logical day once it starts, but only while viewing "today" — a user
  // looking at a past day should not get yanked forward.
  useEffect(() => {
    const id = setInterval(() => {
      const nowIso = todayIso();
      setDate((d) => (d === nowIso ? d : isToday ? nowIso : d));
    }, 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  useEffect(() => {
    if (timerState.status !== 'idle') load();
  }, [timerState.status, timerState.activeProjectId, load]);

  const trackedMinutes = isToday
    ? entries.reduce((s, e) => s + (e.projectId === timerState.activeProjectId ? 0 : e.durationMinutes), 0)
      + (timerState.activeProjectId !== null ? liveActiveSeconds / 60 : 0)
    : entries.reduce((s, e) => s + e.durationMinutes, 0);

  const targetMinutes = target?.targetMinutes ?? 480;
  const remainingMinutes = Math.max(0, targetMinutes - trackedMinutes);
  const pct = targetMinutes > 0 ? trackedMinutes / targetMinutes : 0;

  const rows = projects.map((project) => {
    const isActive = isToday && project.id === timerState.activeProjectId && timerState.status === 'running';
    const entry = entries.find((e) => e.projectId === project.id);
    const minutes = isActive ? liveActiveSeconds / 60 : entry?.durationMinutes ?? 0;
    return { project, isActive, minutes, hasEntry: (entry?.durationMinutes ?? 0) > 0 };
  });

  rows.sort((a, b) => {
    // Compare by actual tracked time (seconds precision) so 00:00:14 outranks 00:00:09 outranks 00:00:00.
    if (Math.abs(a.minutes - b.minutes) > 1e-6) return b.minutes - a.minutes;
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.project.code.localeCompare(b.project.code);
  });

  const trackedDeltaPct = yesterdayMinutes > 0 ? Math.round(((trackedMinutes - yesterdayMinutes) / yesterdayMinutes) * 100) : null;
  const remainingDeltaPct = targetMinutes > 0 ? -Math.round((remainingMinutes / targetMinutes) * 100) : null;

  const weekday = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long' });
  const monthDay = formatMonthDay(date);

  // Lock the dropped total to the nearest 5 minutes — shared by the drag-label preview and the
  // actual seek handler so the label always matches what releasing there will produce.
  const snappedDeltaMinutes = (newFraction: number): number => {
    const snappedTracked = Math.round((newFraction * targetMinutes) / 5) * 5;
    return Math.round(snappedTracked - trackedMinutes);
  };

  const handleSeek = (newFraction: number) => {
    const delta = snappedDeltaMinutes(newFraction);
    if (delta === 0) return;
    const snappedTracked = Math.round((newFraction * targetMinutes) / 5) * 5;
    setSeekPreview(targetMinutes > 0 ? snappedTracked / targetMinutes : newFraction);
    setDistributeDelta(delta);
  };

  const dragLabel = (fraction: number) => signedMinutesToHhMm(snappedDeltaMinutes(fraction));

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDate((d) => shiftDay(d, -1))} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" title="Previous day">
              <ChevronLeftIcon />
            </button>
            <h1 className="text-2xl font-bold text-slate-900">{isToday ? 'Today, ' : ''}{monthDay}</h1>
            <button
              onClick={() => setDate((d) => shiftDay(d, 1))}
              disabled={isToday}
              className="rounded-lg p-1.5 text-slate-400 enabled:hover:bg-slate-100 disabled:opacity-30"
              title="Next day"
            >
              <ChevronRightIcon />
            </button>
            {!isToday && (
              <button onClick={() => setDate(todayIso())} className="ml-1 rounded-lg px-2 py-1 text-xs font-medium text-amber hover:bg-amber-50">
                Jump to today
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {weekday} · Workday {workdayNumberOfYear(date)} of {new Date(date).getFullYear()}
          </p>
        </div>
        {isToday && (
          <FinishedForToday
            finished={timerState.finishedForToday}
            projects={projects}
            onStop={stop}
            onResume={(id) => (timerState.activeProjectId === null ? start(id) : switchProject(id))}
          />
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatCard label="Tracked" value={minutesToHhMm(trackedMinutes)} delta={trackedDeltaPct !== null ? `${trackedDeltaPct >= 0 ? '+' : ''}${trackedDeltaPct}%` : undefined} deltaTone={trackedDeltaPct !== null && trackedDeltaPct >= 0 ? 'good' : 'bad'} />
        <StatCard label="Daily Target" value={minutesToHhMm(targetMinutes)} />
        <StatCard label="Remaining" value={minutesToHhMm(remainingMinutes)} delta={remainingDeltaPct !== null ? `${remainingDeltaPct}%` : undefined} deltaTone={remainingMinutes <= 0 ? 'good' : 'bad'} />
      </div>

      <div className="mt-8 w-full">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            {minutesToHhMm(trackedMinutes)} / {minutesToHhMm(targetMinutes)}
          </span>
          <span className="text-slate-400">
            {remainingMinutes <= 0 ? 'Target reached' : `${Math.round(pct * 100)}% · ${minutesToHhMm(remainingMinutes)} remaining`}
          </span>
        </div>
        <div title="Drag the snail to reassign tracked time between projects">
          <ProgressBar
            fraction={pct}
            tone="amber"
            paused={timerState.status === 'paused'}
            onSeek={handleSeek}
            previewFraction={seekPreview}
            dragLabel={dragLabel}
          />
        </div>
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Projects</h2>
          <IconButton label="Add new project" onClick={() => setAddProjectOpen(true)} className="h-8 w-8">
            <PlusIcon width={16} height={16} />
          </IconButton>
        </div>
        <div className="flex flex-col gap-3">
          {rows.length === 0 && <p className="text-sm text-slate-400">No active projects yet - add one from the Projects page.</p>}
          {rows.map(({ project, isActive, minutes }) => {
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
                  <button
                    onClick={() => setNotesFor({ date, project })}
                    className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm hover:bg-slate-100 ${
                      noteCount > 0 ? 'font-bold text-amber' : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title="View / add notes"
                  >
                    💬 {noteCount > 0 ? noteCount : ''}
                  </button>
                  <span className={`font-mono text-lg tabular-nums ${isActive ? 'font-bold text-amber' : 'text-slate-700'}`}>
                    {secondsToHms(minutes * 60)}
                  </span>
                  {isToday && !isActive && (
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
                    label="Edit time"
                    onClick={() => setEditEntry(entry ?? { id: 0, date, projectId: project.id, durationMinutes: 0, source: 'manual', createdAt: '', updatedAt: '', project })}
                    className="h-8 w-8"
                  >
                    <PencilIcon width={16} height={16} />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Timeline</h2>
          <div className="flex flex-col gap-2">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-500">
                    {formatClockTime(session.startedAt)}–{formatClockTime(session.endedAt)}
                  </span>
                  <ColorDot color={session.project.color} />
                  <span className="font-semibold text-slate-800">{session.project.code}</span>
                  <span className="text-slate-400">
                    {minutesToHhMm((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60_000)}
                  </span>
                </div>
                <button
                  onClick={() => setReassignSession(session)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-amber hover:bg-amber-50"
                >
                  Reassign
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {addProjectOpen && (
        <AddEditProjectModal
          onClose={() => setAddProjectOpen(false)}
          onSaved={refreshProjects}
        />
      )}

      {distributeDelta !== null && (
        <DistributeDeltaModal
          date={date}
          projects={projects}
          deltaMinutes={distributeDelta}
          onClose={() => { setDistributeDelta(null); setSeekPreview(null); }}
          onSaved={load}
        />
      )}

      {reassignSession && (
        <ReassignSessionModal
          session={reassignSession}
          projects={projects}
          onClose={() => setReassignSession(null)}
          onSaved={load}
        />
      )}

      {notesFor && (
        <NotesModal
          date={notesFor.date}
          project={notesFor.project}
          onClose={() => setNotesFor(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
