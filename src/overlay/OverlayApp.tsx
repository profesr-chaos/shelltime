import { useEffect, useRef, useState } from 'react';
import { useTimer } from '@/hooks/useTimer';
import { useProjects } from '@/hooks/useProjects';
import { useBreakPrompt } from '@/hooks/useBreakPrompt';
import { useIdlePrompt } from '@/hooks/useIdlePrompt';
import { useResumePrompt } from '@/hooks/useResumePrompt';
import { useMeetingPrompt } from '@/hooks/useMeetingPrompt';
import { useDayReview } from '@/hooks/useDayReview';
import { useOverlayDrag } from '@/hooks/useOverlayDrag';
import { secondsToHms, minutesToHhMm, todayIso, signedMinutesToHhMm } from '@/lib/format';
import { IconButton } from '@/components/ui/Button';
import { ColorDot } from '@/components/ui/Badge';
import { PauseIcon, PlayIcon, SwitchIcon, NoteIcon, CoffeeIcon, CollapseIcon, ExpandIcon, CloseIcon, SunIcon, MoonIcon } from '@/components/icons';
import { QuickSwitchMenu } from '@/components/QuickSwitchMenu';
import { FinishedForToday } from '@/components/FinishedForToday';
import { OverlayNoteView } from './OverlayNoteView';
export function OverlayApp() {
  const { state, liveActiveSeconds, liveTodayTotalSeconds, pause, resume, stop, unfinish, switchProject, start } = useTimer();
  const { projects } = useProjects();
  const { minutesWorked, snooze, snoozeFor, takeBreak } = useBreakPrompt();
  const { idle, liveIdleSeconds, keep, discard } = useIdlePrompt();
  const resumePrompt = useResumePrompt();
  const meetingPrompt = useMeetingPrompt();
  const { review, dismiss: dismissReview } = useDayReview();
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

  // QuickSwitchMenu closes on clicks inside the overlay; also close (and shrink the window back)
  // when the overlay loses focus, i.e. the user clicks another window entirely.
  useEffect(() => {
    if (!switchOpen) return;
    const close = () => setSwitchOpen(false);
    window.addEventListener('blur', close);
    return () => window.removeEventListener('blur', close);
  }, [switchOpen]);

  const project = projects.find((p) => p.id === state.activeProjectId);
  const onBreak = minutesWorked !== null;
  // No active project yet: selecting one should start timing rather than switch.
  const selectProject = project ? switchProject : start;

  // Size the overlay to whatever it's currently showing: idle prompt, the break panel (which needs
  // extra room below the normal widget), or the plain compact/expanded widget.
  const onResume = resumePrompt.projectId !== null;

  // The overlay window is normally shorter than an open dropdown, which clips its first/last
  // rows — grow the window while a menu is open, shrink it back on close.
  const menuOpen = switchOpen;
  // The open menu reports its own bottom edge; grow the window to that (+ a little breathing room)
  // so the dropdown is never clipped and never leaves a big empty box below it.
  const [menuBottom, setMenuBottom] = useState(0);
  const menuHeight = menuBottom ? Math.ceil(menuBottom) + 8 : 320;
  useEffect(() => {
    if (review) window.api.overlay.setHeight(300);
    else if (onResume) window.api.overlay.setHeight(250);
    else if (idle) window.api.overlay.setHeight(210);
    else if (meetingPrompt.projectId !== null) window.api.overlay.setHeight(390);
    else if (onBreak) window.api.overlay.setHeight(390);
    else if (compact) window.api.overlay.setHeight(switchOpen ? menuHeight : 32);
    else window.api.overlay.setHeight(menuOpen ? menuHeight : 240);
  }, [review, idle, onResume, meetingPrompt.projectId, onBreak, compact, switchOpen, menuOpen, menuHeight]);

  if (review) {
    const delta = review.totalMinutes - review.targetMinutes;
    return (
      <div {...drag} className={`${theme} flex h-full w-full select-none flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800`}>
        <p className="text-sm font-bold text-slate-900 dark:text-white">Today · {minutesToHhMm(review.totalMinutes)} tracked</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
          {review.targetMinutes > 0 ? `${signedMinutesToHhMm(delta)} vs ${minutesToHhMm(review.targetMinutes)} target` : 'Non-working day'}
        </p>
        <div className="mt-2 flex-1 overflow-y-auto">
          {review.byProject.length === 0 && <p className="text-xs text-slate-400">Nothing tracked today.</p>}
          {review.byProject.map((p) => (
            <div key={p.code} className="flex items-center justify-between py-1 text-xs">
              <span className="flex items-center gap-1.5">
                <ColorDot color={p.color} />
                <span className="font-medium text-slate-700 dark:text-slate-200">{p.code}</span>
              </span>
              <span className="text-slate-500 dark:text-slate-400">{minutesToHhMm(p.minutes)}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            dismissReview();
            if (!review.quitting) window.api.overlay.hide(); // quitting tears the app down anyway
          }}
          className="no-drag mt-2 w-full rounded-lg bg-amber py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          {review.quitting ? 'Quit Shelltime' : 'Close'}
        </button>
      </div>
    );
  }

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
            Keep
          </button>
          <button
            onClick={resumePrompt.reject}
            className="no-drag flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Discard
          </button>
        </div>
        <div className="mt-3 flex justify-center">
          <FinishedForToday
            finished={false}
            onStop={() => {
              resumePrompt.reject();
              stop();
            }}
            onUnfinish={unfinish}
            bordered={false}
          />
        </div>
      </div>
    );
  }

  if (idle) {
    const idleProject = projects.find((p) => p.id === idle.projectId);
    const idleMinutes = Math.max(1, Math.round(liveIdleSeconds / 60));
    return (
      <div {...drag} className={`${theme} flex h-full w-full select-none flex-col justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800`}>
        <p className="text-sm font-bold text-slate-900 dark:text-white">
          {idle.duringMeeting ? 'You were in a meeting' : idle.frozen ? 'Welcome back' : 'Still working?'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
          {idle.duringMeeting
            ? 'Your calendar shows you were busy - keep the time?'
            : idle.frozen
              ? `Away${idleProject ? ` on ${idleProject.code}` : ''} - keep the banked time or discard it?`
              : `Idle${idleProject ? ` on ${idleProject.code}` : ''}. Keep the time or discard it?`}
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

  if (meetingPrompt.projectId !== null) {
    const meetingProject = projects.find((p) => p.id === meetingPrompt.projectId);
    return (
      <div {...drag} className={`${theme} flex h-full w-full select-none flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800`}>
        <p className="text-sm font-bold text-slate-900 dark:text-white">In a meeting</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
          Still working on {meetingProject?.code ?? 'this'}?
        </p>
        <div className="relative mt-2 flex-1">
          <QuickSwitchMenu
            projects={projects}
            activeProjectId={meetingPrompt.projectId}
            onSelect={switchProject}
            onClose={meetingPrompt.dismiss}
            anchorClassName="inset-x-0 top-0"
            heading="Switch to"
          />
        </div>
        <button
          onClick={meetingPrompt.dismiss}
          className="no-drag mt-2 w-full rounded-lg bg-amber py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          Yes, still {meetingProject?.code ?? 'this'}
        </button>
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
      <div {...drag} className="flex h-8 w-full select-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <button
            className="no-drag flex flex-1 items-center gap-2 overflow-hidden"
            onClick={() => setSwitchOpen((v) => !v)}
          >
            {project ? (
              <>
                <ColorDot color={project.color} />
                <span className="truncate text-sm font-bold text-slate-900 dark:text-white">{project.code}</span>
              </>
            ) : (
              <span className="truncate rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-500 hover:border-amber hover:text-amber dark:border-slate-600 dark:text-slate-300">
                Choose project
              </span>
            )}
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
            onClose={() => setSwitchOpen(false)}
            anchorClassName="top-12 left-0"
            onHeight={setMenuBottom}
          />
        )}
      </div>
    );
  }

  return (
    // Outer fills the (menu-grown) window transparently; the card keeps its natural height so an open
    // dropdown floats into the space below instead of stretching the card.
    <div className={`${theme} h-full w-full`}>
    <div {...drag} className="relative flex w-full select-none flex-col rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
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
            <button
              onClick={() => setSwitchOpen((v) => !v)}
              className="no-drag rounded-md bg-amber px-2 py-0.5 text-xs font-bold text-white hover:bg-orange-600"
            >
              {project.code}
            </button>
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
        <div className="relative mt-2 flex gap-2">
          <button
            disabled={onBreak || !project}
            onClick={() => (state.status === 'running' ? pause() : resume())}
            className="no-drag flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-default disabled:opacity-50"
          >
            {state.status === 'running' ? <PauseIcon width={16} height={16} /> : <PlayIcon width={16} height={16} />}
            {state.status === 'running' ? 'Pause' : 'Resume'}
          </button>
          <button
            aria-label="Switch project"
            title="Switch project"
            disabled={onBreak}
            onClick={() => setSwitchOpen((v) => !v)}
            className="no-drag flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            <SwitchIcon width={16} height={16} />
          </button>
          <button
            aria-label="Add note"
            title="Add note"
            disabled={onBreak || !project}
            onClick={() => setNoteOpen(true)}
            className="no-drag flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            <NoteIcon width={16} height={16} />
          </button>
          {switchOpen && (
            <QuickSwitchMenu
              projects={projects}
              activeProjectId={state.activeProjectId}
              onSelect={selectProject}
              onClose={() => setSwitchOpen(false)}
              anchorClassName="top-14 left-0"
              onHeight={setMenuBottom}
            />
          )}
        </div>
        <FinishedForToday
          finished={state.finishedForToday}
          onStop={stop}
          onUnfinish={unfinish}
          disabled={onBreak}
          bordered={false}
          className="mt-3"
        />
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
    </div>
  );
}
