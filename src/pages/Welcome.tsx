import snailIcon from '@/assets/snail-icon.png';
import { Button } from '@/components/ui/Button';
import { CalendarIcon, GridIcon, PlayIcon } from '@/components/icons';

export function Welcome({ onGetStarted, onSkip }: { onGetStarted: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <img src={snailIcon} alt="" className="h-10 w-10" />
          <h1 className="text-2xl font-bold text-slate-900">Welcome to Shelltime</h1>
        </div>

        <div className="flex flex-col gap-4">
          <Step icon={<PlayIcon width={18} height={18} />} title="Track time per project">
            Start a timer or add time by hand. A floating overlay keeps it above any app.
          </Step>
          <Step icon={<CalendarIcon width={18} height={18} />} title="Book holiday & sick leave">
            Leave counts toward your targets so time off doesn't drag your numbers down.
          </Step>
          <Step icon={<GridIcon width={18} height={18} />} title="See where your time goes">
            The dashboard and monthly export break down hours by project and day.
          </Step>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          First, set your working days, region and daily target in Settings.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={onSkip}>Skip</Button>
          <Button variant="primary" onClick={onGetStarted}>Set up now</Button>
        </div>
      </div>
    </div>
  );
}

function Step({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber">{icon}</span>
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{children}</p>
      </div>
    </div>
  );
}
