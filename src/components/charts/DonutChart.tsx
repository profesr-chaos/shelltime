interface Segment {
  label: string;
  minutes: number;
  color: string;
}

interface DonutChartProps {
  segments: Segment[];
  centerTop: string;
  centerBottom: string;
}

const SIZE = 220;
const STROKE = 28;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({ segments, centerTop, centerBottom }: DonutChartProps) {
  const total = segments.reduce((s, seg) => s + seg.minutes, 0) || 1;
  let cumulative = 0;

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#E2E8F0" strokeWidth={STROKE} />
        {segments.map((seg, i) => {
          const fraction = seg.minutes / total;
          const dash = fraction * CIRCUMFERENCE;
          const offset = -((cumulative / total) * CIRCUMFERENCE);
          cumulative += seg.minutes;
          if (seg.minutes <= 0) return null;
          return (
            <circle
              key={i}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-slate-900">{centerTop}</span>
        <span className="text-xs text-slate-400">{centerBottom}</span>
      </div>
    </div>
  );
}
