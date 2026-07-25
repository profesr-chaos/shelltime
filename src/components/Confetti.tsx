import { useEffect, useState } from 'react';

const COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#ec4899'];
const BURSTS = 6;
const PER_BURST = 34;
const DURATION_MS = 2800;
const STAGGER_MS = 110;

interface Piece {
  left: number; // vw
  top: number; // vh
  dx: number; // px
  dy: number; // px, before gravity
  rot: number; // deg
  delay: number; // ms
  color: string;
  size: number; // px
  round: boolean;
}

// ponytail: CSS-animated divs rather than a canvas-confetti dependency. ~120 GPU-composited
// transforms is nothing; reach for a real particle engine only if the physics needs to be convincing.
const makePieces = (): Piece[] =>
  Array.from({ length: BURSTS }).flatMap((_, b) => {
    // Walk the origins left-to-right across the viewport (with a little jitter) so the bursts cover
    // the screen instead of clumping wherever the random numbers happened to land.
    const originX = 12 + ((b + 0.5) * 76) / BURSTS + (Math.random() - 0.5) * 12;
    const originY = 22 + Math.random() * 40;
    const delay = b * STAGGER_MS;
    return Array.from({ length: PER_BURST }, (): Piece => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 140 + Math.random() * 420;
      return {
        left: originX,
        top: originY,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        rot: (Math.random() - 0.5) * 1000,
        delay: delay + Math.random() * 130,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 8 + Math.random() * 9,
        round: Math.random() < 0.35,
      };
    });
  });

/**
 * Full-screen confetti burst. Fires once on mount then calls onDone so the parent can unmount it —
 * remount with a fresh `key` to fire again.
 */
export function Confetti({ onDone }: { onDone: () => void }) {
  const [pieces] = useState(makePieces);

  useEffect(() => {
    const id = setTimeout(onDone, DURATION_MS + BURSTS * STAGGER_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  // No prefers-reduced-motion gate: Chromium reports `reduce` on this machine even with Windows
  // animations enabled, which killed the effect outright. It's a 2.6s flourish the user triggers by
  // hand, so it always plays — put it behind a setting if that ever needs to be opt-out.
  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
      <style>{`
        @keyframes shelltime-confetti {
          0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          65%  { opacity: 1; }
          100% { transform: translate(var(--dx), calc(var(--dy) + 80vh)) rotate(var(--rot)); opacity: 0; }
        }
      `}</style>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${p.left}vw`,
            top: `${p.top}vh`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.5,
            background: p.color,
            borderRadius: p.round ? '9999px' : '1px',
            ['--dx' as string]: `${p.dx}px`,
            ['--dy' as string]: `${p.dy}px`,
            ['--rot' as string]: `${p.rot}deg`,
            animation: `shelltime-confetti ${DURATION_MS}ms cubic-bezier(0.15, 0.6, 0.4, 1) ${p.delay}ms forwards`,
          }}
        />
      ))}
    </div>
  );
}
