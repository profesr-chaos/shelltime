import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import type { ChangelogEntry } from '../lib/changelog';

interface WhatsNewModalProps {
  entry: ChangelogEntry;
  onClose: () => void;
}

export function WhatsNewModal({ entry, onClose }: WhatsNewModalProps) {
  return (
    <Modal
      title="What's new"
      subtitle={`Version ${entry.version}`}
      onClose={onClose}
      footer={<Button variant="primary" onClick={onClose}>Got it</Button>}
    >
      <ul className="space-y-3">
        {entry.highlights.map((h, i) => (
          <li key={i} className="flex gap-3 text-sm text-slate-700">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
