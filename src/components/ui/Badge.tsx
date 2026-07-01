import type { ReactNode } from 'react';

type Tone = 'green' | 'amber' | 'red' | 'slate';

const toneClasses: Record<Tone, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-600',
};

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

export function ColorDot({ color, className = '' }: { color: string; className?: string }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} style={{ backgroundColor: color }} />;
}
