import { useCallback, useEffect, useState } from 'react';
import { Modal } from './ui/Modal';
import { Button, IconButton } from './ui/Button';
import { Calendar } from './ui/Calendar';
import { TrashIcon } from './icons';
import { formatMonth, formatDateShort, minutesToHoursLabel } from '@/lib/format';
import { useToast } from './ui/Toast';

type Holiday = { date: string; minutes: number; targetMinutes: number };
const isHalf = (h: Holiday) => h.targetMinutes > 0 && h.minutes < h.targetMinutes * 0.75;

export function HolidayModal({ month, onClose, onChanged }: { month: string; onClose: () => void; onChanged: () => void }) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [hoverEnd, setHoverEnd] = useState<string | null>(null);
  const [half, setHalf] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    window.api.holidays.list(month).then(setHolidays);
  }, [month]);
  useEffect(() => load(), [load]);

  const marked = new Set(holidays.map((h) => h.date));

  const handleDayClick = async (date: string) => {
    if (!rangeStart) {
      setRangeStart(date);
      setHoverEnd(date);
      return;
    }
    const booked = await window.api.holidays.addRange(rangeStart, date, half);
    setRangeStart(null);
    setHoverEnd(null);
    toast(booked.length ? `${booked.length} ${half ? 'half-' : ''}day${booked.length === 1 ? '' : 's'} added` : 'No working days in that range');
    load();
    onChanged();
  };

  const remove = async (date: string) => {
    await window.api.holidays.remove(date);
    load();
    onChanged();
  };

  return (
    <Modal title="Holidays" subtitle={formatMonth(month)} onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      <Calendar
        month={month}
        rangeStart={rangeStart}
        rangeEnd={rangeStart ? hoverEnd : null}
        marked={marked}
        onDayClick={handleDayClick}
        onDayHover={(d) => rangeStart && setHoverEnd(d ?? rangeStart)}
      />

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={half} onChange={(e) => setHalf(e.target.checked)} className="h-4 w-4 accent-amber-500" />
        Half day (books ½ your daily target)
      </label>
      <p className="mt-1 text-xs text-slate-400">
        {rangeStart
          ? 'Now click the end day (or the same day for a single day).'
          : 'Click a start day, then an end day. Weekends and public holidays are skipped.'}
      </p>

      {holidays.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Booked this month</p>
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            {holidays.map((h) => (
              <div key={h.date} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                <span className="text-sm font-medium text-slate-700">
                  {formatDateShort(h.date)}
                  {isHalf(h) && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">½ day</span>}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-slate-500">{minutesToHoursLabel(h.minutes)}</span>
                  <IconButton label="Remove holiday" onClick={() => remove(h.date)} className="h-7 w-7">
                    <TrashIcon width={14} height={14} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
