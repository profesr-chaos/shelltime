import { useState } from 'react';
import type { Project } from '@shared/types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Select, FieldWrap } from './ui/Inputs';
import { DurationInput } from './ui/DurationInput';
import { useToast } from './ui/Toast';

interface ManualTimeModalProps {
  date: string;
  mode: 'add' | 'edit';
  projects: Project[];
  initialProjectId?: number;
  currentMinutes?: number;
  onClose: () => void;
  onSaved: () => void;
}

export function ManualTimeModal({ date, mode, projects, initialProjectId, currentMinutes = 0, onClose, onSaved }: ManualTimeModalProps) {
  const active = projects.filter((p) => p.isActive || p.id === initialProjectId);
  const [projectId, setProjectId] = useState<number | ''>(initialProjectId ?? active[0]?.id ?? '');
  const [minutes, setMinutes] = useState(mode === 'edit' ? currentMinutes : 0);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const valid = projectId !== '';

  const save = async () => {
    if (!valid) return;
    const pid = projectId as number;
    setSaving(true);
    if (mode === 'add') {
      const existing = await window.api.entries.getDaily(date);
      const currentForProject = existing.find((e) => e.projectId === pid)?.durationMinutes ?? 0;
      await window.api.entries.set(date, pid, currentForProject + minutes, 'manual');
    } else {
      await window.api.entries.set(date, pid, minutes, 'manual');
    }
    setSaving(false);
    toast(mode === 'add' ? 'Time added' : 'Entry updated');
    onSaved();
    onClose();
  };

  return (
    <Modal
      title={mode === 'add' ? 'Add Manual Time' : 'Edit Time Entry'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!valid || saving}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FieldWrap label="Project">
          <Select value={projectId} onChange={(e) => setProjectId(Number(e.target.value))} disabled={mode === 'edit'}>
            {active.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </Select>
        </FieldWrap>
        <FieldWrap label={mode === 'add' ? 'Time to add' : 'Total duration'}>
          <DurationInput minutes={minutes} onChange={setMinutes} />
        </FieldWrap>
      </div>
    </Modal>
  );
}
