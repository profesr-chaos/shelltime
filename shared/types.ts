export interface Project {
  id: number;
  code: string;
  name: string;
  color: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EntrySource = 'timer' | 'manual';

export interface DailyEntry {
  id: number;
  date: string; // YYYY-MM-DD
  projectId: number;
  durationMinutes: number;
  source: EntrySource;
  createdAt: string;
  updatedAt: string;
  project: Project;
}

export interface Note {
  id: number;
  date: string;
  projectId: number;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  defaultDailyTargetMinutes: number;
  monthlyTargetMode: 'auto' | 'override';
  breakIntervalMinutes: number;
  grindMode: boolean;
  overlayAlwaysOnTop: boolean;
  overlayCompact: boolean;
  overlayPosition: { x: number; y: number } | null;
  overlayOpacity: number;
  startWithWindows: boolean;
  workingDays: number[];
}

export const OVERLAY_OPACITY_FLOOR = 0.3;

export type TimerStatus = 'idle' | 'running' | 'paused';

export interface TimerState {
  status: TimerStatus;
  activeProjectId: number | null;
  sessionStartedAt: number | null; // epoch ms, present only while running
  accumulatedSecondsToday: number; // already-committed seconds for active project today
  todayTotalSeconds: number; // sum across all projects today (committed)
}

export interface BreakPromptPayload {
  minutesWorked: number;
}

export interface DailyTargetStatus {
  date: string;
  targetMinutes: number;
  trackedMinutes: number;
  status: 'under' | 'met' | 'over';
}

export interface MonthlyProjectHours {
  project: Project;
  minutes: number;
}

export interface MonthlyProjectGridRow {
  project: Project;
  totalMinutes: number;
  minutesByDate: Record<string, number>; // date (YYYY-MM-DD) -> minutes
}

export interface MonthlyDailyTotal {
  date: string;
  minutes: number;
  targetMinutes: number;
  status: 'under' | 'met' | 'over';
  projectCodes: string[];
}

export interface MonthlyInsights {
  mostWorkedProject: Project | null;
  busiestDay: string | null;
  quietestDay: string | null;
  projectSwitches: number;
  totalMinutes: number;
  averageMinutesPerWorkingDay: number;
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  targetMinutes: number;
  actualMinutes: number;
  thisMonthOvertimeMinutes: number;
  lastMonthOvertimeMinutes: number;
  lastMonthActualMinutes: number;
  byProject: MonthlyProjectHours[];
  grid: MonthlyProjectGridRow[];
  dailyTotals: MonthlyDailyTotal[];
  insights: MonthlyInsights;
}

