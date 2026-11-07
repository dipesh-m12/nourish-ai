import { useEffect, useState } from 'react';

/**
 * True only after `flag` has stayed true for `delayMs`.
 * Stops loaders flashing for requests that finish almost instantly.
 */
export function useDelayedFlag(flag: boolean, delayMs = 200) {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!flag) return;
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [flag, delayMs]);

  return flag && elapsed;
}
