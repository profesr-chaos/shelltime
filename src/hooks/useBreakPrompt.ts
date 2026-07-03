import { useEffect, useState, useCallback } from 'react';

export function useBreakPrompt() {
  const [minutesWorked, setMinutesWorked] = useState<number | null>(null);

  useEffect(() => {
    const offPrompt = window.api.timer.onBreakPrompt((minutes) => setMinutesWorked(minutes));
    // A higher-priority idle/resume prompt dismissed this one — close it (it re-arms on the backend).
    const offDismissed = window.api.timer.onBreakDismissed(() => setMinutesWorked(null));
    return () => {
      offPrompt();
      offDismissed();
    };
  }, []);

  const snooze = useCallback(() => {
    window.api.timer.snoozeBreak();
    setMinutesWorked(null);
  }, []);

  const snoozeFor = useCallback((minutes: number) => {
    window.api.timer.snoozeBreak(minutes);
    setMinutesWorked(null);
  }, []);

  const takeBreak = useCallback(() => {
    window.api.timer.pause();
    window.api.timer.snoozeBreak();
    setMinutesWorked(null);
  }, []);

  return { minutesWorked, snooze, snoozeFor, takeBreak };
}
