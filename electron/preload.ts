import { contextBridge, ipcRenderer } from 'electron';
import type {
  Project,
  DailyEntry,
  Note,
  Settings,
  EntrySource,
  TimerState,
  MonthlySummary,
} from '../shared/types';

const api = {
  projects: {
    list: (includeInactive = true): Promise<Project[]> => ipcRenderer.invoke('projects:list', includeInactive),
    create: (input: { code: string; name: string; color?: string; description?: string }): Promise<Project> =>
      ipcRenderer.invoke('projects:create', input),
    update: (id: number, patch: Partial<Project>): Promise<Project> => ipcRenderer.invoke('projects:update', id, patch),
    setActive: (id: number, isActive: boolean): Promise<Project> => ipcRenderer.invoke('projects:setActive', id, isActive),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('projects:delete', id),
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
    list: (month: string): Promise<{ date: string; minutes: number; targetMinutes: number }[]> =>
      ipcRenderer.invoke('holidays:list', month),
    addRange: (start: string, end: string, half = false): Promise<string[]> =>
      ipcRenderer.invoke('holidays:addRange', start, end, half),
    remove: (date: string): Promise<void> => ipcRenderer.invoke('holidays:remove', date),
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
  },
  targets: {
    getDailyStatus: (date: string) => ipcRenderer.invoke('targets:getDailyStatus', date),
    setDailyOverride: (date: string, minutes: number | null) => ipcRenderer.invoke('targets:setDailyOverride', date, minutes),
    getMonthly: (month: string): Promise<number> => ipcRenderer.invoke('targets:getMonthly', month),
    setMonthlyOverride: (month: string, minutes: number | null) => ipcRenderer.invoke('targets:setMonthlyOverride', month, minutes),
  },
  timer: {
    getState: (): Promise<TimerState> => ipcRenderer.invoke('timer:getState'),
    start: (projectId: number): Promise<void> => ipcRenderer.invoke('timer:start', projectId),
    pause: (): Promise<void> => ipcRenderer.invoke('timer:pause'),
    resume: (): Promise<void> => ipcRenderer.invoke('timer:resume'),
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
    snoozeBreak: (): Promise<void> => ipcRenderer.invoke('timer:snoozeBreak'),
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
