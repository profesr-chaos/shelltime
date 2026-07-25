import { useEffect, useState } from 'react';

const COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#ec4899'];
const BURSTS = 5;
const PER_BURST = 24;
const DURATION_MS = 2600;

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
    const originX = 15 + Math.random() * 70;
    const originY = 20 + Math.random() * 50;
    const delay = b * 130;
    return Array.from({ length: PER_BURST }, (): Piece => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 220;
      return {
        left: originX,
        top: originY,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        rot: (Math.random() - 0.5) * 900,
        delay: delay + Math.random() * 120,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 6,
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
    const id = setTimeout(onDone, DURATION_MS + BURSTS * 130);
    return () => clearTimeout(id);
  }, [onDone]);

  // Respect the OS "reduce motion" setting — a screenful of flying objects is exactly what it means.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
      <style>{`
        @keyframes shelltime-confetti {
          0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--dx), calc(var(--dy) + 70vh)) rotate(var(--rot)); opacity: 0; }
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
