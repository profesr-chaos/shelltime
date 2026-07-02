import { useEffect, useRef, useState } from 'react';
import { useNowTick } from './useNowTick';

// Fires (in 'prompt' resume mode) when the user returns to work while paused: the timer has already
// resumed and this counts a temporary session the user can keep or reject (rejecting discards it and re-pauses).
export function useResumePrompt() {
  const [projectId, setProjectId] = useState<number | null>(null);
  const startedAt = useRef(0);
  const now = useNowTick(1000);

  useEffect(() => {
    const offPrompt = window.api.timer.onResumePrompt((data) => {
      startedAt.current = Date.now();
      setProjectId(data.projectId);
    });
    const offResolved = window.api.timer.onResumeResolved(() => setProjectId(null));
    return () => {
      offPrompt();
      offResolved();
    };
  }, []);

  const liveSeconds = projectId !== null ? (now - startedAt.current) / 1000 : 0;

  const resolve = (discard: boolean) => {
    window.api.timer.resolveResume(discard);
    setProjectId(null);
  };

  return { projectId, liveSeconds, keep: () => resolve(false), reject: () => resolve(true) };
}
