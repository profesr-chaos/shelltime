import type { MonthlyDailyTotal } from '@shared/types';
import { minutesToHhMm } from '@/lib/format';

interface BarChartProps {
  data: MonthlyDailyTotal[];
  targetMinutes: number;
  onBarClick?: (date: string) => void;
}

const HEIGHT = 220;

// Leave days are booked at target under the HOLIDAY/SICK pseudo-projects — sick wins over holiday,
// and leave coloring wins over the under-target red/amber logic (a booked leave day is "met" by
// construction anyway). ponytail: no stacked/segmented bars for a half-day-leave-plus-work mix.
function barColorClass(d: MonthlyDailyTotal): string {
  if (d.projectCodes.includes('SICK')) return 'bg-[#F43F5E]';
  if (d.projectCodes.includes('HOLIDAY')) return 'bg-[#0EA5E9]';
  return d.status === 'under' ? 'bg-red-400' : 'bg-amber';
}

export function BarChart({ data, targetMinutes, onBarClick }: BarChartProps) {
  const maxScale = Math.max(...data.map((d) => d.minutes), targetMinutes, 1) * 1.15;
  const targetLineFromBottom = (targetMinutes / maxScale) * 100;

  return (
    <div className="relative" style={{ height: HEIGHT }}>
      {targetMinutes > 0 && (
        <div
          className="absolute inset-x-0 border-t border-dashed border-slate-300"
          style={{ bottom: `${targetLineFromBottom}%` }}
        >
          <span className="absolute -top-4 left-0 text-[10px] text-slate-400">{minutesToHhMm(targetMinutes)} target</span>
        </div>
      )}
      <div className="flex h-full items-end gap-1.5">
        {data.map((d) => {
          const heightPct = Math.max(2, (d.minutes / maxScale) * 100);
          // A non-working day with no tracked time is just a grey band, not clickable; if there's
          // tracked time it's still clickable so weekend work can be edited like any other day.
          const clickable = !!onBarClick && (d.isWorkingDay || d.minutes > 0);
          return (
            <div key={d.date} className="relative flex-1 self-stretch">
              {!d.isWorkingDay && <div className="absolute inset-x-0 bottom-0 h-full rounded-none bg-slate-100" />}
              {(d.isWorkingDay || d.minutes > 0) && (
                <button
                  disabled={!clickable}
                  onClick={() => clickable && onBarClick?.(d.date)}
                  title={`${d.date}: ${minutesToHhMm(d.minutes)}`}
                  className={`absolute inset-x-0 bottom-0 transition-opacity ${d.isWorkingDay ? 'rounded-t' : ''} ${barColorClass(d)} ${
                    clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
