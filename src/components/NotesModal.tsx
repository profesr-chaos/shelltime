import { useEffect, useState } from 'react';
import type { Note, Project } from '@shared/types';
import { Modal } from './ui/Modal';
import { Button, IconButton } from './ui/Button';
import { Textarea } from './ui/Inputs';
import { PencilIcon, TrashIcon, CheckIcon, CloseIcon } from './icons';
import { formatDateShort } from '@/lib/format';
import { useToast } from './ui/Toast';

interface NotesModalProps {
  date: string;
  project: Project;
  onClose: () => void;
  onChanged?: () => void;
}

export function NotesModal({ date, project, onClose, onChanged }: NotesModalProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const toast = useToast();

  const load = () => window.api.notes.list(date, project.id).then(setNotes);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, project.id]);

  const changed = () => {
    load();
    onChanged?.();
  };

  const add = async () => {
    if (!draft.trim()) return;
    await window.api.notes.add(date, project.id, draft.trim());
    setDraft('');
    toast('Note added');
    changed();
  };

  const saveEdit = async (id: number) => {
    if (!editText.trim()) return;
    await window.api.notes.update(id, editText.trim());
    setEditingId(null);
    changed();
  };

  const del = async (id: number) => {
    await window.api.notes.delete(id);
    changed();
  };

  return (
    <Modal title="Notes" subtitle={`${project.code} · ${formatDateShort(date)}`} onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      <div className="mb-4 flex flex-col gap-2">
        {notes.length === 0 && <p className="text-sm text-slate-400">No notes for this day yet.</p>}
        {notes.map((n) => (
          <div key={n.id} className="rounded-lg border border-slate-200 px-3 py-2">
            {editingId === n.id ? (
              <div className="flex flex-col gap-2">
                <Textarea rows={2} value={editText} autoFocus onChange={(e) => setEditText(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <IconButton label="Cancel edit" onClick={() => setEditingId(null)} className="h-7 w-7">
                    <CloseIcon width={14} height={14} />
                  </IconButton>
                  <IconButton label="Save note" variant="primary" onClick={() => saveEdit(n.id)} className="h-7 w-7">
                    <CheckIcon width={14} height={14} />
                  </IconButton>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-sm text-slate-700">{n.text}</p>
                <div className="flex shrink-0 gap-1">
                  <IconButton label="Edit note" onClick={() => { setEditingId(n.id); setEditText(n.text); }} className="h-7 w-7">
                    <PencilIcon width={14} height={14} />
                  </IconButton>
                  <IconButton label="Delete note" onClick={() => del(n.id)} className="h-7 w-7">
                    <TrashIcon width={14} height={14} />
                  </IconButton>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
        <Textarea
          rows={2}
          placeholder="Add a note…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(); }}
        />
        <div className="flex justify-end">
          <Button variant="primary" onClick={add} disabled={!draft.trim()}>Add note</Button>
        </div>
      </div>
    </Modal>
  );
}
