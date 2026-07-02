import { useEffect, useState } from 'react';

interface IdleInfo {
  projectId: number;
  idleSeconds: number;
}

// Prompts (from the main process) when a running timer has been idle past the threshold.
// The user keeps the banked time (a meeting) or discards it (walked away); either way the timer resumes.
export function useIdlePrompt() {
  const [idle, setIdle] = useState<IdleInfo | null>(null);

  useEffect(() => {
    const offPrompt = window.api.timer.onIdlePrompt(setIdle);
    const offResolved = window.api.timer.onIdleResolved(() => setIdle(null));
    return () => {
      offPrompt();
      offResolved();
    };
  }, []);

  const resolve = (discard: boolean) => {
    if (idle) window.api.timer.resolveIdle(discard, idle.projectId, idle.idleSeconds, true);
    setIdle(null);
  };

  return { idle, keep: () => resolve(false), discard: () => resolve(true) };
}
