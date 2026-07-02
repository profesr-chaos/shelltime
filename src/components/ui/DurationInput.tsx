import { useEffect, useState } from 'react';
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
      <Stepper
        value={hours}
        label="h"
        onCommit={(h) => setTotal(h * 60 + mins)}
        onIncrement={() => setTotal(total + 60)}
        onDecrement={() => setTotal(total - 60)}
      />
      <Stepper
        value={mins}
        label="m"
        onCommit={(m) => setTotal(hours * 60 + m)}
        onIncrement={() => setTotal(total + minuteStep)}
        onDecrement={() => setTotal(total - minuteStep)}
      />
    </div>
  );
}

function Stepper({
  value,
  label,
  onCommit,
  onIncrement,
  onDecrement,
}: {
  value: number;
  label: string;
  onCommit: (value: number) => void;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  // Local text so the user can clear the field and type freely; commit (and re-clamp) on blur/Enter.
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = () => {
    const parsed = parseInt(text, 10);
    if (Number.isNaN(parsed)) setText(String(value));
    else onCommit(parsed);
  };

  return (
    <div className="flex items-center rounded-lg border border-slate-200 bg-white focus-within:border-amber">
      <div className="flex items-center px-3 py-2 text-right text-sm font-medium tabular-nums text-slate-900">
        <input
          type="text"
          inputMode="numeric"
          aria-label={label === 'h' ? 'Hours' : 'Minutes'}
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
          onFocus={(e) => e.target.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            else if (e.key === 'ArrowUp') { e.preventDefault(); onIncrement(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); onDecrement(); }
          }}
          className="w-8 bg-transparent text-right outline-none"
        />
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
