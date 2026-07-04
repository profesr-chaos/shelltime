import { useEffect, useState } from 'react';
import type { MonthlySummary } from '@shared/types';
import { useProjects } from '@/hooks/useProjects';
import { useTimer } from '@/hooks/useTimer';
import { currentMonthStr, shiftMonth, formatMonth, minutesToHhMm, signedMinutesToHhMm, formatDateShort } from '@/lib/format';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { ColorDot } from '@/components/ui/Badge';
import { ChevronLeftIcon, ChevronRightIcon, TrendUpIcon } from '@/components/icons';
import { DonutChart } from '@/components/charts/DonutChart';
import { BarChart } from '@/components/charts/BarChart';
import { EditTimingsModal } from '@/components/EditTimingsModal';
import { LeaveCard } from '@/components/LeaveCard';
import { FinishedForToday } from '@/components/FinishedForToday';

interface DashboardProps {
  onOpenExport?: (month: string) => void;
  onOpenSettings?: () => void;
}

export function Dashboard({ onOpenExport, onOpenSettings }: DashboardProps) {
  const [month, setMonth] = useState(currentMonthStr());
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const { projects } = useProjects();
  const { state, stop, start } = useTimer();
  const [editDate, setEditDate] = useState<string | null>(null);

  const load = () => window.api.dashboard.getMonthlySummary(month).then(setSummary);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  if (!summary) return null;

  const efficiencyPct = summary.targetMinutes > 0 ? Math.round((summary.actualMinutes / summary.targetMinutes) * 100) : 0;
  const overtimeDeltaMinutes = summary.thisMonthOvertimeMinutes - summary.lastMonthOvertimeMinutes;
  const overtimeDeltaPct = overtimeDeltaMinutes / 60;
  const overtimeDeltaPctLabel = `${overtimeDeltaPct >= 0 ? '+' : ''}${overtimeDeltaPct.toFixed(1)}%`;

  const donutSegments = [
    ...summary.byProject.map((bp) => ({ label: bp.project.code, minutes: bp.minutes, color: bp.project.color })),
    { label: 'Remaining', minutes: Math.max(0, summary.targetMinutes - summary.actualMinutes), color: '#E2E8F0' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <ChevronLeftIcon />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">{formatMonth(month)}</h1>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <ChevronRightIcon />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <FinishedForToday
            finished={state.status === 'idle'}
            projects={projects}
            onStop={stop}
            onResume={start}
          />
          <Button variant="secondary" onClick={() => onOpenExport?.(month)}>Export</Button>
          <Button variant="secondary" onClick={onOpenSettings}>Settings</Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4">
        <StatCard label="Monthly Target" value={minutesToHhMm(summary.targetMinutes)} />
        <StatCard
          label="Actual Tracked"
          value={minutesToHhMm(summary.actualMinutes)}
          delta={signedMinutesToHhMm(summary.actualMinutes - summary.targetMinutes)}
          deltaTone={summary.actualMinutes >= summary.targetMinutes ? 'good' : 'bad'}
        />
        <StatCard
          label="Efficiency"
          value={`${efficiencyPct}%`}
          delta={overtimeDeltaPctLabel}
          deltaTone={overtimeDeltaMinutes >= 0 ? 'good' : 'bad'}
        />
        <StatCard label="Last Month" value={minutesToHhMm(summary.lastMonthActualMinutes)} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-base font-bold text-slate-900">Hours by Project</h2>
          <DonutChart
            segments={donutSegments}
            centerTop={`${minutesToHhMm(summary.actualMinutes)} / ${minutesToHhMm(summary.targetMinutes)}`}
            centerBottom="tracked / target"
          />
          <div className="mt-6 flex flex-col gap-2">
            {donutSegments.map((seg) => (
              <div key={seg.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <ColorDot color={seg.color} />
                  <span className={seg.label === 'Remaining' ? 'text-slate-400' : 'font-medium text-slate-700'}>{seg.label}</span>
                </span>
                <span className="text-slate-500">{minutesToHhMm(seg.minutes)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-base font-bold text-slate-900">Daily Totals (working days)</h2>
          <BarChart data={summary.dailyTotals} targetMinutes={summary.dailyTotals[0]?.targetMinutes ?? 480} onBarClick={setEditDate} />
          {overtimeDeltaMinutes !== 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <TrendUpIcon className="text-emerald-600" width={16} height={16} />
              <span>
                <span className="font-semibold"></span> You worked {minutesToHhMm(Math.abs(overtimeDeltaMinutes))}{' '}
                {overtimeDeltaMinutes > 0 ? 'more' : 'less'} than last month.
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-5 gap-4">
        <InsightCard label="Most-worked project" value={summary.insights.mostWorkedProject?.code ?? '—'} />
        <InsightCard label="Busiest day" value={summary.insights.busiestDay ? formatDateShort(summary.insights.busiestDay) : '—'} />
        <InsightCard label="Quietest day" value={summary.insights.quietestDay ? formatDateShort(summary.insights.quietestDay) : '—'} />
        <InsightCard label="Project switches" value={String(summary.insights.projectSwitches)} />
        <InsightCard label="Avg / working day" value={minutesToHhMm(summary.insights.averageMinutesPerWorkingDay)} />
      </div>

      <div className="mt-6">
        <LeaveCard month={month} onChanged={load} />
      </div>

      {editDate && (
        <EditTimingsModal
          date={editDate}
          projects={projects}
          onClose={() => setEditDate(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}
