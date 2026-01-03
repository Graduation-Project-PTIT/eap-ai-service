/**
 * Time-related utility functions
 */

/**
 * Calculate human-readable time ago string from a date
 */
export function getTimeAgo(date: Date | null): string {
  if (!date) return "recently";
  const seconds = Math.floor(
    (new Date().getTime() - new Date(date).getTime()) / 1000
  );

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
