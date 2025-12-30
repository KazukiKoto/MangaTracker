import { useEffect, useState } from "react";

const DEFAULT_INTERVAL = 60 * 1000;

const sanitizeInterval = (value) => {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return DEFAULT_INTERVAL;
  }
  return value;
};

const useRelativeNow = (intervalMs = DEFAULT_INTERVAL) => {
  const safeInterval = sanitizeInterval(intervalMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, safeInterval);
    return () => {
      window.clearInterval(id);
    };
  }, [safeInterval]);

  return now;
};

export default useRelativeNow;
