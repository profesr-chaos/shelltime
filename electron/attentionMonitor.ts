export type AttentionState = 'stopped' | 'active' | 'idle_prompt' | 'paused_away' | 'paused_manual';

export interface IdlePromptPayload {
  projectId: number;
  idleSeconds: number;
  frozen: boolean; // true = a fixed, already-elapsed amount (shown post-resume); false = live/growing
  duringMeeting: boolean; // the banked window overlapped a calendar busy block — "were you in a meeting?"
}

export interface ResumePromptPayload {
  projectId: number;
}

export interface MeetingPromptPayload {
  projectId: number;
}

// Busy/free calendar lookup — optional; absent when the calendar feature is off (no ICS URL set).
export interface CalendarLike {
  isBusy(atMs: number): boolean;
  currentBusyBlock(atMs: number): { startMs: number; endMs: number } | null;
}

// Minimal surfaces AttentionMonitor depends on — kept separate from the concrete TimerEngine/db/
// electron.powerMonitor types so the state machine can be unit-tested in plain Node (those concrete
// types pull in better-sqlite3/Electron, which the lightweight test runner can't load).
export interface TimerStateLike {
  status: 'idle' | 'running' | 'paused';
  activeProjectId: number | null;
}

export interface TimerEngineLike {
  getState(): TimerStateLike;
  pause(): void;
  resume(): void;
  discardSeconds(projectId: number, seconds: number): void;
}

export interface AttentionSettingsLike {
  idlePromptMinutes: number;
  idleResumeMode: 'off' | 'auto' | 'prompt';
  breakIntervalMinutes: number;
  grindMode: boolean;
}

export interface PowerMonitorLike {
  getSystemIdleTime(): number;
  on(event: 'suspend' | 'lock-screen', cb: () => void): void;
}

const RESUME_ARM_IDLE_SECONDS = 15; // must have been idle at least this long to arm
const RESUME_ACTIVE_SECONDS = 3; // input newer than this counts as "back to work"
const BREAK_PAUSE_RESET_MS = 5 * 60 * 1000; // only reset the break clock after a pause this long
const TICK_MS = 1000;

interface AttentionCallbacks {
  onIdlePrompt: (payload: IdlePromptPayload) => void;
  onIdleResolved: () => void;
  onResumePrompt: (payload: ResumePromptPayload) => void;
  onResumeResolved: () => void;
  onBreakPrompt: (minutesWorked: number) => void;
  onBreakDismissed: () => void;
  onMeetingPrompt: (payload: MeetingPromptPayload) => void;
  onMeetingDismissed: () => void;
  onStateChange: () => void;
}

interface AttentionDeps {
  getSettings: () => AttentionSettingsLike;
  powerMonitor: PowerMonitorLike;
  now?: () => number;
  autoStart?: boolean; // false in tests — call tick() manually instead of a real 1s interval
  calendar?: CalendarLike; // absent = calendar feature off, zero behaviour change
  // True if the last project start/switch today is older than the configured suggest threshold —
  // kept db-free here; the caller (main.ts) owns the actual query.
  shouldSuggestMeetingSwitch?: () => boolean;
}

/**
 * Single state machine coordinating idle detection, sleep/lock, resume, and the break reminder —
 * replacing five independent timers/booleans (idle poll, resume poll, break tick, suspend/lock
 * events, plus the ad-hoc booleans gating them) that could run on top of each other. See
 * fix-specs-and-roadmap.md #1 for the defects this fixes and the state diagram it implements.
 *
 * States: active (tracking, no prompt) -> idle_prompt (tracking, live idle prompt shown) ->
 * paused_away (escalated: lock/sleep, or the idle prompt timed out unanswered) / paused_manual
 * (user clicked pause). From either paused state, fresh input resumes per idleResumeMode.
 */
export class AttentionMonitor {
  private state: AttentionState = 'stopped';

  // Live (unescalated) idle prompt — visible, timer still running.
  private idlePromptOpen = false;
  private idleWindowStart: number | null = null;
  private idlePromptOpenedAt: number | null = null;
  private idleProjectId: number | null = null;

  // Frozen banked window from an escalated idle prompt or a lock/sleep-while-prompting event.
  // Surfaced to the user only once they return (never while still away — nobody's there to see it).
  private pendingBankedSeconds: number | null = null;
  private pendingBankedProjectId: number | null = null;

  // Plain (no banked window) resume trial — a live counter of time since fresh activity was
  // detected, offered for keep/reject. Only relevant when there's nothing banked to ask about.
  private resumePromptOpen = false;
  private resumeTrialStartedAt: number | null = null;
  private resumeArmed = false;

  // Break clock — accrues only while genuinely active (frozen during any prompt or pause).
  private continuousWorkSeconds = 0;
  private breakPromptFired = false;

  // When the current pause began — only reset the break clock after a real break (>5 min).
  private pausedAt: number | null = null;

  // Frozen banked window from an escalated idle prompt overlapped a calendar busy block.
  private pendingBankedDuringMeeting = false;

  // Meeting-start switch suggestion — at most one open per busy block.
  private meetingPromptOpen = false;
  private wasBusy = false;

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private readonly now: () => number;
  private timer: TimerEngineLike;
  private cb: AttentionCallbacks;
  private deps: AttentionDeps;

  constructor(timer: TimerEngineLike, cb: AttentionCallbacks, deps: AttentionDeps) {
    this.timer = timer;
    this.cb = cb;
    this.deps = deps;
    this.now = deps.now ?? Date.now;
    if (deps.autoStart !== false) this.tickTimer = setInterval(() => this.tick(), TICK_MS);
    deps.powerMonitor.on('suspend', () => this.handleAway());
    deps.powerMonitor.on('lock-screen', () => this.handleAway());
  }

  dispose() {
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  getState(): AttentionState {
    return this.state;
  }

  // ---- explicit transitions — call right after the matching TimerEngine call ----

  notifyManualStart() {
    this.resetBreakClock();
    this.clearIdlePrompt();
    this.pendingBankedSeconds = null;
    this.pendingBankedProjectId = null;
    this.resumeArmed = false;
    this.pausedAt = null;
    this.state = 'active';
  }

  notifyManualPause() {
    if (this.state === 'stopped') return;
    if (this.idlePromptOpen) this.freezeLiveIdlePrompt();
    this.dismissBreakPrompt();
    if (this.meetingPromptOpen) this.dismissMeetingPrompt();
    this.pausedAt = this.now();
    this.resumeArmed = false;
    this.state = 'paused_manual';
  }

  notifyManualResume() {
    this.maybeResetBreakClock();
    this.pausedAt = null;
    this.resumeArmed = false;
    this.state = 'active';
    if (this.pendingBankedSeconds !== null) this.showBankedPrompt();
  }

  notifySwitch(wasIdle: boolean) {
    this.clearIdlePrompt();
    this.pendingBankedSeconds = null;
    this.pendingBankedProjectId = null;
    if (this.meetingPromptOpen) this.dismissMeetingPrompt();
    if (wasIdle) this.resetBreakClock();
    else this.maybeResetBreakClock();
    this.pausedAt = null;
    this.resumeArmed = false;
    this.state = 'active';
  }

  notifyStop() {
    if (this.idlePromptOpen) {
      this.idlePromptOpen = false;
      this.cb.onIdleResolved();
    }
    if (this.resumePromptOpen) {
      this.resumePromptOpen = false;
      this.cb.onResumeResolved();
    }
    if (this.meetingPromptOpen) this.dismissMeetingPrompt();
    this.idleWindowStart = null;
    this.idlePromptOpenedAt = null;
    this.idleProjectId = null;
    this.pendingBankedSeconds = null;
    this.pendingBankedProjectId = null;
    this.pendingBankedDuringMeeting = false;
    this.resumeTrialStartedAt = null;
    this.resumeArmed = false;
    this.pausedAt = null;
    this.state = 'stopped';
  }

  // ---- IPC-triggered resolution ----

  /** Discard maths are computed and frozen here — never trust a wall-clock value from the renderer. */
  resolveIdle(discard: boolean) {
    if (!this.idlePromptOpen) return; // already resolved from the other window
    const frozen = this.pendingBankedSeconds !== null;
    if (frozen) {
      if (discard && this.pendingBankedProjectId !== null) {
        this.timer.discardSeconds(this.pendingBankedProjectId, this.pendingBankedSeconds!);
      }
      // Keep or discard — either way this never touches run/pause state (rule: discard never
      // force-resumes; we're already 'active' here since the banked prompt only shows post-resume).
      this.pendingBankedSeconds = null;
      this.pendingBankedProjectId = null;
      this.pendingBankedDuringMeeting = false;
    } else if (this.idleWindowStart !== null && this.idleProjectId !== null) {
      if (discard) {
        const seconds = (this.now() - this.idleWindowStart) / 1000;
        // Still running (never escalated) — briefly pause to remove the seconds, then resume,
        // returning to the state we were in when the prompt opened (rule 7).
        this.timer.pause();
        this.timer.discardSeconds(this.idleProjectId, seconds);
        this.timer.resume();
      }
      this.state = 'active';
    }
    this.idlePromptOpen = false;
    this.idleWindowStart = null;
    this.idlePromptOpenedAt = null;
    this.idleProjectId = null;
    this.cb.onIdleResolved();
    this.cb.onStateChange();
  }

  resolveResume(discard: boolean) {
    if (!this.resumePromptOpen) return; // already resolved from the other window
    if (discard) {
      const projectId = this.timer.getState().activeProjectId;
      const seconds = this.resumeTrialStartedAt !== null ? (this.now() - this.resumeTrialStartedAt) / 1000 : 0;
      this.timer.pause();
      if (projectId !== null) this.timer.discardSeconds(projectId, seconds);
      this.pausedAt = this.now();
      this.state = 'paused_away';
    }
    this.resumePromptOpen = false;
    this.resumeTrialStartedAt = null;
    this.cb.onResumeResolved();
    this.cb.onStateChange();
  }

  /** "Yes" on the meeting-switch prompt — dismiss without switching. Picking a project instead
   * resolves it via notifySwitch (called from the timer:switch handler). */
  resolveMeeting() {
    if (this.meetingPromptOpen) this.dismissMeetingPrompt();
  }

  snoozeBreak(remindInMinutes?: number) {
    if (typeof remindInMinutes === 'number') {
      const threshold = this.deps.getSettings().breakIntervalMinutes * 60;
      this.continuousWorkSeconds = Math.max(0, threshold - remindInMinutes * 60);
    } else {
      this.continuousWorkSeconds = 0;
    }
    this.breakPromptFired = false;
  }

  // ---- internals ----

  private resetBreakClock() {
    this.continuousWorkSeconds = 0;
    this.breakPromptFired = false;
  }

  private maybeResetBreakClock() {
    if (this.pausedAt !== null && this.now() - this.pausedAt > BREAK_PAUSE_RESET_MS) this.resetBreakClock();
  }

  // Idle/resume prompts outrank the break reminder — dismiss it (it "re-arms": counts toward the
  // next interval fresh rather than instantly refiring).
  private dismissBreakPrompt() {
    if (this.breakPromptFired) {
      this.breakPromptFired = false;
      this.continuousWorkSeconds = 0;
      this.cb.onBreakDismissed();
    }
  }

  private clearIdlePrompt() {
    if (this.idlePromptOpen) {
      this.idlePromptOpen = false;
      this.cb.onIdleResolved();
    }
    this.idleWindowStart = null;
    this.idlePromptOpenedAt = null;
    this.idleProjectId = null;
  }

  private openLiveIdlePrompt(idleSeconds: number) {
    const projectId = this.timer.getState().activeProjectId;
    if (projectId === null) return;
    this.dismissBreakPrompt();
    this.idleProjectId = projectId;
    this.idleWindowStart = this.now() - idleSeconds * 1000;
    this.idlePromptOpenedAt = this.now();
    this.idlePromptOpen = true;
    this.state = 'idle_prompt';
    this.cb.onIdlePrompt({ projectId, idleSeconds, frozen: false, duringMeeting: false });
  }

  // Escalation: dismiss the live prompt (no one's there to see it), pause, and bank the exact
  // seconds tracked during the ambiguous window — bounds how much can accumulate without deciding
  // keep/discard until the user is actually back to answer.
  private freezeLiveIdlePrompt() {
    if (this.idleWindowStart === null || this.idleProjectId === null) return;
    const nowMs = this.now();
    const midpoint = (this.idleWindowStart + nowMs) / 2;
    this.pendingBankedSeconds = (nowMs - this.idleWindowStart) / 1000;
    this.pendingBankedProjectId = this.idleProjectId;
    this.pendingBankedDuringMeeting = this.deps.calendar?.currentBusyBlock(midpoint) != null;
    this.idlePromptOpen = false;
    this.idleWindowStart = null;
    this.idlePromptOpenedAt = null;
    this.idleProjectId = null;
    this.cb.onIdleResolved();
  }

  private showBankedPrompt() {
    if (this.pendingBankedProjectId === null || this.pendingBankedSeconds === null) return;
    this.idlePromptOpen = true;
    this.cb.onIdlePrompt({
      projectId: this.pendingBankedProjectId,
      idleSeconds: this.pendingBankedSeconds,
      frozen: true,
      duringMeeting: this.pendingBankedDuringMeeting,
    });
  }

  private dismissMeetingPrompt() {
    this.meetingPromptOpen = false;
    this.cb.onMeetingDismissed();
  }

  private maybeSuggestMeetingSwitch() {
    const projectId = this.timer.getState().activeProjectId;
    if (projectId === null) return;
    if (!this.deps.shouldSuggestMeetingSwitch?.()) return;
    this.meetingPromptOpen = true;
    this.cb.onMeetingPrompt({ projectId });
  }

  private escalateToAway() {
    this.freezeLiveIdlePrompt();
    this.timer.pause();
    this.pausedAt = this.now();
    this.state = 'paused_away';
    this.cb.onStateChange();
  }

  private handleAway() {
    if (this.state === 'active') {
      this.dismissBreakPrompt();
      this.timer.pause();
      this.pausedAt = this.now();
      this.state = 'paused_away';
      this.cb.onStateChange();
    } else if (this.state === 'idle_prompt') {
      this.escalateToAway();
    }
    // paused_manual / paused_away / stopped: already accounted for, no-op
  }

  private handleResumeDetected(mode: 'auto' | 'prompt') {
    const projectId = this.timer.getState().activeProjectId;
    if (projectId === null) return;

    this.timer.resume();
    this.maybeResetBreakClock();
    this.pausedAt = null;
    this.state = 'active';
    this.cb.onStateChange();

    if (this.pendingBankedSeconds !== null) {
      if (mode === 'auto') {
        // Default to keep, silently — matches "closing the prompt defaults to Keep".
        this.pendingBankedSeconds = null;
        this.pendingBankedProjectId = null;
        this.pendingBankedDuringMeeting = false;
      } else {
        this.showBankedPrompt();
      }
      return;
    }

    if (mode === 'prompt') {
      this.resumePromptOpen = true;
      this.resumeTrialStartedAt = this.now();
      this.cb.onResumePrompt({ projectId });
    }
  }

  /** Advance the state machine by one tick. Public so tests can drive it deterministically. */
  tick() {
    this.reconcileWithTimer();

    const busy = this.deps.calendar?.isBusy(this.now()) ?? false;
    const justBecameBusy = busy && !this.wasBusy;
    const justBecameFree = !busy && this.wasBusy;
    this.wasBusy = busy;
    if (this.meetingPromptOpen && justBecameFree) this.dismissMeetingPrompt();

    if (this.state === 'active') {
      // A meeting counts as work, not idleness: suppress the idle prompt while busy, and don't
      // fire the break prompt mid-meeting (it fires after, once continuousWorkSeconds already
      // cleared the threshold — the clock itself keeps accruing below, unsuppressed).
      if (justBecameBusy && !this.meetingPromptOpen) this.maybeSuggestMeetingSwitch();
      if (!busy) {
        const idleMinutes = this.deps.getSettings().idlePromptMinutes;
        if (idleMinutes > 0) {
          const idleSeconds = this.deps.powerMonitor.getSystemIdleTime();
          if (idleSeconds >= idleMinutes * 60) {
            this.openLiveIdlePrompt(idleSeconds);
            return;
          }
        }
      }
      if (!this.resumePromptOpen) {
        this.continuousWorkSeconds += 1;
        const settings = this.deps.getSettings();
        if (!busy && !settings.grindMode && !this.breakPromptFired && this.continuousWorkSeconds >= settings.breakIntervalMinutes * 60) {
          this.breakPromptFired = true;
          this.cb.onBreakPrompt(Math.round(this.continuousWorkSeconds / 60));
        }
      }
      return;
    }

    if (this.state === 'idle_prompt') {
      const idleMinutes = this.deps.getSettings().idlePromptMinutes;
      if (idleMinutes > 0 && this.idlePromptOpenedAt !== null && this.now() - this.idlePromptOpenedAt >= idleMinutes * 60 * 1000) {
        this.escalateToAway();
      }
      return;
    }

    if (this.state === 'paused_away' || this.state === 'paused_manual') {
      if (this.resumePromptOpen) return; // still waiting on a decision from a previous detection
      const mode = this.deps.getSettings().idleResumeMode;
      if (mode === 'off') return;
      const idle = this.deps.powerMonitor.getSystemIdleTime();
      if (idle >= RESUME_ARM_IDLE_SECONDS) {
        this.resumeArmed = true;
      } else if (this.resumeArmed && idle < RESUME_ACTIVE_SECONDS) {
        this.resumeArmed = false;
        this.handleResumeDetected(mode);
      }
      return;
    }
  }

  // Self-heals if the timer transitions to idle without going through one of the notify* hooks
  // (e.g. the active project was deleted from under it) — keeps this state machine from drifting
  // out of sync with TimerEngine, which is the class of bug this file exists to prevent.
  private reconcileWithTimer() {
    if (this.timer.getState().status === 'idle' && this.state !== 'stopped') {
      this.notifyStop();
    }
  }
}
