interface CalendarProps {
  month: string; // YYYY-MM to display
  rangeStart: string | null;
  rangeEnd: string | null; // confirmed or hovered end
  marked?: Set<string>; // dates already booked (highlighted)
  onDayClick: (date: string) => void;
  onDayHover: (date: string | null) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');

export function Calendar({ month, rangeStart, rangeEnd, marked, onDayClick, onDayHover }: CalendarProps) {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const leading = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday-first offset
  const isWeekend = (d: number) => {
    const wd = new Date(y, m - 1, d).getDay();
    return wd === 0 || wd === 6;
  };

  const lo = rangeStart && rangeEnd ? (rangeStart <= rangeEnd ? rangeStart : rangeEnd) : rangeStart;
  const hi = rangeStart && rangeEnd ? (rangeStart <= rangeEnd ? rangeEnd : rangeStart) : rangeStart;

  const cells: (number | null)[] = [...Array(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div onMouseLeave={() => onDayHover(null)}>
      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} />;
          const date = `${month}-${pad(d)}`;
          const inRange = !!lo && !!hi && date >= lo && date <= hi;
          const isEndpoint = date === rangeStart || date === rangeEnd;
          const isMarked = marked?.has(date);

          let cls = 'text-slate-700 hover:bg-slate-100';
          if (isWeekend(d)) cls = 'text-slate-300 hover:bg-slate-100';
          if (isMarked) cls = 'bg-amber-50 font-semibold text-amber-700 hover:bg-amber-100';
          if (inRange) cls = 'bg-amber-100 text-amber-900';
          if (isEndpoint) cls = 'bg-amber font-semibold text-white';

          return (
            <button
              key={date}
              onClick={() => onDayClick(date)}
              onMouseEnter={() => onDayHover(date)}
              className={`flex h-9 items-center justify-center rounded-md text-sm transition-colors ${cls}`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
