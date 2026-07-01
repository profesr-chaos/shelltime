import { ChevronUpIcon, ChevronDownIcon } from '../icons';

interface DurationInputProps {
  minutes: number;
  onChange: (minutes: number) => void;
  minMinutes?: number;
  maxMinutes?: number;
  minuteStep?: number;
}

export function DurationInput({ minutes, onChange, minMinutes = 0, maxMinutes = 24 * 60, minuteStep = 15 }: DurationInputProps) {
  const total = Math.max(minMinutes, Math.min(maxMinutes, Math.round(minutes)));
  const hours = Math.floor(total / 60);
  const mins = total % 60;

  const setTotal = (next: number) => onChange(Math.max(minMinutes, Math.min(maxMinutes, next)));

  return (
    <div className="flex items-center gap-2">
      <Stepper value={hours} label="h" onIncrement={() => setTotal(total + 60)} onDecrement={() => setTotal(total - 60)} />
      <Stepper value={mins} label="m" onIncrement={() => setTotal(total + minuteStep)} onDecrement={() => setTotal(total - minuteStep)} />
    </div>
  );
}

function Stepper({ value, label, onIncrement, onDecrement }: { value: number; label: string; onIncrement: () => void; onDecrement: () => void }) {
  return (
    <div className="flex items-center rounded-lg border border-slate-200 bg-white">
      <div className="w-14 px-3 py-2 text-right text-sm font-medium tabular-nums text-slate-900">
        {value}
        <span className="ml-1 text-xs font-normal text-slate-400">{label}</span>
      </div>
      <div className="flex flex-col border-l border-slate-200">
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={onIncrement}
          className="px-1.5 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        >
          <ChevronUpIcon width={12} height={12} />
        </button>
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={onDecrement}
          className="border-t border-slate-200 px-1.5 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        >
          <ChevronDownIcon width={12} height={12} />
        </button>
      </div>
    </div>
  );
}
