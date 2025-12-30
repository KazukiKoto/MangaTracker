const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

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

export const formatDetectionAge = (input, nowMs = Date.now()) => {
  const detected = coerceDate(input);
  if (!detected) {
    return "Moments ago";
  }
  const referenceNow = Number.isFinite(nowMs) ? nowMs : Date.now();
  const diff = Math.max(0, referenceNow - detected.getTime());
  if (diff < MINUTE_MS) {
    return "Just now";
  }
  const minutes = Math.max(1, Math.floor(diff / MINUTE_MS));
  if (minutes < 60) {
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.max(1, Math.floor(diff / HOUR_MS));
  if (hours < 24) {
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.max(1, Math.floor(diff / DAY_MS));
  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  const weeks = Math.max(1, Math.floor(diff / WEEK_MS));
  if (weeks <= 10) {
    return `${weeks} wk${weeks === 1 ? "" : "s"} ago`;
  }
  return "10+ wks ago";
};
