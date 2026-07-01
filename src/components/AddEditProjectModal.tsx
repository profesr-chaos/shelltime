import { useState } from 'react';
import type { Project } from '@shared/types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { TextInput, Textarea, FieldWrap, Toggle } from './ui/Inputs';
import { useToast } from './ui/Toast';

const PRESET_COLORS = ['#F5941E', '#3B82F6', '#10B981', '#EC4899', '#8B5CF6', '#EF4444', '#64748B'];

interface AddEditProjectModalProps {
  project?: Project;
  onClose: () => void;
  onSaved: () => void;
}

export function AddEditProjectModal({ project, onClose, onSaved }: AddEditProjectModalProps) {
  const [code, setCode] = useState(project?.code ?? '');
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [color, setColor] = useState(project?.color ?? PRESET_COLORS[0]);
  const [isActive, setIsActive] = useState(project?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const toast = useToast();

  const valid = code.trim().length > 0 && name.trim().length > 0;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    if (project) {
      await window.api.projects.update(project.id, { code: code.trim(), name: name.trim(), description: description.trim() || null, color, isActive });
    } else {
      await window.api.projects.create({ code: code.trim(), name: name.trim(), description: description.trim() || undefined, color });
    }
    setSaving(false);
    toast(project ? 'Project updated' : 'Project created');
    onSaved();
    onClose();
  };

  const deleteProject = async () => {
    if (!project) return;
    setSaving(true);
    await window.api.projects.delete(project.id);
    setSaving(false);
    toast('Project deleted');
    onSaved();
    onClose();
  };

  if (confirmingDelete && project) {
    return (
      <Modal
        title="Delete project?"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
            <Button variant="danger" onClick={deleteProject} disabled={saving}>Delete permanently</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          This permanently deletes <span className="font-semibold">{project.code}</span> and all its tracked time and
          notes. This can&apos;t be undone — if you just want to stop it showing up day-to-day, archive it instead
          (toggle it inactive in the edit form).
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      title={project ? 'Edit Project' : 'Add Project'}
      onClose={onClose}
      footer={
        <>
          {project && (
            <Button variant="danger" onClick={() => setConfirmingDelete(true)} className="mr-auto">
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!valid || saving}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FieldWrap label="Project code">
          <TextInput autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="GC-TENDER" />
        </FieldWrap>
        <FieldWrap label="Project name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="GC Tender Project" />
        </FieldWrap>
        <FieldWrap label="Description" hint="Optional">
          <Textarea rows={2} value={description ?? ''} onChange={(e) => setDescription(e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Colour">
          <div className="flex gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full ring-offset-2 ${color === c ? 'ring-2 ring-slate-800' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </FieldWrap>
        {project && (
          <Toggle checked={isActive} onChange={setIsActive} label={isActive ? 'Active' : 'Inactive (archived)'} />
        )}
      </div>
    </Modal>
  );
}
