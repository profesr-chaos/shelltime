import { useCallback, useEffect, useState } from 'react';
import type { LeaveRecord } from '@shared/types';
import { Modal } from './ui/Modal';
import { Button, IconButton } from './ui/Button';
import { TrashIcon } from './icons';
import { formatDateShort } from '@/lib/format';

const rangeLabel = (r: LeaveRecord) =>
  r.startDate === r.endDate ? formatDateShort(r.startDate) : `${formatDateShort(r.startDate)} – ${formatDateShort(r.endDate)}`;

export function LeaveListModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [leave, setLeave] = useState<LeaveRecord[]>([]);

  const load = useCallback(() => window.api.leave.list().then(setLeave), []);
  useEffect(() => { load(); }, [load]);

  const remove = async (id: number) => {
    await window.api.leave.delete(id);
    load();
    onChanged();
  };

  return (
    <Modal title="Leave" subtitle="Holiday and sick days" onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      {leave.length === 0 ? (
        <p className="text-sm text-slate-400">No leave booked yet.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {leave.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center gap-2.5">
                <span className={`rounded px-1.5 py-0.5 text-xs font-semibold capitalize ${
                  r.type === 'sick' ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'
                }`}>
                  {r.type === 'sick' ? 'Sick' : 'Holiday'}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800">{rangeLabel(r)}</p>
                  <p className="text-xs text-slate-400">{r.days} day{r.days === 1 ? '' : 's'}{r.half ? ' · half days' : ''}</p>
                </div>
              </div>
              <IconButton label="Delete leave" onClick={() => remove(r.id)} className="h-8 w-8">
                <TrashIcon width={16} height={16} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
