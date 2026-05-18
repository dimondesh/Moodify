import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
} from "date-fns";

export function formatShortRelativeTime(
  date: Date | string,
): string | null {
  const then = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(then.getTime())) return null;

  const minutes = differenceInMinutes(new Date(), then);
  if (minutes < 1) return "1m";
  if (minutes < 60) return `${minutes}m`;

  const hours = differenceInHours(new Date(), then);
  if (hours < 24) return `${hours}h`;

  const days = differenceInDays(new Date(), then);
  if (days < 7) return `${days}d`;

  return null;
}
