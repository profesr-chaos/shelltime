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
  const now = useNowTick(1000);

  useEffect(() => {
    window.api.timer.getState().then(setState);
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
  const switchProject = useCallback((projectId: number) => window.api.timer.switchProject(projectId), []);

  return { state, liveActiveSeconds, liveTodayTotalSeconds, start, pause, resume, stop, switchProject };
}
