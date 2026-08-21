import type { StatsSummary } from "../../ipc/types";

/**
 * Builds the one-line "Frog Report" summary strictly from real numbers in
 * `StatsSummary` — never invent a claim the data doesn't support.
 */
export function buildSummaryLine(stats: StatsSummary): string {
  if (stats.sessions_count === 0) {
    return "No sessions yet in this range — the frog is waiting by the lily pad.";
  }

  const completionRate = Math.round((stats.completions / stats.sessions_count) * 100);
  const hours = stats.focused_seconds / 3600;
  const hoursText =
    hours >= 1 ? `${hours.toFixed(1)} hours` : `${Math.round(stats.focused_seconds / 60)} minutes`;

  const streakText =
    stats.current_streak_days > 1 ? ` You're on a ${stats.current_streak_days}-day streak.` : "";

  return `${stats.sessions_count} session${stats.sessions_count === 1 ? "" : "s"}, ${hoursText} focused, ${completionRate}% completed.${streakText}`;
}
