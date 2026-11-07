import { useCallback, useEffect, useRef } from 'react';

interface Options {
  /** Wait before auto-repeat starts, so a normal tap is still exactly one step. */
  delay?: number;
  /** First repeat interval; it shortens while held, down to `minInterval`. */
  interval?: number;
  minInterval?: number;
}

/**
 * Press-and-hold auto-repeat (like a stepper or keyboard key).
 * `step` runs once on press-in, then repeatedly while held, accelerating.
 * It returns false when it can't go further (e.g. hit max), which stops the repeat.
 */
export function usePressRepeat(
  step: () => boolean,
  { delay = 400, interval = 120, minInterval = 40 }: Options = {},
) {
  const stepRef = useRef(step);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(() => {
    stop();
    if (!stepRef.current()) return;
    let wait = interval;
    const tick = () => {
      if (!stepRef.current()) return stop();
      wait = Math.max(minInterval, wait * 0.85); // speeds up the longer you hold
      timer.current = setTimeout(tick, wait);
    };
    timer.current = setTimeout(tick, delay);
  }, [stop, delay, interval, minInterval]);

  useEffect(() => stop, [stop]); // never leave a timer running after unmount

  return { onPressIn: start, onPressOut: stop };
}
