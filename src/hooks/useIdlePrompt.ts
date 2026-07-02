import { useEffect, useRef, useState } from 'react';
import { useNowTick } from './useNowTick';

interface IdleInfo {
  projectId: number;
  idleSeconds: number;
}

// Prompts (from the main process) when a running timer has been idle past the threshold. The timer
// keeps running, so this clock shows the real, still-growing idle time. Keep it (a meeting) or discard
// the whole idle window (you walked away) — either way timing continues.
export function useIdlePrompt() {
  const [idle, setIdle] = useState<IdleInfo | null>(null);
  const idleStartedAt = useRef(0); // epoch ms the idle window began
  const now = useNowTick(1000);

  useEffect(() => {
    const offPrompt = window.api.timer.onIdlePrompt((info) => {
      idleStartedAt.current = Date.now() - info.idleSeconds * 1000;
      setIdle(info);
    });
    const offResolved = window.api.timer.onIdleResolved(() => setIdle(null));
    return () => {
      offPrompt();
      offResolved();
    };
  }, []);

  const liveIdleSeconds = idle ? (now - idleStartedAt.current) / 1000 : 0;

  const resolve = (discard: boolean) => {
    if (idle) window.api.timer.resolveIdle(discard, idle.projectId, idle.idleSeconds, true);
    setIdle(null);
  };

  return { idle, liveIdleSeconds, keep: () => resolve(false), discard: () => resolve(true) };
}
