import { useCallback, useRef } from 'react';

const DRAG_THRESHOLD = 4; // px of movement before a press counts as a drag rather than a click

// Lets the whole overlay be dragged from any element: a press that moves > threshold repositions the
// window; a press that doesn't move stays a normal click, so buttons still work.
// ponytail: sends a setPosition IPC per mousemove; fine at overlay scale, batch/throttle if it ever lags.
export function useOverlayDrag() {
  const drag = useRef<{ startX: number; startY: number; winX: number; winY: number; moved: boolean } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Frameless window: its screen origin is the cursor's screen pos minus its pos within the content.
    drag.current = {
      startX: e.screenX,
      startY: e.screenY,
      winX: e.screenX - e.clientX,
      winY: e.screenY - e.clientY,
      moved: false,
    };

    const onMove = (ev: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = ev.screenX - d.startX;
      const dy = ev.screenY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      d.moved = true;
      window.api.overlay.setPosition(d.winX + dx, d.winY + dy);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp, true);
      // If it was a drag, swallow the click that fires next so buttons under the cursor don't trigger.
      if (drag.current?.moved) {
        const swallow = (ce: MouseEvent) => {
          ce.stopPropagation();
          ce.preventDefault();
        };
        window.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', swallow, true), 300);
      }
      drag.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, true);
  }, []);

  return { onMouseDown };
}
