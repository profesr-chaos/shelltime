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

// Combine an edited HH:MM with `anchorIso`'s actual calendar date (not session.date, which is the
// *logical* day — up to 4h earlier than the calendar day for a post-midnight session) into a full
// ISO timestamp in local time. `rollIfBefore`, when given, pushes the result to the next calendar
// day if `clock` is earlier than it — how a session that spans real midnight (e.g. 23:00–01:00)
// gets its end clock reconstructed on the right day.
const toIso = (anchorIso: string, clock: string, rollIfBefore?: string): string => {
  const [h, m] = clock.split(':').map(Number);
  const d = new Date(anchorIso);
  d.setHours(h, m, 0, 0);
  if (rollIfBefore !== undefined && clock < rollIfBefore) d.setDate(d.getDate() + 1);
  return d.toISOString();
};

// HH:MM drops seconds, so reconstructing "the whole session" would otherwise slice a few seconds
// short and leave a sub-minute stub on the old project — snap back to the exact bound when close.
const snapToBound = (iso: string, boundIso: string): string =>
  Math.abs(new Date(iso).getTime() - new Date(boundIso).getTime()) < 60_000 ? boundIso : iso;

export function ReassignSessionModal({ session, projects, onClose, onSaved }: ReassignSessionModalProps) {
  const active = projects.filter((p) => p.isActive || p.id === session.projectId);
  const [projectId, setProjectId] = useState<number>(active.find((p) => p.id !== session.projectId)?.id ?? active[0]?.id ?? session.projectId);
  const [start, setStart] = useState(toClockValue(session.startedAt));
  const [end, setEnd] = useState(toClockValue(session.endedAt));
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // Only a midnight-spanning session (its end clock reads earlier than its start clock) can mean
  // "next calendar day" by a clock earlier than the session's start; on a same-day session that's
  // just an invalid range. The end anchors on the (possibly rolled) start so both land together.
  const spansMidnight = toClockValue(session.endedAt) < toClockValue(session.startedAt);
  const startIso = toIso(session.startedAt, start, spansMidnight ? toClockValue(session.startedAt) : undefined);
  const endIso = toIso(startIso, end, spansMidnight ? start : undefined);
  const valid = startIso < endIso;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const applied = await window.api.sessions.reallocate(
      session.id,
      snapToBound(startIso, session.startedAt),
      snapToBound(endIso, session.endedAt),
      projectId
    );
    setSaving(false);
    toast(applied ? 'Session reassigned' : 'Nothing reassigned — times are outside the session');
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
