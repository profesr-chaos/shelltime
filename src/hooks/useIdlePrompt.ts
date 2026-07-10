import { useEffect, useRef, useState } from 'react';
import { useNowTick } from './useNowTick';

interface IdleInfo {
  projectId: number;
  idleSeconds: number;
  frozen: boolean; // true = a fixed, already-elapsed amount; false = still live/growing
  duringMeeting: boolean; // the banked window overlapped a calendar busy block
}

// Prompts (from the main process) when a running timer has been idle past the threshold. Two
// shapes share this channel: a *live* prompt (frozen: false) while the timer is still running and
// the clock keeps growing until answered; and a *frozen* prompt (frozen: true) shown only once the
// user has actually returned from an escalated away-period, showing the fixed banked amount.
export function useIdlePrompt() {
  const [idle, setIdle] = useState<IdleInfo | null>(null);
  const idleStartedAt = useRef(0); // epoch ms the idle window began (live case only)
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

  const liveIdleSeconds = idle ? (idle.frozen ? idle.idleSeconds : (now - idleStartedAt.current) / 1000) : 0;

  const resolve = (discard: boolean) => {
    if (idle) window.api.timer.resolveIdle(discard);
    setIdle(null);
  };

  return { idle, liveIdleSeconds, keep: () => resolve(false), discard: () => resolve(true) };
}
