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
import { DistributeDeltaModal } from './DistributeDeltaModal';

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
  const [pendingDelta, setPendingDelta] = useState<number | null>(null);
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

  // Dragging the snail retargets the day's total; like the Today tab, it doesn't auto-spread — it
  // opens the chooser so the user picks which projects absorb the delta (snapped to 5 minutes).
  const handleSeek = (fraction: number) => {
    const target = Math.round((fraction * targetMinutes) / 5) * 5;
    const delta = Math.round(target - trackedMinutes);
    if (delta !== 0) setPendingDelta(delta);
  };

  // Apply the chosen split to the in-progress rows (even share, matching the Today flow), adding a
  // row for any selected project that isn't listed yet.
  const distributeToRows = (ids: number[], delta: number) => {
    const share = delta / ids.length;
    setRows((prev) => {
      const next = [...prev];
      for (const id of ids) {
        if (!next.some((r) => r.projectId === id)) next.push({ key: `dist-${id}`, projectId: id, durationMinutes: 0, isNew: true });
      }
      return next.map((r) =>
        r.projectId !== '' && ids.includes(r.projectId)
          ? { ...r, durationMinutes: Math.max(0, Math.round(r.durationMinutes + share)) }
          : r
      );
    });
  };

  const setDailyTarget = (minutes: number) => {
    setTargetMinutes(minutes);
    window.api.targets.setDailyOverride(date, minutes).then(() => onSaved());
  };

  const resetTarget = async () => {
    await window.api.targets.setDailyOverride(date, null);
    const status = await window.api.targets.getDailyStatus(date);
    setTargetMinutes(status.targetMinutes);
    onSaved();
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
          <ProgressBar fraction={targetMinutes > 0 ? trackedMinutes / targetMinutes : 0} tone={underBy > 0.5 ? 'red' : 'amber'} onSeek={handleSeek} />
        </div>
        {underBy > 0.5 && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-amber-600">
            <AlertIcon width={14} height={14} /> Under target by {minutesToHhMm(underBy)}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500">Target for this day</span>
          <DurationInput minutes={targetMinutes} onChange={setDailyTarget} maxMinutes={16 * 60} />
          <button onClick={resetTarget} className="text-xs font-medium text-amber hover:underline">Reset to default</button>
        </div>
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
                      {p.code} - {p.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="flex flex-1 items-center gap-2">
                  <ColorDot color={project?.color ?? '#94a3b8'} />
                  <span className="text-sm font-medium text-slate-800">
                    {project ? `${project.code} - ${project.name}` : 'Unknown'}
                  </span>
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

      {pendingDelta !== null && (
        <DistributeDeltaModal
          date={date}
          projects={projects}
          deltaMinutes={pendingDelta}
          onApply={distributeToRows}
          onClose={() => setPendingDelta(null)}
          onSaved={() => {}}
        />
      )}
    </Modal>
  );
}
