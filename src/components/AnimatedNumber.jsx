import { useEffect, useRef, useState } from 'react';

/**
 * Counts up to `value` instead of snapping to it, so a dashboard tile
 * feels like it is filling in rather than blinking into existence.
 *
 * Honours prefers-reduced-motion: those users get the final number at once.
 */
export default function AnimatedNumber({
  value = 0,
  duration = 900,
  suffix = '',
  decimals = 0,
  className = '',
  style,
}) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef(null);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || duration <= 0) {
      fromRef.current = target;
      setDisplay(target);
      return undefined;
    }

    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) return undefined;

    const start = performance.now();
    // Ease-out cubic: quick off the mark, gentle on arrival.
    const ease = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(from + delta * ease(t));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      fromRef.current = target;
    };
  }, [target, duration]);

  const shown = decimals > 0 ? display.toFixed(decimals) : Math.round(display);

  return (
    <span className={className} style={style}>
      {shown}
      {suffix}
    </span>
  );
}
