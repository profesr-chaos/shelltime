import { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Textarea } from './ui/Inputs';
import { useToast } from './ui/Toast';

interface AddNoteModalProps {
  date: string;
  projectId: number;
  projectLabel: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function AddNoteModal({ date, projectId, projectLabel, onClose, onSaved }: AddNoteModalProps) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await window.api.notes.add(date, projectId, text.trim());
    setSaving(false);
    toast('Note added');
    onSaved?.();
    onClose();
  };

  return (
    <Modal title="Add Note" subtitle={projectLabel} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={saving || !text.trim()}>Save</Button>
      </>
    }>
      <Textarea
        autoFocus
        rows={4}
        placeholder="What did you work on?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
        }}
      />
      <p className="mt-2 text-xs text-slate-400">Tip: Ctrl+Enter to save</p>
    </Modal>
  );
}
