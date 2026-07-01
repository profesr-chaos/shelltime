import { useCallback, useEffect, useState } from 'react';
import { formatDateShort, minutesToHoursLabel } from '@/lib/format';
import { Calendar } from './ui/Calendar';
import { IconButton } from './ui/Button';
import { CalendarIcon, TrashIcon } from './icons';
import { useToast } from './ui/Toast';

// Booking a holiday fills each working day at its full daily target under the HOLIDAY project.
export function HolidayCard({ month, onChanged }: { month: string; onChanged: () => void }) {
  const [holidays, setHolidays] = useState<{ date: string; minutes: number }[]>([]);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [hoverEnd, setHoverEnd] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(() => {
    window.api.holidays.list(month).then(setHolidays);
  }, [month]);

  useEffect(() => {
    load();
    setRangeStart(null); // reset an in-progress selection when the month changes
    setHoverEnd(null);
  }, [load]);

  const totalMinutes = holidays.reduce((s, h) => s + h.minutes, 0);
  const marked = new Set(holidays.map((h) => h.date));

  const handleDayClick = async (date: string) => {
    if (!rangeStart) {
      setRangeStart(date);
      setHoverEnd(date);
      return;
    }
    const booked = await window.api.holidays.addRange(rangeStart, date);
    setRangeStart(null);
    setHoverEnd(null);
    toast(booked.length ? `${booked.length} holiday day${booked.length === 1 ? '' : 's'} added` : 'No working days in that range');
    load();
    onChanged();
  };

  const remove = async (date: string) => {
    await window.api.holidays.remove(date);
    load();
    onChanged();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-sky-500" width={18} height={18} />
          <h2 className="text-base font-bold text-slate-900">Holiday</h2>
        </div>
        <span className="text-sm text-slate-400">
          {holidays.length} {holidays.length === 1 ? 'day' : 'days'} · {minutesToHoursLabel(totalMinutes)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <Calendar
            month={month}
            rangeStart={rangeStart}
            rangeEnd={rangeStart ? hoverEnd : null}
            marked={marked}
            onDayClick={handleDayClick}
            onDayHover={(d) => rangeStart && setHoverEnd(d ?? rangeStart)}
          />
          <p className="mt-3 text-xs text-slate-400">
            {rangeStart
              ? 'Now click the end day (or the same day for a single day).'
              : 'Click a start day, then an end day. Weekends and public holidays are skipped.'}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Booked this month</p>
          {holidays.length === 0 ? (
            <p className="text-sm text-slate-400">No holidays booked. They're auto-filled to your daily target under HOLIDAY.</p>
          ) : (
            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {holidays.map((h) => (
                <div key={h.date} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">{formatDateShort(h.date)}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-slate-500">{minutesToHoursLabel(h.minutes)}</span>
                    <IconButton label="Remove holiday" onClick={() => remove(h.date)} className="h-7 w-7">
                      <TrashIcon width={14} height={14} />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
