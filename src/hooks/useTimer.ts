import { useEffect, useState, useCallback } from 'react';
import type { TimerState } from '@shared/types';
import { useNowTick } from './useNowTick';

const EMPTY_STATE: TimerState = {
  status: 'idle',
  activeProjectId: null,
  sessionStartedAt: null,
  accumulatedSecondsToday: 0,
  todayTotalSeconds: 0,
  finishedForToday: false,
};

export function useTimer() {
  const [state, setState] = useState<TimerState>(EMPTY_STATE);
  // False until the real state arrives from the main process, so callers can tell an actual idle day
  // apart from the EMPTY_STATE placeholder.
  const [loaded, setLoaded] = useState(false);
  const now = useNowTick(1000);

  useEffect(() => {
    window.api.timer.getState().then((s) => {
      setState(s);
      setLoaded(true);
    });
    const unsubscribe = window.api.timer.onUpdate(setState);
    return unsubscribe;
  }, []);

  const runningExtraSeconds = state.status === 'running' && state.sessionStartedAt ? (now - state.sessionStartedAt) / 1000 : 0;

  const liveActiveSeconds = state.accumulatedSecondsToday + runningExtraSeconds;
  const liveTodayTotalSeconds = state.todayTotalSeconds + runningExtraSeconds;

  const start = useCallback((projectId: number) => window.api.timer.start(projectId), []);
  const pause = useCallback(() => window.api.timer.pause(), []);
  const resume = useCallback(() => window.api.timer.resume(), []);
  const stop = useCallback(() => window.api.timer.stop(), []);
  const unfinish = useCallback(() => window.api.timer.unfinish(), []);
  const switchProject = useCallback((projectId: number) => window.api.timer.switchProject(projectId), []);

  return { state, loaded, liveActiveSeconds, liveTodayTotalSeconds, start, pause, resume, stop, unfinish, switchProject };
}
