import { useRef, useState } from 'react';
import snailProgress from '@/assets/snail-progress.png';
import snailPaused from '@/assets/snail-paused.png';

interface ProgressBarProps {
  fraction: number; // 0..1, can exceed 1
  tone?: 'amber' | 'red';
  showSnail?: boolean;
  paused?: boolean;
  onSeek?: (fraction: number) => void; // provide to make the snail draggable
  previewFraction?: number | null; // hold the snail here (e.g. while a follow-up modal is open)
  dragLabel?: (fraction: number) => string; // computes the label shown below the snail while dragging (e.g. "+0:35")
}

export function ProgressBar({
  fraction,
  tone = 'amber',
  showSnail = true,
  paused = false,
  onSeek,
  previewFraction,
  dragLabel,
}: ProgressBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const displayFraction = dragFraction ?? previewFraction ?? fraction;
  const pct = Math.max(0, Math.min(1, displayFraction)) * 100;
  const fillColor = tone === 'red' ? 'bg-red-500' : 'bg-amber';

  const fractionFromPointer = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setDragFraction(fractionFromPointer(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragFraction(fractionFromPointer(e.clientX));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const final = fractionFromPointer(e.clientX);
    setDragging(false);
    setDragFraction(null);
    onSeek?.(final);
  };

  return (
    // Full-width hit area with vertical padding so the thin track is easy to grab.
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`relative w-full py-8 ${onSeek ? 'cursor-ew-resize touch-none select-none' : ''}`}
    >
      <div className="relative h-1 w-full rounded-full bg-slate-100">
        <div
          className={`h-1 rounded-full ${fillColor} ${dragging ? '' : 'transition-all duration-500'}`}
          style={{ width: `${pct}%` }}
        />
        {showSnail && (
          <img
            src={paused ? snailPaused : snailProgress}
            alt=""
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 select-none ${
              paused ? 'h-8 w-8' : 'h-16 w-16'
            }`}
            style={{ left: `${pct}%` }}
          />
        )}
        {dragging && dragLabel && dragFraction !== null && (
          <span
            className="pointer-events-none absolute top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-1.5 py-0.5 text-xs font-semibold text-white"
            style={{ left: `${Math.max(8, Math.min(92, pct))}%` }}
          >
            {dragLabel(dragFraction)}
          </span>
        )}
      </div>
    </div>
  );
}
