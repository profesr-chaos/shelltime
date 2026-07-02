import { useEffect, useRef, useState } from 'react';
import { useTimer } from '@/hooks/useTimer';
import { useProjects } from '@/hooks/useProjects';
import { useBreakPrompt } from '@/hooks/useBreakPrompt';
import { useIdlePrompt } from '@/hooks/useIdlePrompt';
import { useResumePrompt } from '@/hooks/useResumePrompt';
import { useOverlayDrag } from '@/hooks/useOverlayDrag';
import { secondsToHms, minutesToHhMm, todayIso } from '@/lib/format';
import { IconButton } from '@/components/ui/Button';
import { ColorDot } from '@/components/ui/Badge';
import { PauseIcon, PlayIcon, SwitchIcon, NoteIcon, CoffeeIcon, CollapseIcon, ExpandIcon, CloseIcon, SunIcon, MoonIcon } from '@/components/icons';
import { QuickSwitchMenu } from '@/components/QuickSwitchMenu';
import { OverlayNoteView } from './OverlayNoteView';

export function OverlayApp() {
  const { state, liveActiveSeconds, liveTodayTotalSeconds, pause, resume, switchProject, start } = useTimer();
  const { projects } = useProjects();
  const { minutesWorked, snooze, snoozeFor, takeBreak } = useBreakPrompt();
  const { idle, liveIdleSeconds, keep, discard } = useIdlePrompt();
  const resumePrompt = useResumePrompt();
  const drag = useOverlayDrag();

  const [compact, setCompact] = useState(true);
  const [dark, setDark] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const wasCompactBeforeBreak = useRef(false);

  useEffect(() => {
    window.api.settings.get().then((s) => {
      setCompact(s.overlayCompact);
      setDark(s.overlayDark);
    });
    const offCompact = window.api.overlay.onCompactChanged(setCompact);
    const offSettings = window.api.settings.onChanged((s) => setDark(s.overlayDark));
    return () => {
      offCompact();
      offSettings();
    };
  }, []);

  // Tailwind's class-based dark variant needs `.dark` on an ancestor, so put it on <html>
  // rather than on each root div (where `.dark .dark:*` can't match the element itself).
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const theme = '';

  useEffect(() => {
    if (minutesWorked !== null && compact) {
      wasCompactBeforeBreak.current = true;
      setCompact(false);
      window.api.overlay.setCompact(false);
    }
  }, [minutesWorked]);

  const restoreCompactIfNeeded = () => {
    if (wasCompactBeforeBreak.current) {
      wasCompactBeforeBreak.current = false;
      setCompact(true);
      window.api.overlay.setCompact(true);
    }
  };

  const toggleCompact = (next: boolean) => {
    setCompact(next);
    window.api.overlay.setCompact(next);
  };

  // Persist the theme; the settings:changed broadcast updates `dark` (here and in the main window).
  const toggleDark = () => window.api.settings.update({ overlayDark: !dark });

  // Compact mode is a 44px-tall window, too short for a dropdown — grow it while the switch menu is open, then restore.
  const COMPACT_MENU_HEIGHT = 320;
  const openCompactSwitch = () => {
    setSwitchOpen(true);
    window.api.overlay.setHeight(COMPACT_MENU_HEIGHT);
  };
  const closeCompactSwitch = () => {
    setSwitchOpen(false);
    window.api.overlay.setHeight(44);
  };

  // QuickSwitchMenu closes on clicks inside the overlay; also close (and shrink) when the
  // overlay loses focus, i.e. the user clicks another window entirely.
  useEffect(() => {
    if (!switchOpen || !compact) return;
    window.addEventListener('blur', closeCompactSwitch);
    return () => window.removeEventListener('blur', closeCompactSwitch);
  }, [switchOpen, compact]);

  const project = projects.find((p) => p.id === state.activeProjectId);
  const onBreak = minutesWorked !== null;
  // No active project yet: selecting one should start timing rather than switch.
  const selectProject = project ? switchProject : start;

  // Size the overlay to whatever it's currently showing: idle prompt, the break panel (which needs
  // extra room below the normal widget), or the plain compact/expanded widget.
  const onResume = resumePrompt.projectId !== null;

  useEffect(() => {
    if (idle || onResume) window.api.overlay.setHeight(210);
    else if (onBreak) window.api.overlay.setHeight(390);
    else window.api.overlay.setHeight(compact ? 44 : 220);
  }, [idle, onResume, onBreak, compact]);

  if (onResume) {
    const resumeProject = projects.find((p) => p.id === resumePrompt.projectId);
    return (
      <div {...drag} className={`${theme} flex h-full w-full select-none flex-col justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800`}>
        <p className="text-sm font-bold text-slate-900 dark:text-white">Back to work?</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
          Detected activity{resumeProject ? ` on ${resumeProject.code}` : ''} - timing again for
        </p>
        <p className="mt-1 text-center font-mono text-2xl font-bold tabular-nums text-amber">{secondsToHms(resumePrompt.liveSeconds)}</p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={resumePrompt.keep}
            className="no-drag flex-1 rounded-lg bg-amber py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Keep going
          </button>
          <button
            onClick={resumePrompt.reject}
            className="no-drag flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Not yet
          </button>
        </div>
      </div>
    );
  }

  if (idle) {
    const idleProject = projects.find((p) => p.id === idle.projectId);
    const idleMinutes = Math.max(1, Math.round(idle.idleSeconds / 60));
    return (
      <div {...drag} className={`${theme} flex h-full w-full select-none flex-col justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800`}>
        <p className="text-sm font-bold text-slate-900 dark:text-white">Still working?</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
          Idle{idleProject ? ` on ${idleProject.code}` : ''}. Keep the time or discard it?
        </p>
        <p className="mt-1 text-center font-mono text-2xl font-bold tabular-nums text-amber">{secondsToHms(liveIdleSeconds)}</p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={keep}
            className="no-drag flex-1 rounded-lg bg-amber py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Keep
          </button>
          <button
            onClick={discard}
            className="no-drag flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Discard {idleMinutes}m
          </button>
        </div>
      </div>
    );
  }

  if (noteOpen && project) {
    return (
      <div className={`${theme} h-full w-full`}>
        <OverlayNoteView
          onCancel={() => setNoteOpen(false)}
          onSave={(text) => {
            window.api.notes.add(todayIso(), project.id, text);
            setNoteOpen(false);
          }}
        />
      </div>
    );
  }

  if (compact && !onBreak) {
    return (
      <div className={`${theme} relative h-full w-full`}>
        <div {...drag} className="flex h-11 w-full select-none items-center gap-2 rounded-full border border-slate-200 bg-white px-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <button
            className="no-drag flex flex-1 items-center gap-2 overflow-hidden"
            onClick={() => (switchOpen ? closeCompactSwitch() : openCompactSwitch())}
          >
            {project ? <ColorDot color={project.color} /> : null}
            <span className="truncate text-sm font-bold text-slate-900 dark:text-white">{project?.code ?? 'Choose project'}</span>
          </button>
          <IconButton label="Expand" className="no-drag h-6 w-6 shrink-0" onClick={() => toggleCompact(false)}>
            <ExpandIcon width={14} height={14} />
          </IconButton>
          <span className="font-mono text-sm font-semibold tabular-nums text-amber">{secondsToHms(liveActiveSeconds)}</span>
          <IconButton
            label={state.status === 'running' ? 'Pause' : 'Resume'}
            disabled={!project}
            className="no-drag h-7 w-7 shrink-0"
            onClick={() => (state.status === 'running' ? pause() : resume())}
          >
            {state.status === 'running' ? <PauseIcon width={14} height={14} /> : <PlayIcon width={14} height={14} />}
          </IconButton>
          <IconButton label="Close overlay" className="no-drag h-7 w-7 shrink-0" onClick={() => window.api.overlay.hide()}>
            <CloseIcon width={14} height={14} />
          </IconButton>
        </div>
        {switchOpen && (
          <QuickSwitchMenu
            projects={projects}
            activeProjectId={state.activeProjectId}
            onSelect={selectProject}
            onClose={closeCompactSwitch}
            anchorClassName="top-12 left-0"
          />
        )}
      </div>
    );
  }

  return (
    <div {...drag} className={`${theme} relative flex h-full w-full select-none flex-col rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800`}>
      <div className="relative flex h-8 shrink-0 items-center justify-center">
        <span className="h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-600" />
        <div className="no-drag absolute right-2 top-1 flex gap-1">
          <IconButton label={dark ? 'Light mode' : 'Dark mode'} className="h-6 w-6" onClick={toggleDark}>
            {dark ? <SunIcon width={12} height={12} /> : <MoonIcon width={12} height={12} />}
          </IconButton>
          <IconButton label="Open full app" className="h-6 w-6" onClick={() => window.api.overlay.openMainWindow()}>
            <ExpandIcon width={12} height={12} />
          </IconButton>
          <IconButton label="Collapse" className="h-6 w-6" onClick={() => toggleCompact(true)}>
            <CollapseIcon width={12} height={12} />
          </IconButton>
          <IconButton label="Close overlay" className="h-6 w-6" onClick={() => window.api.overlay.hide()}>
            <CloseIcon width={12} height={12} />
          </IconButton>
        </div>
      </div>

      <div className={`px-4 pb-3 transition-opacity ${onBreak ? 'opacity-40 grayscale' : ''}`}>
        <div className="flex items-center justify-between">
          {project ? (
            <span className="rounded-md bg-amber px-2 py-0.5 text-xs font-bold text-white">{project.code}</span>
          ) : (
            <button
              onClick={() => setSwitchOpen((v) => !v)}
              className="no-drag rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-500 hover:border-amber hover:text-amber dark:border-slate-600 dark:text-slate-300"
            >
              Choose project
            </button>
          )}
          <span className="text-xs text-slate-400">{minutesToHhMm(liveTodayTotalSeconds / 60)} tracked</span>
        </div>
        <div className="my-3 text-center font-mono text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
          {secondsToHms(liveActiveSeconds)}
        </div>
        <button
          disabled={onBreak || !project}
          onClick={() => (state.status === 'running' ? pause() : resume())}
          className="no-drag flex w-full items-center justify-center gap-2 rounded-lg bg-amber py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-default disabled:opacity-50"
        >
          {state.status === 'running' ? <PauseIcon width={16} height={16} /> : <PlayIcon width={16} height={16} />}
          {state.status === 'running' ? 'Pause' : 'Resume'}
        </button>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <IconButton label="Switch project" disabled={onBreak} className="no-drag w-full" onClick={() => setSwitchOpen((v) => !v)}>
              <SwitchIcon width={16} height={16} />
            </IconButton>
            {switchOpen && (
              <QuickSwitchMenu
                projects={projects}
                activeProjectId={state.activeProjectId}
                onSelect={selectProject}
                onClose={() => setSwitchOpen(false)}
                anchorClassName="bottom-10 left-0"
              />
            )}
          </div>
          <IconButton label="Add note" disabled={onBreak || !project} className="no-drag flex-1" onClick={() => setNoteOpen(true)}>
            <NoteIcon width={16} height={16} />
          </IconButton>
        </div>
      </div>

      {onBreak && (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber text-white">
              <CoffeeIcon width={16} height={16} />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Time for a break</p>
              <p className="text-xs text-slate-400">{minutesWorked} min worked</p>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={() => {
                takeBreak();
                restoreCompactIfNeeded();
              }}
              className="w-full rounded-lg bg-amber py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Take break
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  snoozeFor(5);
                  restoreCompactIfNeeded();
                }}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Snooze 5m
              </button>
              <button
                onClick={() => {
                  snooze();
                  restoreCompactIfNeeded();
                }}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
