import { useProjects } from '@/hooks/useProjects';
import { useResumePrompt } from '@/hooks/useResumePrompt';
import { secondsToHms } from '@/lib/format';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

// Shown in 'prompt' resume mode: the timer resumed on detecting activity; keep the temp time or reject (re-pause + discard).
export function ResumePromptModal() {
  const { projectId, liveSeconds, keep, reject } = useResumePrompt();
  const { projects } = useProjects();

  if (projectId === null) return null;

  const project = projects.find((p) => p.id === projectId);

  return (
    <Modal
      title="Back to work?"
      subtitle={project ? `${project.code} - ${project.name}` : undefined}
      onClose={keep}
      footer={
        <>
          <Button variant="secondary" onClick={reject}>Not yet</Button>
          <Button variant="primary" onClick={keep}>Keep going</Button>
        </>
      }
    >
      <p className="text-center font-mono text-3xl font-bold tabular-nums text-amber">{secondsToHms(liveSeconds)}</p>
      <p className="mt-3 text-sm text-slate-600">
        Detected activity, so timing resumed. Keep going, or reject it to pause again and drop this time.
      </p>
    </Modal>
  );
}
