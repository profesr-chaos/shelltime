import { useEffect, useState } from 'react';
import type { Project, FillRestOfDayPreview } from '@shared/types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Select, FieldWrap } from './ui/Inputs';
import { ColorDot } from './ui/Badge';
import { minutesToHhMm } from '@/lib/format';
import { useToast } from './ui/Toast';

interface FillRestOfDayModalProps {
  date: string;
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}

export function FillRestOfDayModal({ date, projects, onClose, onSaved }: FillRestOfDayModalProps) {
  const [preview, setPreview] = useState<FillRestOfDayPreview | null>(null);
  const active = projects.filter((p) => p.isActive);
  const [mode, setMode] = useState<'single' | 'split'>('single');
  const [projectId, setProjectId] = useState<number | ''>(active[0]?.id ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    window.api.entries.fillPreview(date).then(setPreview);
  }, [date]);

  const alreadyMet = preview !== null && preview.toAddMinutes <= 0;

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canConfirm = mode === 'single' ? projectId !== '' : selectedIds.size > 0;

  const confirm = async () => {
    if (!canConfirm || alreadyMet) return;
    setSaving(true);
    if (mode === 'single') {
      await window.api.entries.fill(date, projectId as number);
    } else {
      await window.api.entries.fillSplit(date, [...selectedIds]);
    }
    setSaving(false);
    toast('Rest of day filled');
    onSaved();
    onClose();
  };

  return (
    <Modal
      title="Fill Rest of Day"
      subtitle="Automatically add the remaining time to reach your daily target."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={confirm} disabled={saving || alreadyMet || !canConfirm}>Confirm &amp; Fill</Button>
        </>
      }
    >
      {preview && (
        <div className="mb-5 grid grid-cols-3 divide-x divide-slate-200 rounded-xl bg-slate-50 py-4 text-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Daily Target</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{minutesToHhMm(preview.targetMinutes)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tracked</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{minutesToHhMm(preview.trackedMinutes)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber">To Add</p>
            <p className="mt-1 text-lg font-bold text-amber">{minutesToHhMm(preview.toAddMinutes)}</p>
          </div>
        </div>
      )}

      {alreadyMet ? (
        <p className="text-sm text-emerald-600">Daily target already met — nothing to fill.</p>
      ) : (
        <>
          <div className="mb-4 inline-flex rounded-lg border border-slate-200 p-1">
            <button
              onClick={() => setMode('single')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === 'single' ? 'bg-amber text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Single project
            </button>
            <button
              onClick={() => setMode('split')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === 'split' ? 'bg-amber text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Split evenly
            </button>
          </div>

          {mode === 'single' ? (
            <FieldWrap label="Project to allocate">
              <Select value={projectId} onChange={(e) => setProjectId(Number(e.target.value))}>
                {active.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} ({p.name})
                  </option>
                ))}
              </Select>
            </FieldWrap>
          ) : (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Split between</p>
              <div className="flex flex-col gap-1.5">
                {active.map((p) => (
                  <label key={p.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelected(p.id)}
                      className="h-4 w-4 accent-amber-500"
                    />
                    <ColorDot color={p.color} />
                    <span className="text-sm font-medium text-slate-800">{p.code}</span>
                    <span className="truncate text-sm text-slate-400">{p.name}</span>
                  </label>
                ))}
              </div>
              {preview && selectedIds.size > 0 && (
                <p className="mt-3 text-xs text-slate-400">
                  Each selected project gets ~{minutesToHhMm(preview.toAddMinutes / selectedIds.size)}.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
