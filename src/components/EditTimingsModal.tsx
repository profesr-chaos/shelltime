import { useEffect, useState } from 'react';
import type { Project, DailyEntry } from '@shared/types';
import { Modal } from './ui/Modal';
import { Button, IconButton } from './ui/Button';
import { Select } from './ui/Inputs';
import { DurationInput } from './ui/DurationInput';
import { ProgressBar } from './ui/ProgressBar';
import { ColorDot } from './ui/Badge';
import { TrashIcon, PlusIcon, AlertIcon } from './icons';
import { minutesToHhMm, formatDateShort } from '@/lib/format';
import { useToast } from './ui/Toast';

interface Row {
  key: string;
  projectId: number | '';
  durationMinutes: number;
  isNew: boolean;
}

interface EditTimingsModalProps {
  date: string;
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditTimingsModal({ date, projects, onClose, onSaved }: EditTimingsModalProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [targetMinutes, setTargetMinutes] = useState(480);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    Promise.all([window.api.entries.getDaily(date), window.api.targets.getDailyStatus(date)]).then(
      ([entries, status]) => {
        setRows(
          entries.map((e: DailyEntry) => ({
            key: `existing-${e.projectId}`,
            projectId: e.projectId,
            durationMinutes: e.durationMinutes,
            isNew: false,
          }))
        );
        setTargetMinutes(status.targetMinutes);
      }
    );
  }, [date]);

  const usedProjectIds = new Set(rows.map((r) => r.projectId));
  const available = projects.filter((p) => p.isActive);

  const trackedMinutes = rows.reduce((s, r) => s + r.durationMinutes, 0);
  const underBy = targetMinutes - trackedMinutes;

  const addRow = () => {
    const next = available.find((p) => !usedProjectIds.has(p.id));
    setRows((prev) => [...prev, { key: `new-${Date.now()}`, projectId: next?.id ?? '', durationMinutes: 0, isNew: true }]);
  };

  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // Dragging the snail retargets the day's total; spread the delta across the listed projects (proportionally, or evenly if all zero).
  const applySeek = (fraction: number) => {
    const target = Math.round(fraction * targetMinutes);
    setRows((prev) => {
      const editable = prev.filter((r) => r.projectId !== '');
      if (editable.length === 0) return prev;
      const current = editable.reduce((s, r) => s + r.durationMinutes, 0);
      const delta = target - current;
      if (delta === 0) return prev;
      return prev.map((r) => {
        if (r.projectId === '') return r;
        const share = current > 0 ? (r.durationMinutes / current) * delta : delta / editable.length;
        return { ...r, durationMinutes: Math.max(0, Math.round(r.durationMinutes + share)) };
      });
    });
  };

  const save = async () => {
    setSaving(true);
    const existingProjectIds = new Set(rows.filter((r) => !r.isNew).map((r) => r.projectId));
    // Delete rows that existed before but were removed from the list.
    const original = await window.api.entries.getDaily(date);
    for (const e of original) {
      if (!existingProjectIds.has(e.projectId) && !rows.some((r) => r.projectId === e.projectId)) {
        await window.api.entries.delete(date, e.projectId);
      }
    }
    for (const r of rows) {
      if (r.projectId === '') continue;
      await window.api.entries.set(date, r.projectId, r.durationMinutes, 'manual');
    }
    setSaving(false);
    toast('Timings updated');
    onSaved();
    onClose();
  };

  return (
    <Modal
      title="Edit Timings"
      subtitle={formatDateShort(date)}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>Save Changes</Button>
        </>
      }
    >
      <div className="mb-5">
        <p className="text-sm text-slate-700">
          <span className="font-semibold">{minutesToHhMm(trackedMinutes)}</span> tracked of{' '}
          <span className="font-semibold text-slate-500">{minutesToHhMm(targetMinutes)}</span> target
        </p>
        <div className="mt-2">
          <ProgressBar fraction={targetMinutes > 0 ? trackedMinutes / targetMinutes : 0} tone={underBy > 0.5 ? 'red' : 'amber'} onSeek={applySeek} />
        </div>
        {underBy > 0.5 && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-amber-600">
            <AlertIcon width={14} height={14} /> Under target by {minutesToHhMm(underBy)}
          </p>
        )}
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Time entries</p>
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => {
          const project = projects.find((p) => p.id === row.projectId);
          return (
            <div key={row.key} className="flex items-center gap-3">
              {row.isNew ? (
                <Select
                  value={row.projectId}
                  onChange={(e) => updateRow(row.key, { projectId: Number(e.target.value) })}
                  className="flex-1"
                >
                  <option value="">Select project…</option>
                  {available.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code}
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="flex flex-1 items-center gap-2">
                  <ColorDot color={project?.color ?? '#94a3b8'} />
                  <span className="text-sm font-medium text-slate-800">{project?.code ?? 'Unknown'}</span>
                </div>
              )}
              <DurationInput
                minutes={row.durationMinutes}
                onChange={(minutes) => updateRow(row.key, { durationMinutes: minutes })}
              />
              <IconButton label="Remove entry" onClick={() => removeRow(row.key)} className="h-8 w-8">
                <TrashIcon width={16} height={16} />
              </IconButton>
            </div>
          );
        })}
      </div>

      <button onClick={addRow} className="mt-4 flex items-center gap-1.5 text-sm font-medium text-amber hover:underline">
        <PlusIcon width={14} height={14} /> Add time entry
      </button>
    </Modal>
  );
}
