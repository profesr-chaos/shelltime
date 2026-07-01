import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: 'good' | 'bad' | 'neutral';
  icon?: ReactNode;
}

const deltaClasses: Record<NonNullable<StatCardProps['deltaTone']>, string> = {
  good: 'text-emerald-600',
  bad: 'text-red-500',
  neutral: 'text-slate-500',
};

export function StatCard({ label, value, delta, deltaTone = 'neutral' }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      </div>
      <div className="mt-2 flex items-end justify-between">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {delta && <span className={`text-sm font-medium ${deltaClasses[deltaTone]}`}>{delta}</span>}
      </div>
    </div>
  );
}
