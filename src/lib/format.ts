export function minutesToHhMm(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.round(Math.abs(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h ${m}m`;
}

export function secondsToHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return [hh, mm, ss].map((n) => String(n).padStart(2, '0')).join(':');
}

export function minutesToHoursLabel(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

export function signedHoursLabel(minutes: number): string {
  const hours = minutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  if (rounded > 0) return `+${rounded.toFixed(1)}h`;
  if (rounded < 0) return `${rounded.toFixed(1)}h`;
  return '0h';
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
