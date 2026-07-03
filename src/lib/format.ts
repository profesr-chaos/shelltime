// h:mm — the one duration format used everywhere in the UI. Minutes are never dropped to a
// decimal-hour fraction (no "0.9h"); hours don't wrap at 24 (a month can read "168:30").
export function minutesToHhMm(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.round(Math.abs(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${String(m).padStart(2, '0')}`;
}

// Signed h:mm for deltas: +0:45 / -1:05 / 0:00.
export function signedMinutesToHhMm(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  if (rounded === 0) return '0:00';
  const sign = rounded > 0 ? '+' : '-';
  const abs = Math.abs(rounded);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${String(m).padStart(2, '0')}`;
}

// Clock time (24h, HH:mm) — for "when did work start/end", distinct from the h:mm duration format above.
export function formatClockTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function secondsToHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return [hh, mm, ss].map((n) => String(n).padStart(2, '0')).join(':');
}


export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function formatMonthDay(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { month: 'long', day: 'numeric' });
}

export function formatDateShort(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function workdayNumberOfYear(date: string): number {
  const d = new Date(date + 'T00:00:00');
  let count = 0;
  const cursor = new Date(d.getFullYear(), 0, 1);
  while (cursor <= d) {
    const day = cursor.getDay();
    if (day >= 1 && day <= 5) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}
