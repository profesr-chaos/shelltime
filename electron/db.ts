import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type {
  Project,
  DailyEntry,
  Note,
  Settings,
  EntrySource,
  MonthlySummary,
  MonthlyDailyTotal,
} from '../shared/types';
import { OVERLAY_OPACITY_FLOOR } from '../shared/types';

let db: Database.Database;

const DEFAULT_COLORS = ['#F5941E', '#3B82F6', '#10B981', '#EC4899', '#8B5CF6', '#EF4444'];

const DEFAULT_SETTINGS: Settings = {
  defaultDailyTargetMinutes: 480,
  monthlyTargetMode: 'auto',
  breakIntervalMinutes: 60,
  grindMode: false,
  overlayAlwaysOnTop: true,
  overlayCompact: false,
  overlayPosition: null,
  overlayOpacity: 1,
  startWithWindows: false,
  workingDays: [1, 2, 3, 4, 5],
};

export function clampOverlayOpacity(value: number): number {
  return Math.max(OVERLAY_OPACITY_FLOOR, Math.min(1, value));
}

export function initDb(userDataDir: string) {
  fs.mkdirSync(userDataDir, { recursive: true });
  db = new Database(path.join(userDataDir, 'shelltime.db'));
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_project_time (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      duration_minutes REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(date, project_id)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_targets (
      date TEXT PRIMARY KEY,
      target_minutes REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monthly_target_overrides (
      month TEXT PRIMARY KEY,
      target_minutes REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  seedSettingsDefaults();
  seedDemoDataIfEmpty();
}

const DEMO_NOTES = [
  'Wrote tender responses for questions 1 and 2.',
  'Reviewed commercial assumptions.',
  'Updated project tracker and risk notes.',
];

function seedDemoDataIfEmpty() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM projects').get() as any;
  if (existing.c > 0) return;

  const demoProjects = [
    createProject({ code: 'GC-TENDER', name: 'General Construction Tender Phase 2', color: '#F5941E' }),
    createProject({ code: 'OPS-ADMIN', name: 'Operational Administration & Internal', color: '#3B82F6' }),
    createProject({ code: 'BD-2026', name: 'Business Development Strategy', color: '#10B981' }),
    createProject({ code: 'PERSONAL', name: 'Personal', color: '#94A3B8' }),
  ];

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const cursor = new Date(monthStart);
  let noteIdx = 0;

  while (cursor < todayMidnight) {
    const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (isWorkingDay(dateStr)) {
      const dailyBudget = 6.5 * 60 + Math.random() * 3 * 60; // 6.5h - 9.5h
      const weights = demoProjects.map(() => Math.random());
      const weightSum = weights.reduce((a, b) => a + b, 0);
      demoProjects.forEach((p, i) => {
        const minutes = Math.round((weights[i] / weightSum) * dailyBudget);
        if (minutes > 5) setDailyEntry(dateStr, p.id, minutes, 'timer');
      });
      if (Math.random() < 0.3) {
        addNote(dateStr, demoProjects[0].id, DEMO_NOTES[noteIdx % DEMO_NOTES.length]);
        noteIdx++;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
}

function now() {
  return new Date().toISOString();
}

export function isWorkingDay(dateStr: string): boolean {
  const day = new Date(dateStr + 'T00:00:00').getDay();
  return getSettings().workingDays.includes(day);
}

function workingDaysInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const days: string[] = [];
  const daysInMonth = new Date(y, m, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (isWorkingDay(dateStr)) days.push(dateStr);
  }
  return days;
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ---------- settings ----------

function seedSettingsDefaults() {
  const existing = db.prepare('SELECT key FROM settings').all() as { key: string }[];
  const existingKeys = new Set(existing.map((r) => r.key));
  const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!existingKeys.has(key)) insert.run(key, JSON.stringify(value));
  }
}

export function getSettings(): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const result = { ...DEFAULT_SETTINGS } as any;
  for (const row of rows) {
    result[row.key] = JSON.parse(row.value);
  }
  return result as Settings;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  if (patch.overlayOpacity !== undefined) {
    patch = { ...patch, overlayOpacity: clampOverlayOpacity(patch.overlayOpacity) };
  }
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  for (const [key, value] of Object.entries(patch)) {
    upsert.run(key, JSON.stringify(value));
  }
  return getSettings();
}

// ---------- projects ----------

function rowToProject(row: any): Project {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    color: row.color,
    description: row.description,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProjects(includeInactive = true): Project[] {
  const rows = includeInactive
    ? db.prepare('SELECT * FROM projects ORDER BY is_active DESC, code ASC').all()
    : db.prepare('SELECT * FROM projects WHERE is_active = 1 ORDER BY code ASC').all();
  return (rows as any[]).map(rowToProject);
}

export function getProject(id: number): Project | null {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  return row ? rowToProject(row) : null;
}

function nextColor(): string {
  const count = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as any).c as number;
  return DEFAULT_COLORS[count % DEFAULT_COLORS.length];
}

export function createProject(input: {
  code: string;
  name: string;
  color?: string;
  description?: string;
}): Project {
  const ts = now();
  const color = input.color || nextColor();
  const result = db
    .prepare(
      'INSERT INTO projects (code, name, color, description, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
    )
    .run(input.code.trim(), input.name.trim(), color, input.description ?? null, ts, ts);
  return getProject(result.lastInsertRowid as number)!;
}

export function updateProject(
  id: number,
  patch: Partial<Pick<Project, 'code' | 'name' | 'color' | 'description' | 'isActive'>>
): Project {
  const current = getProject(id);
  if (!current) throw new Error('Project not found');
  const merged = { ...current, ...patch };
  db.prepare(
    'UPDATE projects SET code = ?, name = ?, color = ?, description = ?, is_active = ?, updated_at = ? WHERE id = ?'
  ).run(merged.code, merged.name, merged.color, merged.description, merged.isActive ? 1 : 0, now(), id);
  return getProject(id)!;
}

export function setProjectActive(id: number, isActive: boolean): Project {
  db.prepare('UPDATE projects SET is_active = ?, updated_at = ? WHERE id = ?').run(isActive ? 1 : 0, now(), id);
  return getProject(id)!;
}

export function deleteProject(id: number): void {
  db.prepare('DELETE FROM notes WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM daily_project_time WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

// ---------- daily project time ----------

function rowToEntry(row: any): DailyEntry {
  return {
    id: row.id,
    date: row.date,
    projectId: row.project_id,
    durationMinutes: row.duration_minutes,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    project: rowToProject(row),
  };
}

const ENTRY_SELECT = `
  SELECT dpt.*, p.code as p_code, p.name as p_name, p.color as p_color,
         p.description as p_description, p.is_active as p_is_active,
         p.created_at as p_created_at, p.updated_at as p_updated_at
  FROM daily_project_time dpt
  JOIN projects p ON p.id = dpt.project_id
`;

function mapEntryRow(row: any): DailyEntry {
  return {
    id: row.id,
    date: row.date,
    projectId: row.project_id,
    durationMinutes: row.duration_minutes,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    project: {
      id: row.project_id,
      code: row.p_code,
      name: row.p_name,
      color: row.p_color,
      description: row.p_description,
      isActive: !!row.p_is_active,
      createdAt: row.p_created_at,
      updatedAt: row.p_updated_at,
    },
  };
}

export function getDailyEntries(date: string): DailyEntry[] {
  const rows = db.prepare(`${ENTRY_SELECT} WHERE dpt.date = ? ORDER BY dpt.duration_minutes DESC`).all(date);
  return (rows as any[]).map(mapEntryRow);
}

export function getDailyTotalMinutes(date: string): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM daily_project_time WHERE date = ?')
    .get(date) as any;
  return row.total as number;
}

export function setDailyEntry(date: string, projectId: number, durationMinutes: number, source: EntrySource): DailyEntry {
  const ts = now();
  const clamped = Math.max(0, durationMinutes);
  if (clamped === 0) {
    db.prepare('DELETE FROM daily_project_time WHERE date = ? AND project_id = ?').run(date, projectId);
    return { id: 0, date, projectId, durationMinutes: 0, source, createdAt: ts, updatedAt: ts, project: getProject(projectId)! };
  }
  db.prepare(
    `INSERT INTO daily_project_time (date, project_id, duration_minutes, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(date, project_id) DO UPDATE SET duration_minutes = excluded.duration_minutes, source = excluded.source, updated_at = excluded.updated_at`
  ).run(date, projectId, clamped, source, ts, ts);
  const row = db.prepare(`${ENTRY_SELECT} WHERE dpt.date = ? AND dpt.project_id = ?`).get(date, projectId);
  return mapEntryRow(row);
}

export function addTimeToProject(date: string, projectId: number, minutesDelta: number, source: EntrySource): DailyEntry {
  const existing = db
    .prepare('SELECT duration_minutes FROM daily_project_time WHERE date = ? AND project_id = ?')
    .get(date, projectId) as any;
  const current = existing ? existing.duration_minutes : 0;
  return setDailyEntry(date, projectId, current + minutesDelta, source);
}

export function deleteDailyEntry(date: string, projectId: number): void {
  db.prepare('DELETE FROM daily_project_time WHERE date = ? AND project_id = ?').run(date, projectId);
}

// ---------- notes ----------

export function listNotes(date: string, projectId?: number): Note[] {
  const rows = projectId
    ? db.prepare('SELECT * FROM notes WHERE date = ? AND project_id = ? ORDER BY created_at ASC').all(date, projectId)
    : db.prepare('SELECT * FROM notes WHERE date = ? ORDER BY created_at ASC').all(date);
  return rows as Note[];
}

export function addNote(date: string, projectId: number, text: string): Note {
  const ts = now();
  const result = db
    .prepare('INSERT INTO notes (date, project_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(date, projectId, text, ts, ts);
  return db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid) as Note;
}

export function updateNote(id: number, text: string): Note {
  db.prepare('UPDATE notes SET text = ?, updated_at = ? WHERE id = ?').run(text, now(), id);
  return db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note;
}

export function deleteNote(id: number): void {
  db.prepare('DELETE FROM notes WHERE id = ?').run(id);
}

export function listNotesForMonth(month: string): (Note & { project: Project })[] {
  const rows = db
    .prepare(
      `SELECT n.*, p.code as p_code, p.name as p_name, p.color as p_color, p.description as p_description,
              p.is_active as p_is_active, p.created_at as p_created_at, p.updated_at as p_updated_at
       FROM notes n JOIN projects p ON p.id = n.project_id
       WHERE n.date LIKE ? ORDER BY n.date ASC, n.created_at ASC`
    )
    .all(`${month}%`) as any[];
  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    projectId: row.project_id,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    project: {
      id: row.project_id,
      code: row.p_code,
      name: row.p_name,
      color: row.p_color,
      description: row.p_description,
      isActive: !!row.p_is_active,
      createdAt: row.p_created_at,
      updatedAt: row.p_updated_at,
    },
  }));
}

export function countNotesForMonth(month: string): Map<string, number> {
  const rows = db
    .prepare("SELECT date || ':' || project_id as k, COUNT(*) as c FROM notes WHERE date LIKE ? GROUP BY k")
    .all(`${month}%`) as any[];
  return new Map(rows.map((r) => [r.k, r.c]));
}

// ---------- targets ----------

export function getDailyTargetMinutes(date: string): number {
  const override = db.prepare('SELECT target_minutes FROM daily_targets WHERE date = ?').get(date) as any;
  if (override) return override.target_minutes;
  return getSettings().defaultDailyTargetMinutes;
}

export function setDailyTargetOverride(date: string, minutes: number | null): void {
  if (minutes === null) {
    db.prepare('DELETE FROM daily_targets WHERE date = ?').run(date);
    return;
  }
  const ts = now();
  db.prepare(
    `INSERT INTO daily_targets (date, target_minutes, created_at, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET target_minutes = excluded.target_minutes, updated_at = excluded.updated_at`
  ).run(date, minutes, ts, ts);
}

export function getMonthlyTargetMinutes(month: string): number {
  const override = db.prepare('SELECT target_minutes FROM monthly_target_overrides WHERE month = ?').get(month) as any;
  if (override) return override.target_minutes;
  const days = workingDaysInMonth(month);
  return days.reduce((sum, d) => sum + getDailyTargetMinutes(d), 0);
}

export function setMonthlyTargetOverride(month: string, minutes: number | null): void {
  if (minutes === null) {
    db.prepare('DELETE FROM monthly_target_overrides WHERE month = ?').run(month);
    return;
  }
  const ts = now();
  db.prepare(
    `INSERT INTO monthly_target_overrides (month, target_minutes, created_at, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(month) DO UPDATE SET target_minutes = excluded.target_minutes, updated_at = excluded.updated_at`
  ).run(month, minutes, ts, ts);
}

function dayStatus(tracked: number, target: number): 'under' | 'met' | 'over' {
  if (target <= 0) return tracked > 0 ? 'over' : 'met';
  if (tracked < target - 0.5) return 'under';
  if (tracked > target + 0.5) return 'over';
  return 'met';
}

export function getDailyTargetStatus(date: string) {
  const target = getDailyTargetMinutes(date);
  const tracked = getDailyTotalMinutes(date);
  return { date, targetMinutes: target, trackedMinutes: tracked, status: dayStatus(tracked, target) };
}

/** Splits an arbitrary (positive or negative) minute delta evenly across the given projects. */
export function applyTimeDelta(date: string, projectIds: number[], deltaMinutes: number): void {
  if (projectIds.length === 0 || deltaMinutes === 0) return;
  const share = deltaMinutes / projectIds.length;
  for (const projectId of projectIds) {
    addTimeToProject(date, projectId, share, 'manual');
  }
}

// ---------- monthly summary ----------

export function getMonthlySummary(month: string): MonthlySummary {
  const targetMinutes = getMonthlyTargetMinutes(month);
  const rows = db
    .prepare(
      `${ENTRY_SELECT} WHERE dpt.date LIKE ? ORDER BY dpt.date ASC`
    )
    .all(`${month}%`) as any[];
  const entries = rows.map(mapEntryRow);

  const actualMinutes = entries.reduce((s, e) => s + e.durationMinutes, 0);

  const byProjectMap = new Map<number, { project: Project; minutes: number }>();
  for (const e of entries) {
    const existing = byProjectMap.get(e.projectId);
    if (existing) existing.minutes += e.durationMinutes;
    else byProjectMap.set(e.projectId, { project: e.project, minutes: e.durationMinutes });
  }
  const byProject = [...byProjectMap.values()].sort((a, b) => b.minutes - a.minutes);

  // Project x day matrix for the report grid.
  const minutesByProjectDate = new Map<number, Record<string, number>>();
  for (const e of entries) {
    const row = minutesByProjectDate.get(e.projectId) ?? {};
    row[e.date] = (row[e.date] ?? 0) + e.durationMinutes;
    minutesByProjectDate.set(e.projectId, row);
  }
  const grid = byProject.map((bp) => ({
    project: bp.project,
    totalMinutes: bp.minutes,
    minutesByDate: minutesByProjectDate.get(bp.project.id) ?? {},
  }));

  const byDateMap = new Map<string, number>();
  const codesByDate = new Map<string, string[]>();
  for (const e of entries) {
    byDateMap.set(e.date, (byDateMap.get(e.date) ?? 0) + e.durationMinutes);
    codesByDate.set(e.date, [...(codesByDate.get(e.date) ?? []), e.project.code]);
  }
  const workingDays = workingDaysInMonth(month);
  const dailyTotals: MonthlyDailyTotal[] = workingDays.map((date) => {
    const minutes = byDateMap.get(date) ?? 0;
    const dTarget = getDailyTargetMinutes(date);
    return { date, minutes, targetMinutes: dTarget, status: dayStatus(minutes, dTarget), projectCodes: codesByDate.get(date) ?? [] };
  });

  const prev = prevMonth(month);
  const prevTarget = getMonthlyTargetMinutes(prev);
  const prevRow = db
    .prepare('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM daily_project_time WHERE date LIKE ?')
    .get(`${prev}%`) as any;
  const lastMonthActualMinutes = prevRow.total as number;

  const thisMonthOvertimeMinutes = actualMinutes - targetMinutes;
  const lastMonthOvertimeMinutes = lastMonthActualMinutes - prevTarget;

  // V1 has no session history, so switches are approximated as timer-sourced project/day rows.
  const projectSwitches = entries.filter((e) => e.source === 'timer').length;

  const nonZeroDays = dailyTotals.filter((d) => d.minutes > 0);
  const busiest = nonZeroDays.length ? nonZeroDays.reduce((a, b) => (b.minutes > a.minutes ? b : a)) : null;
  const quietest = nonZeroDays.length ? nonZeroDays.reduce((a, b) => (b.minutes < a.minutes ? b : a)) : null;
  const workedDaysCount = nonZeroDays.length || 1;

  return {
    month,
    targetMinutes,
    actualMinutes,
    thisMonthOvertimeMinutes,
    lastMonthOvertimeMinutes,
    lastMonthActualMinutes,
    byProject,
    grid,
    dailyTotals,
    insights: {
      mostWorkedProject: byProject[0]?.project ?? null,
      busiestDay: busiest?.date ?? null,
      quietestDay: quietest?.date ?? null,
      projectSwitches,
      totalMinutes: actualMinutes,
      averageMinutesPerWorkingDay: actualMinutes / workedDaysCount,
    },
  };
}

export { workingDaysInMonth, prevMonth };
