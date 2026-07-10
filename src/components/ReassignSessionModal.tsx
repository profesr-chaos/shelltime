import { useState } from 'react';
import type { Project, Session } from '@shared/types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Select, FieldWrap, TextInput } from './ui/Inputs';
import { useToast } from './ui/Toast';

interface ReassignSessionModalProps {
  session: Session;
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}

const toClockValue = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Combine the session's own date with an edited HH:MM into a full ISO timestamp in local time.
const toIso = (date: string, clock: string): string => {
  const [h, m] = clock.split(':').map(Number);
  const d = new Date(date + 'T00:00:00');
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export function ReassignSessionModal({ session, projects, onClose, onSaved }: ReassignSessionModalProps) {
  const active = projects.filter((p) => p.isActive || p.id === session.projectId);
  const [projectId, setProjectId] = useState<number>(active.find((p) => p.id !== session.projectId)?.id ?? active[0]?.id ?? session.projectId);
  const [start, setStart] = useState(toClockValue(session.startedAt));
  const [end, setEnd] = useState(toClockValue(session.endedAt));
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const valid = start < end;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    await window.api.sessions.reallocate(session.id, toIso(session.date, start), toIso(session.date, end), projectId);
    setSaving(false);
    toast('Session reassigned');
    onSaved();
    onClose();
  };

  return (
    <Modal
      title="Reassign session"
      subtitle={`${session.project.code} · ${toClockValue(session.startedAt)}–${toClockValue(session.endedAt)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!valid || saving}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FieldWrap label="Move to project">
          <Select value={projectId} onChange={(e) => setProjectId(Number(e.target.value))}>
            {active.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </Select>
        </FieldWrap>
        <div className="flex gap-4">
          <FieldWrap label="Start">
            <TextInput type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </FieldWrap>
          <FieldWrap label="End">
            <TextInput type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </FieldWrap>
        </div>
        {!valid && <p className="text-sm text-red-600">End must be after start.</p>}
      </div>
    </Modal>
  );
}
