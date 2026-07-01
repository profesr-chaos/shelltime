import { useEffect, useState } from 'react';
import type { MonthlySummary, Note, Project } from '@shared/types';
import { formatMonth, minutesToHoursLabel, signedHoursLabel, formatDateShort } from '@/lib/format';

type NoteWithProject = Note & { project: Project };

export function PrintReport({ month }: { month: string }) {
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [notes, setNotes] = useState<NoteWithProject[]>([]);
  const [exportedAt] = useState(() => new Date());

  useEffect(() => {
    Promise.all([window.api.dashboard.getMonthlySummary(month), window.api.notes.listForMonth(month)]).then(
      ([s, n]) => {
        setSummary(s);
        setNotes(n);
      }
    );
  }, [month]);

  if (!summary) {
    return <div className="p-10 text-slate-500">Loading report for {month}…</div>;
  }

  const daysWithNotes = new Map<string, NoteWithProject[]>();
  for (const n of notes) daysWithNotes.set(n.date, [...(daysWithNotes.get(n.date) ?? []), n]);

  return (
    <div className="mx-auto max-w-3xl bg-white px-10 py-10 text-slate-900">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold">Shelltime — Monthly Report</h1>
        <p className="mt-1 text-lg text-slate-600">{formatMonth(month)}</p>
        <p className="mt-1 text-xs text-slate-400">Exported {exportedAt.toLocaleString()}</p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Summary</h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            <Row label="Target hours" value={minutesToHoursLabel(summary.targetMinutes)} />
            <Row label="Actual hours" value={minutesToHoursLabel(summary.actualMinutes)} />
            <Row label="This month overtime" value={signedHoursLabel(summary.thisMonthOvertimeMinutes)} />
            <Row label="Last month overtime" value={signedHoursLabel(summary.lastMonthOvertimeMinutes)} />
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Hours by Project</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-400">
              <th className="py-2">Project code</th>
              <th>Project name</th>
              <th className="text-right">Hours</th>
              <th className="text-right">Notes</th>
            </tr>
          </thead>
          <tbody>
            {summary.byProject.map((bp) => (
              <tr key={bp.project.id} className="border-b border-slate-100">
                <td className="py-2 font-medium">{bp.project.code}</td>
                <td>{bp.project.name}</td>
                <td className="text-right">{(bp.minutes / 60).toFixed(1)}</td>
                <td className="text-right">{notes.filter((n) => n.projectId === bp.project.id).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Daily Breakdown</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-400">
              <th className="py-2">Date</th>
              <th className="text-right">Total hours</th>
              <th>Projects</th>
              <th>Target status</th>
            </tr>
          </thead>
          <tbody>
            {summary.dailyTotals.map((d) => (
              <tr key={d.date} className="border-b border-slate-100">
                <td className="py-2">{formatDateShort(d.date)}</td>
                <td className="text-right">{(d.minutes / 60).toFixed(1)}</td>
                <td>{[...new Set(d.projectCodes)].join(', ') || '—'}</td>
                <td className="capitalize">{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Notes</h2>
        {daysWithNotes.size === 0 && <p className="text-sm text-slate-400">No notes recorded this month.</p>}
        <div className="flex flex-col gap-4">
          {[...daysWithNotes.entries()].map(([date, dayNotes]) => (
            <div key={date}>
              <p className="text-sm font-semibold">{formatDateShort(date)}</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">
                {dayNotes.map((n) => (
                  <li key={n.id}>
                    <span className="font-medium text-slate-800">{n.project.code}:</span> {n.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 text-slate-500">{label}</td>
      <td className="py-2 text-right font-semibold">{value}</td>
    </tr>
  );
}
