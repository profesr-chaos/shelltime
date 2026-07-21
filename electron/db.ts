import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { isPublicHoliday } from './holidays.ts';
import type {
  Project,
  DailyEntry,
  Note,
  Settings,
  EntrySource,
  MonthlySummary,
  MonthlyDailyTotal,
  LeaveType,
  LeaveRecord,
  LeaveSummary,
  Session,
} from '../shared/types';
import { OVERLAY_OPACITY_FLOOR } from '../shared/types.ts';

let db: Database.Database;

const DEFAULT_COLORS = ['#F5941E', '#3B82F6', '#10B981', '#EC4899', '#8B5CF6', '#EF4444'];

const DEFAULT_SETTINGS: Settings = {
  defaultDailyTargetMinutes: 480,
  breakIntervalMinutes: 60,
  idlePromptMinutes: 10,
  idleResumeMode: 'auto',
  grindMode: false,
  overlayAlwaysOnTop: true,
  overlayCompact: false,
  overlayPosition: null,
  overlayOpacity: 1,
  overlayDark: false,
  startWithWindows: false,
  workingDays: [1, 2, 3, 4, 5],
  skipBankHolidays: true,
  holidayRegion: 'GB-ENG',
  hasCompletedSetup: false,
  exportPrefix: 'Shelltime',
  userName: 'Shelltime',
  calendarIcsUrl: '',
  meetingSwitchSuggestMinutes: 30,
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

    CREATE TABLE IF NOT EXISTS leave_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      half INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS day_meta (
      date TEXT PRIMARY KEY,
      first_started_at TEXT NOT NULL
    );

    -- Informational record of when work happened. daily_project_time remains the source of truth
    -- for totals; sessions are never used to derive them.
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
  `);

  runMigrations();
  seedSettingsDefaults();
}

// Bump SCHEMA_VERSION and append a migration when the schema changes; each migration[i] upgrades vN(i) -> v(i+1).
const SCHEMA_VERSION = 7;
function runMigrations() {
  const current = db.pragma('user_version', { simple: true }) as number;
  const migrations: (() => void)[] = [
    // migrations[0]: v0 -> v1 (baseline — tables already created above, nothing to do)
    () => {},
    // migrations[1]: v1 -> v2 — drop the retired monthlyTargetMode setting
    () => db.prepare("DELETE FROM settings WHERE key = 'monthlyTargetMode'").run(),
    // migrations[2]: v2 -> v3 — remove old-model HOLIDAY/SICK day entries that no leave_record backs,
    // so orphaned holidays stop inflating tracked time / the progress snail.
    () => {
      const projs = db.prepare("SELECT id, code FROM projects WHERE code IN ('HOLIDAY','SICK')").all() as { id: number; code: string }[];
      if (!projs.length) return;
      const records = db.prepare('SELECT type, start_date, end_date FROM leave_records').all() as any[];
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const covered: Record<string, Set<string>> = { HOLIDAY: new Set(), SICK: new Set() };
      for (const r of records) {
        const code = r.type === 'sick' ? 'SICK' : 'HOLIDAY';
        const cur = new Date(r.start_date + 'T00:00:00');
        const end = new Date(r.end_date + 'T00:00:00');
        while (cur <= end) {
          covered[code].add(iso(cur));
          cur.setDate(cur.getDate() + 1);
        }
      }
      const del = db.prepare('DELETE FROM daily_project_time WHERE project_id = ? AND date = ?');
      for (const p of projs) {
        const rows = db.prepare('SELECT date FROM daily_project_time WHERE project_id = ?').all(p.id) as { date: string }[];
        for (const row of rows) if (!covered[p.code].has(row.date)) del.run(p.id, row.date);
      }
    },
    // migrations[3]: v3 -> v4 — existing users (who already have projects) shouldn't see first-run
    // onboarding, so mark setup complete for them; genuinely fresh installs keep the default (false).
    () => {
      const hasData = (db.prepare('SELECT COUNT(*) AS c FROM projects').get() as { c: number }).c > 0;
      if (hasData) {
        db.prepare("INSERT INTO settings (key, value) VALUES ('hasCompletedSetup', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'").run();
      }
    },
    // migrations[4]: v4 -> v5 — rename autoPauseIdleMinutes to idlePromptMinutes (the setting no
    // longer auto-pauses; it opens the idle prompt, so the old name no longer matched behavior).
    () => {
      const row = db.prepare("SELECT value FROM settings WHERE key = 'autoPauseIdleMinutes'").get() as { value: string } | undefined;
      if (row) {
        db.prepare("INSERT INTO settings (key, value) VALUES ('idlePromptMinutes', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(row.value);
        db.prepare("DELETE FROM settings WHERE key = 'autoPauseIdleMinutes'").run();
      }
    },
    // migrations[5]: v5 -> v6 — sessions table added above via CREATE TABLE IF NOT EXISTS; nothing
    // to migrate, this entry just keeps the version counter in sync.
    () => {},
    // migrations[6]: v6 -> v7 — project categories (free-text grouping, e.g. customer)
    () => db.exec('ALTER TABLE projects ADD COLUMN category TEXT'),
  ];
  for (let v = current; v < SCHEMA_VERSION; v++) migrations[v]?.();
  if (current < SCHEMA_VERSION) db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

function now() {
  return new Date().toISOString();
}

export function isWorkingDay(dateStr: string): boolean {
  const day = new Date(dateStr + 'T00:00:00').getDay();
  const settings = getSettings();
  if (!settings.workingDays.includes(day)) return false;
  if (settings.skipBankHolidays && isPublicHoliday(dateStr, settings.holidayRegion)) return false;
  return true;
}

function workingDaysInMonth(month: string): string[] {
  return allDaysInMonth(month).filter(isWorkingDay);
}

function allDaysInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const days: string[] = [];
  const daysInMonth = new Date(y, m, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
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

// "Finished for today" marker (YYYY-MM-DD). Lives in the settings kv table but isn't part of the
// Settings shape — it's timer state that must survive an app restart over a weekend.
export function getFinishedOn(): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'finishedOn'").get() as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as string | null) : null;
}

export function setFinishedOn(date: string | null): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('finishedOn', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(JSON.stringify(date));
}

// Last app version whose change notes the user has seen. kv-only, not part of Settings.
export function getLastSeenVersion(): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'lastSeenVersion'").get() as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as string | null) : null;
}

export function setLastSeenVersion(version: string): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('lastSeenVersion', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(JSON.stringify(version));
}

// ---------- projects ----------

function rowToProject(row: any): Project {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    color: row.color,
    description: row.description,
    category: row.category ?? null,
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
  category?: string;
}): Project {
  const ts = now();
  const color = input.color || nextColor();
  const result = db
    .prepare(
      'INSERT INTO projects (code, name, color, description, category, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
    )
    .run(input.code.trim(), input.name.trim(), color, input.description ?? null, input.category?.trim() || null, ts, ts);
  return getProject(result.lastInsertRowid as number)!;
}

export function updateProject(
  id: number,
  patch: Partial<Pick<Project, 'code' | 'name' | 'color' | 'description' | 'category' | 'isActive'>>
): Project {
  const current = getProject(id);
  if (!current) throw new Error('Project not found');
  const merged = { ...current, ...patch };
  db.prepare(
    'UPDATE projects SET code = ?, name = ?, color = ?, description = ?, category = ?, is_active = ?, updated_at = ? WHERE id = ?'
  ).run(merged.code, merged.name, merged.color, merged.description, merged.category?.trim() || null, merged.isActive ? 1 : 0, now(), id);
  return getProject(id)!;
}

// Projects with tracked time in the last `workingDays` working days (including today) — powers the
// "recent" shortlist in the quick-switch menu.
export function listRecentProjectIds(workingDays = 7): number[] {
  const cursor = new Date();
  let counted = 0;
  let cutoff = '';
  // Bounded walk-back: 4x window covers weekends/bank holidays without risking a long loop.
  for (let i = 0; counted < workingDays && i < workingDays * 4; i++) {
    const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (isWorkingDay(ds)) {
      counted++;
      cutoff = ds;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  const rows = db
    .prepare('SELECT DISTINCT project_id FROM daily_project_time WHERE date >= ? AND duration_minutes > 0')
    .all(cutoff) as { project_id: number }[];
  return rows.map((r) => r.project_id);
}

export function setProjectActive(id: number, isActive: boolean): Project {
  db.prepare('UPDATE projects SET is_active = ?, updated_at = ? WHERE id = ?').run(isActive ? 1 : 0, now(), id);
  return getProject(id)!;
}

export function deleteProject(id: number): void {
  db.prepare('DELETE FROM notes WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM daily_project_time WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM sessions WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

// ---------- leave (holiday / sick) ----------
// A leave range books each working day it covers at the daily target (or half) under a dedicated
// inactive project (HOLIDAY or SICK), so paid leave counts toward the monthly target. The range is
// also stored in leave_records so it can be listed and removed as a whole.
const LEAVE_PROJECT: Record<LeaveType, { code: string; name: string; color: string }> = {
  holiday: { code: 'HOLIDAY', name: 'Holiday', color: '#0EA5E9' },
  sick: { code: 'SICK', name: 'Sick leave', color: '#F43F5E' },
};

function getProjectByCode(code: string): Project | null {
  const row = db.prepare('SELECT * FROM projects WHERE code = ?').get(code);
  return row ? rowToProject(row) : null;
}

function ensureLeaveProject(type: LeaveType): Project {
  const def = LEAVE_PROJECT[type];
  const existing = getProjectByCode(def.code);
  if (existing) return existing;
  const created = createProject({ code: def.code, name: def.name, color: def.color });
  return setProjectActive(created.id, false); // keep it out of timing lists
}

// Working days (skipping weekends and public holidays) in [from, to] inclusive.
function workingDaysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (cursor <= end) {
    const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (isWorkingDay(ds)) days.push(ds);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function rowToLeave(r: any): LeaveRecord {
  const days = workingDaysBetween(r.start_date, r.end_date).length * (r.half ? 0.5 : 1);
  return { id: r.id, type: r.type, startDate: r.start_date, endDate: r.end_date, half: !!r.half, days };
}

export function addLeave(type: LeaveType, startDate: string, endDate: string, half: boolean): LeaveRecord {
  const [from, to] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
  const project = ensureLeaveProject(type);
  const fraction = half ? 0.5 : 1;
  for (const date of workingDaysBetween(from, to)) {
    setDailyEntry(date, project.id, getDailyTargetMinutes(date) * fraction, 'manual');
  }
  const res = db
    .prepare('INSERT INTO leave_records (type, start_date, end_date, half, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(type, from, to, half ? 1 : 0, now());
  return rowToLeave(db.prepare('SELECT * FROM leave_records WHERE id = ?').get(res.lastInsertRowid));
}

export function deleteLeave(id: number): void {
  const r = db.prepare('SELECT * FROM leave_records WHERE id = ?').get(id) as any;
  if (!r) return;
  const project = getProjectByCode(LEAVE_PROJECT[r.type as LeaveType].code);
  if (project) for (const date of workingDaysBetween(r.start_date, r.end_date)) deleteDailyEntry(date, project.id);
  db.prepare('DELETE FROM leave_records WHERE id = ?').run(id);
}

export function listLeave(): LeaveRecord[] {
  const rows = db.prepare('SELECT * FROM leave_records ORDER BY start_date DESC').all() as any[];
  return rows.map(rowToLeave);
}

// Days per type within `month`, plus the set of leave dates in the month (for the calendar).
export function getLeaveSummary(month: string): LeaveSummary {
  const [y, m] = month.split('-').map(Number);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  const rows = db
    .prepare('SELECT * FROM leave_records WHERE start_date <= ? AND end_date >= ?')
    .all(monthEnd, monthStart) as any[];
  const counts = { holiday: 0, sick: 0 };
  const dates = new Set<string>();
  for (const r of rows) {
    const from = r.start_date > monthStart ? r.start_date : monthStart;
    const to = r.end_date < monthEnd ? r.end_date : monthEnd;
    const wd = workingDaysBetween(from, to);
    for (const d of wd) dates.add(d);
    counts[r.type as LeaveType] += wd.length * (r.half ? 0.5 : 1);
  }
  return { holiday: counts.holiday, sick: counts.sick, dates: [...dates] };
}

// ---------- data export ----------

export function backupDatabase(dest: string): Promise<void> {
  return db.backup(dest).then(() => undefined);
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
         p.description as p_description, p.category as p_category, p.is_active as p_is_active,
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
      category: row.p_category ?? null,
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

// ---------- day metadata (first timer start of the day, for the progress bar's start/end labels) ----------

export function getDayFirstStartedAt(date: string): string | null {
  const row = db.prepare('SELECT first_started_at FROM day_meta WHERE date = ?').get(date) as { first_started_at: string } | undefined;
  return row?.first_started_at ?? null;
}

/** Called from TimerEngine.start/switchProject — a no-op once today's first start is already recorded. */
export function recordDayFirstStartIfNeeded(date: string): void {
  db.prepare('INSERT OR IGNORE INTO day_meta (date, first_started_at) VALUES (?, ?)').run(date, now());
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

function mapNoteRow(row: any): Note {
  return { id: row.id, date: row.date, projectId: row.project_id, text: row.text, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function listNotes(date: string, projectId?: number): Note[] {
  const rows = projectId
    ? db.prepare('SELECT * FROM notes WHERE date = ? AND project_id = ? ORDER BY created_at ASC').all(date, projectId)
    : db.prepare('SELECT * FROM notes WHERE date = ? ORDER BY created_at ASC').all(date);
  return (rows as any[]).map(mapNoteRow);
}

export function addNote(date: string, projectId: number, text: string): Note {
  const ts = now();
  const result = db
    .prepare('INSERT INTO notes (date, project_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(date, projectId, text, ts, ts);
  return mapNoteRow(db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid));
}

export function updateNote(id: number, text: string): Note {
  db.prepare('UPDATE notes SET text = ?, updated_at = ? WHERE id = ?').run(text, now(), id);
  return mapNoteRow(db.prepare('SELECT * FROM notes WHERE id = ?').get(id));
}

export function deleteNote(id: number): void {
  db.prepare('DELETE FROM notes WHERE id = ?').run(id);
}

export function getProjectHistory(projectId: number): { entries: { date: string; minutes: number }[]; notes: Note[] } {
  const entries = db
    .prepare('SELECT date, duration_minutes as minutes FROM daily_project_time WHERE project_id = ? AND duration_minutes > 0 ORDER BY date DESC')
    .all(projectId) as { date: string; minutes: number }[];
  const notes = (db.prepare('SELECT * FROM notes WHERE project_id = ? ORDER BY date DESC, created_at ASC').all(projectId) as any[]).map(mapNoteRow);
  return { entries, notes };
}

export function listNotesForMonth(month: string): (Note & { project: Project })[] {
  const rows = db
    .prepare(
      `SELECT n.*, p.code as p_code, p.name as p_name, p.color as p_color, p.description as p_description,
              p.category as p_category, p.is_active as p_is_active, p.created_at as p_created_at, p.updated_at as p_updated_at
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
      category: row.p_category ?? null,
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
  // dailyTotals spans the whole month (so weekends/off days render in the chart), but each day
  // carries isWorkingDay so downstream insights/averages can restrict back to working days.
  const dailyTotals: MonthlyDailyTotal[] = allDaysInMonth(month).map((date) => {
    const minutes = byDateMap.get(date) ?? 0;
    const working = isWorkingDay(date);
    const dTarget = working ? getDailyTargetMinutes(date) : 0;
    return { date, minutes, targetMinutes: dTarget, status: dayStatus(minutes, dTarget), projectCodes: codesByDate.get(date) ?? [], isWorkingDay: working };
  });

  const prev = prevMonth(month);
  const prevTarget = getMonthlyTargetMinutes(prev);
  const prevRow = db
    .prepare('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM daily_project_time WHERE date LIKE ?')
    .get(`${prev}%`) as any;
  const lastMonthActualMinutes = prevRow.total as number;

  const thisMonthOvertimeMinutes = actualMinutes - targetMinutes;
  const lastMonthOvertimeMinutes = lastMonthActualMinutes - prevTarget;

  // Overtime carries forward: sum (worked - target) over every prior month that has tracked time,
  // so being under target this month is offset by banked overtime from earlier months.
  const priorMonths = db
    .prepare(`SELECT substr(date,1,7) as m, COALESCE(SUM(duration_minutes),0) as total
              FROM daily_project_time WHERE substr(date,1,7) < ? GROUP BY m`)
    .all(month) as { m: string; total: number }[];
  const carriedOverOvertimeMinutes = priorMonths.reduce((s, r) => s + (r.total - getMonthlyTargetMinutes(r.m)), 0);
  const cumulativeOvertimeMinutes = carriedOverOvertimeMinutes + thisMonthOvertimeMinutes;

  // V1 has no session history, so switches are approximated as timer-sourced project/day rows.
  const projectSwitches = entries.filter((e) => e.source === 'timer').length;

  // Busiest/quietest/average stay working-day-only — a weekend with tracked time is visible in the
  // chart (item 11) but shouldn't skew these figures.
  const workingDayTotals = dailyTotals.filter((d) => d.isWorkingDay);
  const nonZeroDays = workingDayTotals.filter((d) => d.minutes > 0);
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
    carriedOverOvertimeMinutes,
    cumulativeOvertimeMinutes,
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

// ---------- sessions (informational — see table comment; never used to derive totals) ----------

function rowToSession(row: any): Session {
  return {
    id: row.id,
    date: row.date,
    projectId: row.project_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    project: {
      id: row.project_id,
      code: row.p_code,
      name: row.p_name,
      color: row.p_color,
      description: row.p_description,
      category: row.p_category ?? null,
      isActive: !!row.p_is_active,
      createdAt: row.p_created_at,
      updatedAt: row.p_updated_at,
    },
  };
}

const SESSION_SELECT = `
  SELECT s.*, p.code as p_code, p.name as p_name, p.color as p_color, p.description as p_description,
         p.category as p_category, p.is_active as p_is_active, p.created_at as p_created_at, p.updated_at as p_updated_at
  FROM sessions s JOIN projects p ON p.id = s.project_id
`;

export function listSessionsForDate(date: string): Session[] {
  const rows = db.prepare(`${SESSION_SELECT} WHERE s.date = ? ORDER BY s.started_at ASC`).all(date);
  return (rows as any[]).map(rowToSession);
}

export function getSessionById(id: number): Session | null {
  const row = db.prepare(`${SESSION_SELECT} WHERE s.id = ?`).get(id);
  return row ? rowToSession(row) : null;
}

/** Most recent project start/switch today — used to suppress the meeting-switch suggestion if the
 * user already switched recently. */
export function getLastSessionStart(date: string): string | null {
  const row = db.prepare('SELECT MAX(started_at) as m FROM sessions WHERE date = ?').get(date) as { m: string | null };
  return row.m;
}

export function insertSession(date: string, projectId: number, startedAt: string, endedAt: string): number {
  const result = db
    .prepare('INSERT INTO sessions (date, project_id, started_at, ended_at) VALUES (?, ?, ?, ?)')
    .run(date, projectId, startedAt, endedAt);
  return result.lastInsertRowid as number;
}

export function touchSessionEnd(id: number, endedAt: string): void {
  db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(endedAt, id);
}

// Idle discard: trim `seconds` off the tail of the project's sessions for `date`, newest first,
// deleting rows that shrink to <= 0. ponytail: tail-trim approximates where the idle actually was
// — it's the right answer in practice because idle windows end at the moment of discard.
// `excludeSessionId` skips the currently-open session (if any) — it's the freshest row and would
// otherwise be trimmed/deleted first, corrupting the timeline for work that's still in progress.
export function trimSessionSeconds(date: string, projectId: number, seconds: number, excludeSessionId?: number | null): void {
  let remaining = seconds;
  const rows = db
    .prepare('SELECT id, started_at, ended_at FROM sessions WHERE date = ? AND project_id = ? ORDER BY id DESC')
    .all(date, projectId) as { id: number; started_at: string; ended_at: string }[];
  const del = db.prepare('DELETE FROM sessions WHERE id = ?');
  const shrink = db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?');
  for (const row of rows) {
    if (remaining <= 0) break;
    if (row.id === excludeSessionId) continue;
    const durationSec = (new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) / 1000;
    if (durationSec <= remaining) {
      del.run(row.id);
      remaining -= durationSec;
    } else {
      shrink.run(new Date(new Date(row.ended_at).getTime() - remaining * 1000).toISOString(), row.id);
      remaining = 0;
    }
  }
}

// Move the [start, end] slice of a session to another project, splitting the session if the slice
// is interior, and move the corresponding minutes in daily_project_time from the old project to
// the new one. Wrapped in a transaction so the split and the total move are atomic. Returns false
// when nothing changed (missing session, or the slice clamps to empty) so the UI can say so
// instead of reporting success.
export function reallocateSessionSlice(sessionId: number, startIso: string, endIso: string, toProjectId: number): boolean {
  const txn = db.transaction((): boolean => {
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    if (!row) return false;
    const sessionStart = row.started_at as string;
    const sessionEnd = row.ended_at as string;
    const clampedStart = startIso < sessionStart ? sessionStart : startIso;
    const clampedEnd = endIso > sessionEnd ? sessionEnd : endIso;
    if (clampedStart >= clampedEnd) return false;

    const date = row.date as string;
    const fromProjectId = row.project_id as number;

    const insert = db.prepare('INSERT INTO sessions (date, project_id, started_at, ended_at) VALUES (?, ?, ?, ?)');
    const updateProject = db.prepare('UPDATE sessions SET project_id = ? WHERE id = ?');
    const updateEnd = db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?');

    if (clampedStart === sessionStart && clampedEnd === sessionEnd) {
      // whole session retagged
      updateProject.run(toProjectId, sessionId);
    } else if (clampedStart === sessionStart) {
      // prefix slice: retag the front, leave the remainder on the old project
      updateEnd.run(clampedEnd, sessionId);
      updateProject.run(toProjectId, sessionId);
      insert.run(date, fromProjectId, clampedEnd, sessionEnd);
    } else if (clampedEnd === sessionEnd) {
      // suffix slice: shrink to what's left, append the slice on the new project
      updateEnd.run(clampedStart, sessionId);
      insert.run(date, toProjectId, clampedStart, sessionEnd);
    } else {
      // interior slice: three-way split
      updateEnd.run(clampedStart, sessionId);
      insert.run(date, toProjectId, clampedStart, clampedEnd);
      insert.run(date, fromProjectId, clampedEnd, sessionEnd);
    }

    const mins = (new Date(clampedEnd).getTime() - new Date(clampedStart).getTime()) / 60000;
    addTimeToProject(date, fromProjectId, -mins, 'manual');
    addTimeToProject(date, toProjectId, mins, 'manual');
    return true;
  });
  return txn();
}

export { workingDaysInMonth, prevMonth };
