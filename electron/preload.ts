import { contextBridge, ipcRenderer } from 'electron';
import type {
  Project,
  DailyEntry,
  Note,
  Settings,
  EntrySource,
  TimerState,
  MonthlySummary,
  ProjectHistory,
  LeaveType,
  LeaveRecord,
  LeaveSummary,
  Session,
  DayReview,
  MeetingPromptPayload,
} from '../shared/types';

const api = {
  projects: {
    list: (includeInactive = true): Promise<Project[]> => ipcRenderer.invoke('projects:list', includeInactive),
    recentIds: (): Promise<number[]> => ipcRenderer.invoke('projects:recentIds'),
    create: (input: { code: string; name: string; color?: string; description?: string; category?: string }): Promise<Project> =>
      ipcRenderer.invoke('projects:create', input),
    update: (id: number, patch: Partial<Project>): Promise<Project> => ipcRenderer.invoke('projects:update', id, patch),
    setActive: (id: number, isActive: boolean): Promise<Project> => ipcRenderer.invoke('projects:setActive', id, isActive),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('projects:delete', id),
    history: (id: number): Promise<ProjectHistory> => ipcRenderer.invoke('projects:history', id),
    onChanged: (cb: () => void) => {
      const listener = () => cb();
      ipcRenderer.on('projects:changed', listener);
      return () => {
        ipcRenderer.removeListener('projects:changed', listener);
      };
    },
  },
  entries: {
    getDaily: (date: string): Promise<DailyEntry[]> => ipcRenderer.invoke('entries:getDaily', date),
    getDailyTotal: (date: string): Promise<number> => ipcRenderer.invoke('entries:getDailyTotal', date),
    set: (date: string, projectId: number, durationMinutes: number, source: EntrySource): Promise<DailyEntry> =>
      ipcRenderer.invoke('entries:set', date, projectId, durationMinutes, source),
    delete: (date: string, projectId: number): Promise<void> => ipcRenderer.invoke('entries:delete', date, projectId),
    applyDelta: (date: string, projectIds: number[], deltaMinutes: number): Promise<void> =>
      ipcRenderer.invoke('entries:applyDelta', date, projectIds, deltaMinutes),
  },
  holidays: {
    countries: (): Promise<{ code: string; name: string }[]> => ipcRenderer.invoke('holidays:countries'),
    states: (country: string): Promise<{ code: string; name: string }[]> => ipcRenderer.invoke('holidays:states', country),
  },
  leave: {
    summary: (month: string): Promise<LeaveSummary> => ipcRenderer.invoke('leave:summary', month),
    list: (): Promise<LeaveRecord[]> => ipcRenderer.invoke('leave:list'),
    add: (type: LeaveType, start: string, end: string, half: boolean): Promise<LeaveRecord> =>
      ipcRenderer.invoke('leave:add', type, start, end, half),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('leave:delete', id),
  },
  notes: {
    list: (date: string, projectId?: number): Promise<Note[]> => ipcRenderer.invoke('notes:list', date, projectId),
    listForMonth: (month: string): Promise<(Note & { project: Project })[]> => ipcRenderer.invoke('notes:listForMonth', month),
    add: (date: string, projectId: number, text: string): Promise<Note> => ipcRenderer.invoke('notes:add', date, projectId, text),
    update: (id: number, text: string): Promise<Note> => ipcRenderer.invoke('notes:update', id, text),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('notes:delete', id),
  },
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
    update: (patch: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('settings:update', patch),
    onChanged: (cb: (settings: Settings) => void) => {
      const listener = (_: unknown, settings: Settings) => cb(settings);
      ipcRenderer.on('settings:changed', listener);
      return () => {
        ipcRenderer.removeListener('settings:changed', listener);
      };
    },
  },
  targets: {
    getDailyStatus: (date: string) => ipcRenderer.invoke('targets:getDailyStatus', date),
    setDailyOverride: (date: string, minutes: number | null) => ipcRenderer.invoke('targets:setDailyOverride', date, minutes),
    getMonthly: (month: string): Promise<number> => ipcRenderer.invoke('targets:getMonthly', month),
    setMonthlyOverride: (month: string, minutes: number | null) => ipcRenderer.invoke('targets:setMonthlyOverride', month, minutes),
  },
  day: {
    getFirstStart: (date: string): Promise<string | null> => ipcRenderer.invoke('day:getFirstStart', date),
    isWorkingDay: (date: string): Promise<boolean> => ipcRenderer.invoke('day:isWorkingDay', date),
  },
  sessions: {
    list: (date: string): Promise<Session[]> => ipcRenderer.invoke('sessions:list', date),
    reallocate: (sessionId: number, startIso: string, endIso: string, toProjectId: number): Promise<boolean> =>
      ipcRenderer.invoke('sessions:reallocate', sessionId, startIso, endIso, toProjectId),
  },
  review: {
    dismiss: (): Promise<void> => ipcRenderer.invoke('review:dismiss'),
    onShow: (cb: (review: DayReview) => void) => {
      const listener = (_: unknown, review: DayReview) => cb(review);
      ipcRenderer.on('review:show', listener);
      return () => {
        ipcRenderer.removeListener('review:show', listener);
      };
    },
    onDismissed: (cb: () => void) => {
      const listener = () => cb();
      ipcRenderer.on('review:dismissed', listener);
      return () => {
        ipcRenderer.removeListener('review:dismissed', listener);
      };
    },
  },
  timer: {
    getState: (): Promise<TimerState> => ipcRenderer.invoke('timer:getState'),
    start: (projectId: number): Promise<void> => ipcRenderer.invoke('timer:start', projectId),
    pause: (): Promise<void> => ipcRenderer.invoke('timer:pause'),
    resume: (): Promise<void> => ipcRenderer.invoke('timer:resume'),
    stop: (): Promise<void> => ipcRenderer.invoke('timer:stop'),
    switchProject: (projectId: number): Promise<void> => ipcRenderer.invoke('timer:switch', projectId),
    onUpdate: (cb: (state: TimerState) => void) => {
      const listener = (_: unknown, state: TimerState) => cb(state);
      ipcRenderer.on('timer:update', listener);
      return () => {
        ipcRenderer.removeListener('timer:update', listener);
      };
    },
    onBreakPrompt: (cb: (minutesWorked: number) => void) => {
      const listener = (_: unknown, minutesWorked: number) => cb(minutesWorked);
      ipcRenderer.on('break:prompt', listener);
      return () => {
        ipcRenderer.removeListener('break:prompt', listener);
      };
    },
    snoozeBreak: (remindInMinutes?: number): Promise<void> => ipcRenderer.invoke('timer:snoozeBreak', remindInMinutes),
    onBreakDismissed: (cb: () => void) => {
      const listener = () => cb();
      ipcRenderer.on('break:dismissed', listener);
      return () => {
        ipcRenderer.removeListener('break:dismissed', listener);
      };
    },
    onIdlePrompt: (cb: (data: { projectId: number; idleSeconds: number; frozen: boolean; duringMeeting: boolean }) => void) => {
      const listener = (_: unknown, data: { projectId: number; idleSeconds: number; frozen: boolean; duringMeeting: boolean }) => cb(data);
      ipcRenderer.on('idle:prompt', listener);
      return () => {
        ipcRenderer.removeListener('idle:prompt', listener);
      };
    },
    onIdleResolved: (cb: () => void) => {
      const listener = () => cb();
      ipcRenderer.on('idle:resolved', listener);
      return () => {
        ipcRenderer.removeListener('idle:resolved', listener);
      };
    },
    resolveIdle: (discard: boolean): Promise<void> => ipcRenderer.invoke('timer:resolveIdle', discard),
    onResumePrompt: (cb: (data: { projectId: number }) => void) => {
      const listener = (_: unknown, data: { projectId: number }) => cb(data);
      ipcRenderer.on('resume:prompt', listener);
      return () => {
        ipcRenderer.removeListener('resume:prompt', listener);
      };
    },
    onResumeResolved: (cb: () => void) => {
      const listener = () => cb();
      ipcRenderer.on('resume:resolved', listener);
      return () => {
        ipcRenderer.removeListener('resume:resolved', listener);
      };
    },
    resolveResume: (discard: boolean): Promise<void> => ipcRenderer.invoke('timer:resolveResume', discard),
    onMeetingPrompt: (cb: (data: MeetingPromptPayload) => void) => {
      const listener = (_: unknown, data: MeetingPromptPayload) => cb(data);
      ipcRenderer.on('meeting:prompt', listener);
      return () => {
        ipcRenderer.removeListener('meeting:prompt', listener);
      };
    },
    onMeetingDismissed: (cb: () => void) => {
      const listener = () => cb();
      ipcRenderer.on('meeting:dismissed', listener);
      return () => {
        ipcRenderer.removeListener('meeting:dismissed', listener);
      };
    },
    resolveMeeting: (): Promise<void> => ipcRenderer.invoke('timer:resolveMeeting'),
  },
  dashboard: {
    getMonthlySummary: (month: string): Promise<MonthlySummary> => ipcRenderer.invoke('dashboard:getMonthlySummary', month),
  },
  reportExport: {
    exportPdf: (month: string): Promise<{ ok: boolean; filePath?: string; error?: string }> =>
      ipcRenderer.invoke('export:pdf', month),
    exportXlsx: (month: string): Promise<{ ok: boolean; filePath?: string; error?: string }> =>
      ipcRenderer.invoke('export:xlsx', month),
    print: (month: string): Promise<void> => ipcRenderer.invoke('export:print', month),
  },
  overlay: {
    setCompact: (compact: boolean): Promise<void> => ipcRenderer.invoke('overlay:setCompact', compact),
    setHeight: (height: number): Promise<void> => ipcRenderer.invoke('overlay:setHeight', height),
    setPosition: (x: number, y: number): Promise<void> => ipcRenderer.invoke('overlay:setPosition', x, y),
    openMainWindow: (): Promise<void> => ipcRenderer.invoke('overlay:openMainWindow'),
    show: (): Promise<void> => ipcRenderer.invoke('overlay:show'),
    hide: (): Promise<void> => ipcRenderer.invoke('overlay:hide'),
    onCompactChanged: (cb: (compact: boolean) => void) => {
      const listener = (_: unknown, compact: boolean) => cb(compact);
      ipcRenderer.on('overlay:compactChanged', listener);
      return () => {
        ipcRenderer.removeListener('overlay:compactChanged', listener);
      };
    },
  },
  app: {
    getDataPath: (): Promise<string> => ipcRenderer.invoke('app:getDataPath'),
    openDataFolder: (): Promise<void> => ipcRenderer.invoke('app:openDataFolder'),
    backupDatabase: (): Promise<{ ok: boolean; filePath?: string; error?: string }> => ipcRenderer.invoke('backup:database'),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ShelltimeApi = typeof api;
