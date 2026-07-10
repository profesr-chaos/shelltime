import { useState, useEffect } from 'react';

// Fires when a calendar busy block starts and the user hasn't switched projects recently (item 14).
// "Yes" dismisses it; picking a project via the quick-switch list resolves it by actually switching
// (main resolves the prompt itself via notifySwitch, so no separate dismiss call is needed there).
export function useMeetingPrompt() {
  const [projectId, setProjectId] = useState<number | null>(null);

  useEffect(() => {
    const offPrompt = window.api.timer.onMeetingPrompt((data) => setProjectId(data.projectId));
    const offDismissed = window.api.timer.onMeetingDismissed(() => setProjectId(null));
    return () => {
      offPrompt();
      offDismissed();
    };
  }, []);

  return { projectId, dismiss: () => window.api.timer.resolveMeeting() };
}
