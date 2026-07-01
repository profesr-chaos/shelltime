import { useState } from 'react';
import { useTimer } from '@/hooks/useTimer';
import { useProjects } from '@/hooks/useProjects';
import { secondsToHms } from '@/lib/format';
import { todayIso } from '@/lib/format';
import { Button, IconButton } from './ui/Button';
import { NoteIcon, PauseIcon, PlayIcon, SwitchIcon, ExpandIcon } from './icons';
import { AddNoteModal } from './AddNoteModal';
import { QuickSwitchMenu } from './QuickSwitchMenu';

export function BottomTimerBar() {
  const { state, liveActiveSeconds, pause, resume, switchProject, start } = useTimer();
  const { projects } = useProjects();
  const [noteOpen, setNoteOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);

  if (state.activeProjectId === null) {
    return (
      <div className="fixed inset-y-auto bottom-0 left-60 right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white px-8 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
        <p className="text-sm text-slate-400">No active timer</p>
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon={<ExpandIcon />} onClick={() => window.api.overlay.show()}>
            Pop out
          </Button>
          <div className="relative">
            <Button variant="primary" icon={<PlayIcon />} onClick={() => setStartOpen((v) => !v)}>
              Start Timer
            </Button>
            {startOpen && (
              <QuickSwitchMenu
                projects={projects}
                activeProjectId={null}
                onSelect={start}
                onClose={() => setStartOpen(false)}
                anchorClassName="bottom-12 right-0"
                heading="Start timing"
              />
            )}
          </div>
        </div>
      </div>
    );
  }
  const project = projects.find((p) => p.id === state.activeProjectId);

  return (
    <div className="fixed inset-y-auto bottom-0 left-60 right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white px-8 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Active Project</p>
        <p className="text-sm font-bold text-slate-900">{project?.code ?? '—'}</p>
      </div>

      <div className="font-mono text-3xl font-bold tabular-nums text-amber">{secondsToHms(liveActiveSeconds)}</div>

      <div className="flex items-center gap-3">
        <Button variant="secondary" icon={<ExpandIcon />} onClick={() => window.api.overlay.show()}>
          Pop out
        </Button>
        <Button variant="secondary" icon={<NoteIcon />} onClick={() => setNoteOpen(true)}>
          Add Note
        </Button>
        <div className="relative">
          <Button variant="secondary" icon={<SwitchIcon />} onClick={() => setSwitchOpen((v) => !v)}>
            Switch
          </Button>
          {switchOpen && (
            <QuickSwitchMenu
              projects={projects}
              activeProjectId={state.activeProjectId}
              onSelect={switchProject}
              onClose={() => setSwitchOpen(false)}
              anchorClassName="bottom-12 right-0"
            />
          )}
        </div>
        <IconButton
          label={state.status === 'running' ? 'Pause' : 'Resume'}
          variant="primary"
          className="h-12 w-12"
          onClick={() => (state.status === 'running' ? pause() : resume())}
        >
          {state.status === 'running' ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
      </div>

      {noteOpen && project && (
        <AddNoteModal date={todayIso()} projectId={project.id} projectLabel={`${project.code} — ${project.name}`} onClose={() => setNoteOpen(false)} />
      )}
    </div>
  );
}
