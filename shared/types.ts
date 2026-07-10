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

export interface ProjectHistory {
  entries: { date: string; minutes: number }[];
  notes: Note[];
}

// Informational record of when work happened, distinct from daily_project_time (the source of
// truth for totals). Powers the day timeline and session reassignment; never used to derive totals.
export interface Session {
  id: number;
  date: string;
  projectId: number;
  startedAt: string; // ISO timestamp
  endedAt: string; // ISO timestamp, kept fresh while running
  project: Project;
}

export type LeaveType = 'holiday' | 'sick';

export interface LeaveRecord {
  id: number;
  type: LeaveType;
  startDate: string;
  endDate: string;
  half: boolean;
  days: number; // working days in the range, x0.5 if a half day
}

export interface LeaveSummary {
  holiday: number; // days this month
  sick: number;
  dates: string[]; // leave dates in the month (for the calendar)
}

export interface Settings {
  defaultDailyTargetMinutes: number;
  breakIntervalMinutes: number;
  idlePromptMinutes: number; // ask about idle time after this many idle minutes; 0 disables
  idleResumeMode: 'off' | 'auto' | 'prompt'; // when paused and activity returns: do nothing / resume silently / prompt keep-or-discard
  grindMode: boolean;
  overlayAlwaysOnTop: boolean;
  overlayCompact: boolean;
  overlayPosition: { x: number; y: number } | null;
  overlayOpacity: number;
  overlayDark: boolean; // dark theme for the pop-out widget
  startWithWindows: boolean;
  workingDays: number[];
  skipBankHolidays: boolean;
  holidayRegion: string; // "GB-ENG", "IE", "US" … country code, optionally "-STATE"
  hasCompletedSetup: boolean; // false until the user has reviewed the essential settings
  exportPrefix: string; // filename prefix for exports: <exportPrefix>_<date>
  userName: string; // shown in report headings: "<userName> - Monthly Report"
}

export const OVERLAY_OPACITY_FLOOR = 0.3;

export type TimerStatus = 'idle' | 'running' | 'paused';

export interface TimerState {
  status: TimerStatus;
  activeProjectId: number | null;
  sessionStartedAt: number | null; // epoch ms, present only while running
  accumulatedSecondsToday: number; // already-committed seconds for active project today
  todayTotalSeconds: number; // sum across all projects today (committed)
  finishedForToday: boolean; // user clicked "Finished for today"; auto-clears when the next working day starts
}

export interface BreakPromptPayload {
  minutesWorked: number;
}

export interface DayReview {
  date: string;
  totalMinutes: number;
  targetMinutes: number; // that day's target (0 on non-working days)
  byProject: { code: string; name: string; color: string; minutes: number }[]; // desc, leave projects included
  quitting: boolean; // true when shown as part of the quit flow
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
  isWorkingDay: boolean;
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
  carriedOverOvertimeMinutes: number; // running overtime from all prior tracked months
  cumulativeOvertimeMinutes: number; // carried-over + this month
  byProject: MonthlyProjectHours[];
  grid: MonthlyProjectGridRow[];
  dailyTotals: MonthlyDailyTotal[];
  insights: MonthlyInsights;
}

