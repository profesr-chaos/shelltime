import type { MonthlyDailyTotal } from '@shared/types';

interface BarChartProps {
  data: MonthlyDailyTotal[];
  targetMinutes: number;
  onBarClick?: (date: string) => void;
}

const HEIGHT = 220;

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
          <span className="absolute -top-4 left-0 text-[10px] text-slate-400">{(targetMinutes / 60).toFixed(0)}h target</span>
        </div>
      )}
      <div className="flex h-full items-end gap-1.5">
        {data.map((d) => {
          const heightPct = Math.max(2, (d.minutes / maxScale) * 100);
          const isUnder = d.status === 'under';
          const clickable = isUnder && !!onBarClick;
          return (
            <button
              key={d.date}
              disabled={!clickable}
              onClick={() => clickable && onBarClick?.(d.date)}
              title={`${d.date}: ${(d.minutes / 60).toFixed(1)}h`}
              className={`group flex-1 rounded-t transition-opacity ${isUnder ? 'bg-red-400' : 'bg-amber'} ${
                clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
              }`}
              style={{ height: `${heightPct}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
