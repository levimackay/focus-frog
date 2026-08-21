import { useEffect, useRef, useState } from "react";

/**
 * Smoothly ticks a remaining-seconds value down between backend snapshots.
 * The backend only pushes `session:update` on transitions and "once per
 * tick" (ARCHITECTURE.md section 8) which may be coarser than 1s, so we
 * interpolate locally and resync whenever a fresh snapshot value arrives.
 */
export function useCountdown(remainingSecs: number, active: boolean): number {
  const [display, setDisplay] = useState(remainingSecs);
  const lastServerValue = useRef(remainingSecs);

  // Resync whenever the backend gives us a new authoritative value.
  useEffect(() => {
    if (remainingSecs !== lastServerValue.current) {
      lastServerValue.current = remainingSecs;
      setDisplay(remainingSecs);
    }
  }, [remainingSecs]);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setDisplay((d) => Math.max(0, d - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [active]);

  return display;
}
