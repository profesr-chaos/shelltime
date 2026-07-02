import { useState } from 'react';
import { IconButton } from '@/components/ui/Button';
import { CheckIcon, UndoIcon, CloseIcon } from '@/components/icons';

interface OverlayNoteViewProps {
  onSave: (text: string) => void;
  onCancel: () => void;
}

export function OverlayNoteView({ onSave, onCancel }: OverlayNoteViewProps) {
  const [text, setText] = useState('');

  return (
    <div className="relative flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <IconButton label="Cancel" className="no-drag absolute right-2 top-2 h-6 w-6" onClick={onCancel}>
        <CloseIcon width={12} height={12} />
      </IconButton>
      <textarea
        autoFocus
        className="no-drag mt-7 flex-1 resize-none rounded-lg border border-slate-200 p-2 text-sm text-slate-800 focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        placeholder="What did you work on?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) onSave(text.trim());
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="mt-2 flex justify-end gap-2">
        <IconButton label="Clear" className="no-drag h-8 w-8" onClick={() => setText('')}>
          <UndoIcon width={16} height={16} />
        </IconButton>
        <IconButton
          label="Save note"
          variant="primary"
          className="no-drag h-8 w-8"
          onClick={() => text.trim() && onSave(text.trim())}
        >
          <CheckIcon width={16} height={16} />
        </IconButton>
      </div>
    </div>
  );
}
