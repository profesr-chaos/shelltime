import { useCallback, useEffect, useState } from 'react';
import type { LeaveSummary } from '@shared/types';
import { Button } from './ui/Button';
import { CalendarIcon, PlusIcon, ListIcon } from './icons';
import { AddLeaveModal } from './AddLeaveModal';
import { LeaveListModal } from './LeaveListModal';

const formatDays = (d: number) => (d % 1 === 0 ? String(d) : d.toFixed(1));

export function LeaveCard({ month, onChanged }: { month: string; onChanged: () => void }) {
  const [summary, setSummary] = useState<LeaveSummary>({ holiday: 0, sick: 0, dates: [] });
  const [addOpen, setAddOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const load = useCallback(() => {
    window.api.leave.summary(month).then(setSummary);
  }, [month]);
  useEffect(() => load(), [load]);

  const refresh = () => {
    load();
    onChanged();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <CalendarIcon className="text-sky-500" width={18} height={18} />
        <h2 className="text-base font-bold text-slate-900">Leave this month</h2>
      </div>

      <div className="flex items-end justify-between">
        <div className="flex gap-10">
          <Counter label="Holiday" value={summary.holiday} />
          <Counter label="Sick" value={summary.sick} />
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" icon={<ListIcon />} onClick={() => setListOpen(true)}>List</Button>
          <Button variant="primary" icon={<PlusIcon />} onClick={() => setAddOpen(true)}>Add</Button>
        </div>
      </div>

      {addOpen && <AddLeaveModal month={month} onClose={() => setAddOpen(false)} onChanged={refresh} />}
      {listOpen && <LeaveListModal onClose={() => setListOpen(false)} onChanged={refresh} />}
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-3xl font-bold text-slate-900">
        {formatDays(value)} <span className="text-base font-medium text-slate-400">{value === 1 ? 'day' : 'days'}</span>
      </p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
