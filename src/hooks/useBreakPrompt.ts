import { useEffect, useState, useCallback } from 'react';

export function useBreakPrompt() {
  const [minutesWorked, setMinutesWorked] = useState<number | null>(null);

  useEffect(() => {
    return window.api.timer.onBreakPrompt((minutes) => setMinutesWorked(minutes));
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
