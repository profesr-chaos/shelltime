import { useEffect, useState } from 'react';
import type { DayReview } from '@shared/types';

// Subscribes to the end-of-day review card broadcast (item 13). Shared by the main window modal
// and the overlay's compact card so both react to the same review:show/review:dismissed events.
export function useDayReview() {
  const [review, setReview] = useState<DayReview | null>(null);

  useEffect(() => {
    const offShow = window.api.review.onShow(setReview);
    const offDismissed = window.api.review.onDismissed(() => setReview(null));
    return () => {
      offShow();
      offDismissed();
    };
  }, []);

  return { review, dismiss: () => window.api.review.dismiss() };
}
