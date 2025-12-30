const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const WEEK_MS = 7 * 24 * HOUR_MS;

const coerceDate = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDetectionAge = (input) => {
  const detected = coerceDate(input);
  if (!detected) {
    return "Detected recently";
  }
  const now = Date.now();
  let diff = now - detected.getTime();
  if (diff < MINUTE_MS) {
    return "Detected 1 min ago";
  }
  const minutes = Math.max(1, Math.floor(diff / MINUTE_MS));
  if (minutes < 60) {
    return `Detected ${minutes} min ago`;
  }
  const hours = Math.max(1, Math.floor(diff / HOUR_MS));
  if (hours < 24) {
    return `Detected ${hours} hr${hours === 1 ? "" : "s"} ago`;
  }
  const weeks = Math.max(1, Math.floor(diff / WEEK_MS));
  if (weeks <= 10) {
    return `Detected ${weeks} wk${weeks === 1 ? "" : "s"} ago`;
  }
  return "Detected 10+ wks ago";
};
