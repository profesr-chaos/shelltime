import { useCallback, useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { CalendarIcon, PlusIcon } from './icons';
import { HolidayModal } from './HolidayModal';

type Holiday = { date: string; minutes: number; targetMinutes: number };
// Full day = 1, half day = 0.5; rounded to the nearest half so it's robust to target changes.
const dayValue = (h: Holiday) => (h.targetMinutes > 0 ? Math.round((h.minutes / h.targetMinutes) * 2) / 2 : 1);
const formatDays = (d: number) => (d % 1 === 0 ? String(d) : d.toFixed(1));

export function HolidayCard({ month, onChanged }: { month: string; onChanged: () => void }) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    window.api.holidays.list(month).then(setHolidays);
  }, [month]);
  useEffect(() => load(), [load]);

  const totalDays = holidays.reduce((s, h) => s + dayValue(h), 0);

  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-500">
          <CalendarIcon width={22} height={22} />
        </span>
        <div>
          <p className="text-2xl font-bold text-slate-900">
            {formatDays(totalDays)} <span className="text-base font-medium text-slate-400">{totalDays === 1 ? 'day' : 'days'} this month</span>
          </p>
          <p className="text-sm text-slate-500">Holiday taken</p>
        </div>
      </div>
      <Button variant="primary" icon={<PlusIcon />} onClick={() => setOpen(true)}>Add holiday</Button>

      {open && (
        <HolidayModal
          month={month}
          onClose={() => setOpen(false)}
          onChanged={() => {
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}
