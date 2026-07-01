import { useEffect, useState } from 'react';
import type { MonthlySummary } from '@shared/types';
import { formatMonth, minutesToHoursLabel, signedHoursLabel } from '@/lib/format';

const hoursCell = (minutes: number): string => (minutes > 0 ? (minutes / 60).toFixed(1) : '');

export function PrintReport({ month }: { month: string }) {
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [exportedAt] = useState(() => new Date());

  useEffect(() => {
    window.api.dashboard.getMonthlySummary(month).then(setSummary);
  }, [month]);

  if (!summary) {
    return <div className="p-10 text-slate-500">Loading report for {month}…</div>;
  }

  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const dateStr = (d: number) => `${month}-${String(d).padStart(2, '0')}`;
  const isWeekend = (d: number) => {
    const wd = new Date(y, m - 1, d).getDay();
    return wd === 0 || wd === 6;
  };

  // Column (per-day) totals across all projects.
  const dayTotals = new Map<string, number>();
  for (const row of summary.grid) {
    for (const [date, minutes] of Object.entries(row.minutesByDate)) {
      dayTotals.set(date, (dayTotals.get(date) ?? 0) + minutes);
    }
  }

  const isOvertime = summary.thisMonthOvertimeMinutes >= 0;

  return (
    <div className="w-full bg-white px-8 py-8 text-slate-900">
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>

      <header className="mb-6 flex items-end justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold">Shelltime — Monthly Report</h1>
          <p className="mt-0.5 text-base text-slate-600">{formatMonth(month)}</p>
        </div>
        <p className="text-[10px] text-slate-400">Exported {exportedAt.toLocaleString()}</p>
      </header>

      <table className="w-full border-collapse text-center text-[9px] leading-tight">
        <thead>
          <tr className="border-b-2 border-slate-300">
            <th className="sticky left-0 bg-white px-1 py-1 text-left text-[10px] font-bold">Project</th>
            {days.map((d) => (
              <th key={d} className={`px-0.5 py-1 font-semibold ${isWeekend(d) ? 'bg-slate-100 text-slate-400' : 'text-slate-500'}`}>
                {d}
              </th>
            ))}
            <th className="px-1 py-1 text-[10px] font-bold">Total</th>
          </tr>
        </thead>
        <tbody>
          {summary.grid.length === 0 && (
            <tr>
              <td colSpan={days.length + 2} className="py-4 text-slate-400">No tracked time this month.</td>
            </tr>
          )}
          {summary.grid.map((row) => (
            <tr key={row.project.id} className="border-b border-slate-100">
              <td className="sticky left-0 bg-white px-1 py-1 text-left">
                <span className="font-bold" style={{ color: row.project.color }}>{row.project.code}</span>
                <span className="ml-1 text-slate-400">{row.project.name}</span>
              </td>
              {days.map((d) => {
                const mins = row.minutesByDate[dateStr(d)] ?? 0;
                return (
                  <td key={d} className={`px-0.5 py-1 tabular-nums ${isWeekend(d) ? 'bg-slate-50' : ''} ${mins > 0 ? 'text-slate-800' : 'text-slate-200'}`}>
                    {hoursCell(mins) || '·'}
                  </td>
                );
              })}
              <td className="px-1 py-1 font-bold tabular-nums">{(row.totalMinutes / 60).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-bold">
            <td className="sticky left-0 bg-white px-1 py-1 text-left text-[10px]">Total</td>
            {days.map((d) => {
              const mins = dayTotals.get(dateStr(d)) ?? 0;
              return (
                <td key={d} className={`px-0.5 py-1 tabular-nums ${isWeekend(d) ? 'bg-slate-100' : ''} ${mins > 0 ? '' : 'text-slate-300'}`}>
                  {hoursCell(mins) || '·'}
                </td>
              );
            })}
            <td className="px-1 py-1 tabular-nums">{(summary.actualMinutes / 60).toFixed(1)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-2 text-[9px] text-slate-400">Hours worked per project per day. Weekend columns are shaded.</p>

      <section className="mt-6 grid grid-cols-3 gap-4">
        <Kpi label="Total hours worked" value={minutesToHoursLabel(summary.actualMinutes)} />
        <Kpi label="Target hours" value={minutesToHoursLabel(summary.targetMinutes)} />
        <Kpi
          label="Overtime"
          value={signedHoursLabel(summary.thisMonthOvertimeMinutes)}
          valueClass={isOvertime ? 'text-emerald-600' : 'text-red-500'}
        />
      </section>
    </div>
  );
}

function Kpi({ label, value, valueClass = 'text-slate-900' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
