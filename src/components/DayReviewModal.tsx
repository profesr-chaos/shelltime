import { useDayReview } from '@/hooks/useDayReview';
import { minutesToHhMm, signedMinutesToHhMm } from '@/lib/format';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { ColorDot } from './ui/Badge';

export function DayReviewModal() {
  const { review, dismiss } = useDayReview();

  if (!review) return null;

  const delta = review.totalMinutes - review.targetMinutes;

  return (
    <Modal
      title={`Today · ${minutesToHhMm(review.totalMinutes)} tracked`}
      subtitle={review.targetMinutes > 0 ? `${signedMinutesToHhMm(delta)} vs ${minutesToHhMm(review.targetMinutes)} target` : 'Non-working day'}
      onClose={dismiss}
      footer={
        <Button variant="primary" onClick={dismiss}>
          {review.quitting ? 'Quit Shelltime' : 'Close'}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        {review.byProject.length === 0 && <p className="text-sm text-slate-400">Nothing tracked today.</p>}
        {review.byProject.map((p) => (
          <div key={p.code} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <ColorDot color={p.color} />
              <span className="font-medium text-slate-700">{p.code}</span>
              <span className="text-slate-400">{p.name}</span>
            </span>
            <span className="text-slate-600">{minutesToHhMm(p.minutes)}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
