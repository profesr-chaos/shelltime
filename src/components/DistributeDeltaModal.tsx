import { useEffect, useState } from 'react';
import type { Project, DailyEntry } from '@shared/types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { ColorDot } from './ui/Badge';
import { ChevronRightIcon } from './icons';
import { groupByCategory } from '@/lib/projects';
import { minutesToHhMm, signedMinutesToHhMm } from '@/lib/format';
import { useToast } from './ui/Toast';

interface DistributeDeltaModalProps {
  date: string;
  projects: Project[];
  deltaMinutes: number;
  // When provided, the chosen split is handed back instead of being written straight to the DB —
  // lets a staged editor (Edit Timings) apply the delta to its in-progress rows.
  onApply?: (selectedIds: number[], deltaMinutes: number) => void | Promise<void>;
  onClose: () => void;
  onSaved: () => void;
}

export function DistributeDeltaModal({ date, projects, deltaMinutes, onApply, onClose, onSaved }: DistributeDeltaModalProps) {
  const active = projects.filter((p) => p.isActive);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [minutesByProject, setMinutesByProject] = useState<Map<number, number>>(new Map());
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const groups = groupByCategory(active, (p) => p.category);
  const showCategoryHeaders = groups.some((g) => g.category !== null);
  const toggleCat = (key: string) =>
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  useEffect(() => {
    window.api.entries.getDaily(date).then((entries: DailyEntry[]) => {
      setMinutesByProject(new Map(entries.map((e) => [e.projectId, e.durationMinutes])));
    });
  }, [date]);

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirm = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    if (onApply) {
      await onApply([...selectedIds], deltaMinutes);
    } else {
      await window.api.entries.applyDelta(date, [...selectedIds], deltaMinutes);
      toast('Time reassigned');
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const isIncrease = deltaMinutes > 0;

  return (
    <Modal
      title="Reassign Tracked Time"
      subtitle={`You moved the marker ${isIncrease ? 'up' : 'down'} by ${minutesToHhMm(Math.abs(deltaMinutes))}. Choose which projects share the change.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={confirm} disabled={saving || selectedIds.size === 0}>Save</Button>
        </>
      }
    >
      <div className="mb-4 rounded-xl bg-slate-50 py-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Delta</p>
        <p className={`mt-1 text-lg font-bold ${isIncrease ? 'text-emerald-600' : 'text-red-500'}`}>
          {signedMinutesToHhMm(deltaMinutes)}
        </p>
      </div>

      <p className="mb-2 text-sm font-medium text-slate-700">Split between</p>
      <div className="flex flex-col gap-1.5">
        {groups.map((g) => {
          const key = g.category ?? '__other';
          const isCollapsed = collapsedCats.has(key);
          return (
            <div key={key}>
              {showCategoryHeaders && (
                <button
                  onClick={() => toggleCat(key)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                >
                  <ChevronRightIcon className={`text-slate-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} width={14} height={14} />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{g.category ?? 'Other'}</span>
                  <span className="text-[11px] font-medium tabular-nums text-slate-400">{g.items.length}</span>
                </button>
              )}
              {!isCollapsed && g.items.map((p) => (
                <label key={p.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelected(p.id)}
                    className="h-4 w-4 accent-amber-500"
                  />
                  <ColorDot color={p.color} />
                  <span className="text-sm font-medium text-slate-800">{p.code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-400">{p.name}</span>
                  <span className="ml-auto shrink-0 font-mono text-sm tabular-nums text-slate-500">
                    {minutesToHhMm(minutesByProject.get(p.id) ?? 0)}
                  </span>
                </label>
              ))}
            </div>
          );
        })}
        {active.length === 0 && <p className="px-2 py-1.5 text-sm text-slate-400">No active projects</p>}
      </div>
      {selectedIds.size > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          Each selected project {isIncrease ? 'gains' : 'loses'} ~{minutesToHhMm(Math.abs(deltaMinutes) / selectedIds.size)}.
        </p>
      )}
    </Modal>
  );
}
