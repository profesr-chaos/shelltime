import snailProgress from '@/assets/snail-progress.png';
import snailPaused from '@/assets/snail-paused.png';

interface ProgressBarProps {
  fraction: number; // 0..1, can exceed 1
  tone?: 'amber' | 'red';
  showSnail?: boolean;
  paused?: boolean;
}

export function ProgressBar({ fraction, tone = 'amber', showSnail = true, paused = false }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  const fillColor = tone === 'red' ? 'bg-red-500' : 'bg-amber';

  return (
    <div className="relative h-2 w-full rounded-full bg-slate-100">
      <div className={`h-1 rounded-full ${fillColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
      {showSnail && (
        <img
          src={paused ? snailPaused : snailProgress}
          alt=""
          className={
            paused ?            
            "absolute top-1/2 h-8 w-8 -translate-y-1/2 -translate-x-1/2 select-none"
          : "absolute top-1/2 h-16 w-16 -translate-y-1/2 -translate-x-1/2 select-none"}
          style={{ left: `${pct}%` }}
        />
      )}
    </div>
  );
}
