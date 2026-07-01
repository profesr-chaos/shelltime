import { useCallback, useEffect, useState } from 'react';
import type { LeaveType } from '@shared/types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Calendar } from './ui/Calendar';
import { formatMonth } from '@/lib/format';
import { useToast } from './ui/Toast';

export function AddLeaveModal({ month, onClose, onChanged }: { month: string; onClose: () => void; onChanged: () => void }) {
  const [type, setType] = useState<LeaveType>('holiday');
  const [half, setHalf] = useState(false);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [hoverEnd, setHoverEnd] = useState<string | null>(null);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const toast = useToast();

  const loadMarked = useCallback(() => {
    window.api.leave.summary(month).then((s) => setMarked(new Set(s.dates)));
  }, [month]);
  useEffect(() => loadMarked(), [loadMarked]);

  const handleDayClick = async (date: string) => {
    if (!rangeStart) {
      setRangeStart(date);
      setHoverEnd(date);
      return;
    }
    const rec = await window.api.leave.add(type, rangeStart, date, half);
    setRangeStart(null);
    setHoverEnd(null);
    toast(rec.days > 0 ? `${rec.days} ${type} day${rec.days === 1 ? '' : 's'} added` : 'No working days in that range');
    loadMarked();
    onChanged();
  };

  return (
    <Modal title="Add leave" subtitle={formatMonth(month)} onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      <div className="mb-3 flex gap-2">
        {(['holiday', 'sick'] as LeaveType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
              type === t ? 'border-amber bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {t === 'sick' ? 'Sick leave' : 'Holiday'}
          </button>
        ))}
      </div>

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
    </Modal>
  );
}
