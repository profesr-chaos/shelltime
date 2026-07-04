import * as db from './db';
import type { TimerState } from '../shared/types';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const FLUSH_INTERVAL_MS = 15_000;

export class TimerEngine {
  private status: 'idle' | 'running' | 'paused' = 'idle';
  private activeProjectId: number | null = null;
  private sessionStartedAt: number | null = null;
  private accumulatedSecondsToday = 0;
  private currentDate = todayStr();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private onUpdate: (state: TimerState) => void;

  constructor(opts: { onUpdate: (state: TimerState) => void }) {
    this.onUpdate = opts.onUpdate;
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  private rolloverDayIfNeeded() {
    const today = todayStr();
    if (today !== this.currentDate) {
      this.flush();
      this.currentDate = today;
      this.accumulatedSecondsToday = 0;
    }
  }

  private liveElapsedSeconds(): number {
    if (this.status !== 'running' || this.sessionStartedAt === null) return 0;
    return (Date.now() - this.sessionStartedAt) / 1000;
  }

  private committedSecondsFor(projectId: number): number {
    const minutes = db.getDailyEntries(this.currentDate).find((e) => e.projectId === projectId)?.durationMinutes ?? 0;
    return minutes * 60;
  }

  /** Re-baseline the running total for a project after its stored time was changed directly (e.g. a manual edit),
   * so the live display doesn't drift from what's actually in the database. */
  resyncProjectTotal(projectId: number) {
    if (this.activeProjectId !== projectId) return;
    this.accumulatedSecondsToday = this.committedSecondsFor(projectId);
    if (this.status === 'running') this.sessionStartedAt = Date.now();
    this.emit();
  }

  /** Public: force-persist the active project's in-flight session time to the DB before an external edit,
   * so a relative delta lands on an up-to-date base instead of a value up to FLUSH_INTERVAL_MS stale. */
  flushActive() {
    this.flush();
  }

  private flush() {
    try {
      this.rolloverDayIfNeeded();
      if (this.status === 'running' && this.activeProjectId !== null && this.sessionStartedAt !== null) {
        if (!db.getProject(this.activeProjectId)) {
          // The active project was deleted from under the timer (e.g. in another window) — stop cleanly.
          this.status = 'idle';
          this.activeProjectId = null;
          this.sessionStartedAt = null;
          this.emit();
          return;
        }
        const elapsed = this.liveElapsedSeconds();
        db.addTimeToProject(this.currentDate, this.activeProjectId, elapsed / 60, 'timer');
        this.accumulatedSecondsToday += elapsed;
        this.sessionStartedAt = Date.now();
      }
    } catch (err) {
      console.error('TimerEngine.flush failed:', err);
    }
  }

  /** Remove idle seconds that were banked to a project (e.g. the user was away, not in a meeting). */
  discardSeconds(projectId: number, seconds: number) {
    db.addTimeToProject(this.currentDate, projectId, -seconds / 60, 'timer');
    if (this.activeProjectId === projectId) {
      this.accumulatedSecondsToday = this.committedSecondsFor(projectId);
      this.emit();
    }
  }

  private todayTotalSeconds(): number {
    return db.getDailyTotalMinutes(this.currentDate) * 60 + this.liveElapsedSeconds();
  }

  getState(): TimerState {
    return {
      status: this.status,
      activeProjectId: this.activeProjectId,
      sessionStartedAt: this.sessionStartedAt,
      accumulatedSecondsToday: this.accumulatedSecondsToday,
      todayTotalSeconds: this.todayTotalSeconds(),
    };
  }

  private emit() {
    this.onUpdate(this.getState());
  }

  start(projectId: number) {
    if (!db.getProject(projectId)) return;
    this.rolloverDayIfNeeded();
    db.recordDayFirstStartIfNeeded(this.currentDate);
    this.activeProjectId = projectId;
    this.status = 'running';
    this.sessionStartedAt = Date.now();
    this.accumulatedSecondsToday = this.committedSecondsFor(projectId);
    this.emit();
  }

  pause() {
    if (this.status !== 'running') return;
    this.flush();
    this.status = 'paused';
    this.sessionStartedAt = null;
    this.emit();
  }

  resume() {
    if (this.status !== 'paused' || this.activeProjectId === null) return;
    this.rolloverDayIfNeeded();
    this.status = 'running';
    this.sessionStartedAt = Date.now();
    this.emit();
  }

  /** End the work session entirely (not just a pause) — no active project, so idle/resume/break
   * monitoring has nothing to nag about. Starting a new project is how the user "un-stops". */
  stop() {
    if (this.status === 'idle') return;
    this.flush();
    this.status = 'idle';
    this.activeProjectId = null;
    this.sessionStartedAt = null;
    this.emit();
  }

  stopIfActiveProjectMissing() {
    if (this.activeProjectId !== null && !db.getProject(this.activeProjectId)) {
      this.status = 'idle';
      this.activeProjectId = null;
      this.sessionStartedAt = null;
      this.emit();
    }
  }

  switchProject(projectId: number) {
    if (!db.getProject(projectId)) return;
    if (this.status === 'running') this.flush();
    this.rolloverDayIfNeeded();
    db.recordDayFirstStartIfNeeded(this.currentDate);
    this.activeProjectId = projectId;
    this.status = 'running';
    this.sessionStartedAt = Date.now();
    this.accumulatedSecondsToday = this.committedSecondsFor(projectId);
    this.emit();
  }

  dispose() {
    if (this.flushTimer) clearInterval(this.flushTimer);
  }
}
