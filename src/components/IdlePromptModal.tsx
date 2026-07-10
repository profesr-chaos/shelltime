import { useProjects } from '@/hooks/useProjects';
import { useIdlePrompt } from '@/hooks/useIdlePrompt';
import { secondsToHms } from '@/lib/format';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

export function IdlePromptModal() {
  const { idle, liveIdleSeconds, keep, discard } = useIdlePrompt();
  const { projects } = useProjects();

  if (!idle) return null;

  const project = projects.find((p) => p.id === idle.projectId);
  const minutes = Math.max(1, Math.round(liveIdleSeconds / 60));

  return (
    <Modal
      title={idle.duringMeeting ? 'You were in a meeting' : idle.frozen ? 'Welcome back' : 'Still working?'}
      subtitle={project ? `${project.code} - ${project.name}` : undefined}
      onClose={keep}
      footer={
        <>
          <Button variant="secondary" onClick={discard}>Discard {minutes} min</Button>
          <Button variant="primary" onClick={keep}>Keep the time</Button>
        </>
      }
    >
      <p className="text-center font-mono text-3xl font-bold tabular-nums text-amber">{secondsToHms(liveIdleSeconds)}</p>
      {idle.duringMeeting ? (
        <p className="mt-3 text-sm text-slate-600">Your calendar shows you were busy - keep the banked time?</p>
      ) : idle.frozen ? (
        <p className="mt-3 text-sm text-slate-600">
          Away for a while - the timer paused. Keep the banked time if you were in a meeting, or discard it if you
          stepped away.
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          No mouse or keyboard activity - the timer is still running. If you were in a meeting, keep the time. If you
          stepped away, discard it - then timing continues.
        </p>
      )}
    </Modal>
  );
}
