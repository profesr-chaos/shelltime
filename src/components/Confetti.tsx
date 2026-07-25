const COLORS = ['#fbbf24', '#f87171', '#34d399', '#60a5fa', '#c084fc', '#f472b6', '#fde68a'];
const SHELLS = 6;
const PER_SHELL = 48;
const SPARK_MS = 1500;
const FLASH_MS = 420;
const STAGGER_MS = 260;

/** How long a full display lasts, so the host window knows when it can hide again. */
export const CONFETTI_TOTAL_MS = SPARK_MS + (SHELLS - 1) * STAGGER_MS + 200;

interface Spark {
  left: number; // vw
  top: number; // vh
  dx: number; // px
  dy: number; // px
  drop: number; // px of droop after the shell has spent itself
  delay: number; // ms
  color: string;
  size: number; // px
}

interface Shell {
  left: number;
  top: number;
  delay: number;
  color: string;
  sparks: Spark[];
}

// ponytail: CSS-animated spans rather than a canvas particle engine. ~240 GPU-composited transforms
// is nothing; reach for a real engine only if the physics needs to be convincing.
const makeShells = (): Shell[] =>
  Array.from({ length: SHELLS }, (_, s): Shell => {
    // Walk the origins left-to-right across the viewport (with a little jitter) so the shells cover
    // the screen instead of clumping wherever the random numbers happened to land.
    const left = 12 + ((s + 0.5) * 76) / SHELLS + (Math.random() - 0.5) * 10;
    // Alternate high/low so the shells fill the screen vertically instead of all going off in a band.
    const top = (s % 2 ? 46 : 22) + Math.random() * 18;
    const delay = s * STAGGER_MS;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const radius = 240 + Math.random() * 230;

    return {
      left,
      top,
      delay,
      color,
      // Evenly spaced angles with only a little jitter — that even spacing is what reads as a
      // firework rather than a random spray.
      sparks: Array.from({ length: PER_SHELL }, (_, i): Spark => {
        const angle = ((i + Math.random() * 0.6) / PER_SHELL) * Math.PI * 2;
        const r = radius * (0.62 + Math.random() * 0.38);
        return {
          left,
          top,
          dx: Math.cos(angle) * r,
          dy: Math.sin(angle) * r,
          drop: 70 + Math.random() * 110,
          delay: delay + Math.random() * 40,
          // Mostly the shell's own colour, with a few stray sparks so it isn't flat.
          color: Math.random() < 0.82 ? color : COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 4 + Math.random() * 4,
        };
      }),
    };
  });

/**
 * Full-screen firework burst. Plays once per mount — remount with a fresh `key` to fire again,
 * and hide/unmount after CONFETTI_TOTAL_MS.
 */
export function Confetti() {
  // Generated during render rather than in state: this component is mounted precisely to play once.
  const shells = makeShells();

  // No prefers-reduced-motion gate: Chromium reports `reduce` on this machine even with Windows
  // animations enabled, which killed the effect outright. It's a 2.5s flourish the user triggers by
  // hand, so it always plays — put it behind a setting if that ever needs to be opt-out.
  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
      <style>{`
        @keyframes shelltime-spark {
          0%   { transform: translate(0, 0) scale(1); opacity: 1; }
          70%  { transform: translate(var(--dx), var(--dy)) scale(0.85); opacity: 1; }
          100% { transform: translate(calc(var(--dx) * 1.06), calc(var(--dy) + var(--drop))) scale(0.25); opacity: 0; }
        }
        @keyframes shelltime-flash {
          0%   { transform: translate(-50%, -50%) scale(0.15); opacity: 0.85; }
          100% { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
        }
      `}</style>
      {shells.map((sh, s) => (
        <div key={s}>
          {/* The blown-out core of the shell — brief, and what sells the "it just exploded" moment. */}
          <span
            style={{
              position: 'absolute',
              left: `${sh.left}vw`,
              top: `${sh.top}vh`,
              width: 150,
              height: 150,
              borderRadius: '9999px',
              background: `radial-gradient(circle, #fff 0%, ${sh.color} 35%, transparent 70%)`,
              animation: `shelltime-flash ${FLASH_MS}ms ease-out ${sh.delay}ms forwards`,
              opacity: 0,
            }}
          />
          {sh.sparks.map((p, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `${p.left}vw`,
                top: `${p.top}vh`,
                width: p.size,
                height: p.size,
                background: p.color,
                borderRadius: '9999px',
                boxShadow: `0 0 ${p.size * 2.5}px ${p.color}`,
                ['--dx' as string]: `${p.dx}px`,
                ['--dy' as string]: `${p.dy}px`,
                ['--drop' as string]: `${p.drop}px`,
                animation: `shelltime-spark ${SPARK_MS}ms cubic-bezier(0.05, 0.75, 0.2, 1) ${p.delay}ms forwards`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
