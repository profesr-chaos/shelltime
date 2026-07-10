import { useProjects } from '@/hooks/useProjects';
import { useTimer } from '@/hooks/useTimer';
import { useMeetingPrompt } from '@/hooks/useMeetingPrompt';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { QuickSwitchMenu } from './QuickSwitchMenu';

// "In a meeting — still working on X?" (item 14). Yes dismisses; picking a project switches.
export function MeetingPromptModal() {
  const { projectId, dismiss } = useMeetingPrompt();
  const { projects } = useProjects();
  const { switchProject } = useTimer();

  if (projectId === null) return null;

  const project = projects.find((p) => p.id === projectId);

  return (
    <Modal
      title="In a meeting"
      subtitle={project ? `Still working on ${project.code}?` : undefined}
      onClose={dismiss}
      footer={<Button variant="primary" onClick={dismiss}>Yes, still {project?.code ?? 'this'}</Button>}
    >
      <p className="mb-3 text-sm text-slate-600">Your calendar shows you're busy. Switch if you're really on something else:</p>
      <div className="relative h-64">
        <QuickSwitchMenu
          projects={projects}
          activeProjectId={projectId}
          onSelect={switchProject}
          onClose={dismiss}
          anchorClassName="inset-x-0 top-0"
          heading="Switch to"
        />
      </div>
    </Modal>
  );
}
