import { useCallback, useEffect, useState } from 'react';
import { formatDateShort, minutesToHoursLabel } from '@/lib/format';
import { TextInput } from './ui/Inputs';
import { Button, IconButton } from './ui/Button';
import { CalendarIcon, PlusIcon, TrashIcon } from './icons';
import { useToast } from './ui/Toast';

// Booking a holiday fills that day at its full daily target under the HOLIDAY project.
export function HolidayCard({ month, onChanged }: { month: string; onChanged: () => void }) {
  const [holidays, setHolidays] = useState<{ date: string; minutes: number }[]>([]);
  const toast = useToast();

  const monthStart = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const monthEnd = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  const [pick, setPick] = useState(monthStart);

  const load = useCallback(() => {
    window.api.holidays.list(month).then(setHolidays);
  }, [month]);

  useEffect(() => {
    load();
    setPick(monthStart);
  }, [load, monthStart]);

  const totalMinutes = holidays.reduce((s, h) => s + h.minutes, 0);
  const alreadyBooked = holidays.some((h) => h.date === pick);

  const add = async () => {
    if (!pick || alreadyBooked) return;
    await window.api.holidays.add(pick);
    toast('Holiday added');
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

      <div className="mb-4 flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Add a holiday day</label>
          <TextInput type="date" value={pick} min={monthStart} max={monthEnd} onChange={(e) => setPick(e.target.value)} />
        </div>
        <Button variant="primary" icon={<PlusIcon />} onClick={add} disabled={!pick || alreadyBooked}>
          {alreadyBooked ? 'Booked' : 'Add'}
        </Button>
      </div>

      {holidays.length === 0 ? (
        <p className="text-sm text-slate-400">No holidays booked this month. They're auto-filled to your daily target under HOLIDAY.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
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
  );
}
