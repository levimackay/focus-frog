import { describe, expect, it } from "vitest";
import { buildSummaryLine } from "./summary";
import type { StatsSummary } from "../../ipc/types";

function stats(overrides: Partial<StatsSummary> = {}): StatsSummary {
  return {
    range: "week",
    sessions_count: 0,
    focused_seconds: 0,
    distractions_defeated: 0,
    completions: 0,
    abandonments: 0,
    current_streak_days: 0,
    longest_streak_days: 0,
    ...overrides,
  };
}

describe("buildSummaryLine", () => {
  it("shows the empty-state line when there are no sessions", () => {
    expect(buildSummaryLine(stats({ sessions_count: 0 }))).toBe(
      "No sessions yet in this range — the frog is waiting by the lily pad.",
    );
  });

  it("uses singular 'session' for exactly one session", () => {
    const line = buildSummaryLine(
      stats({ sessions_count: 1, completions: 1, focused_seconds: 600 }),
    );
    expect(line).toMatch(/^1 session,/);
    expect(line).not.toMatch(/^1 sessions,/);
  });

  it("uses plural 'sessions' for more than one session", () => {
    const line = buildSummaryLine(
      stats({ sessions_count: 3, completions: 2, focused_seconds: 1200 }),
    );
    expect(line).toMatch(/^3 sessions,/);
  });

  it("reports focused time in minutes under one hour", () => {
    const line = buildSummaryLine(
      stats({ sessions_count: 1, completions: 1, focused_seconds: 1800 }),
    );
    expect(line).toContain("30 minutes focused");
  });

  it("reports focused time in hours (one decimal) at or above one hour", () => {
    const line = buildSummaryLine(
      stats({ sessions_count: 2, completions: 2, focused_seconds: 5400 }),
    );
    expect(line).toContain("1.5 hours focused");
  });

  it("switches from minutes to hours exactly at the 3600s boundary", () => {
    const justUnder = buildSummaryLine(
      stats({ sessions_count: 1, completions: 1, focused_seconds: 3599 }),
    );
    const atBoundary = buildSummaryLine(
      stats({ sessions_count: 1, completions: 1, focused_seconds: 3600 }),
    );
    expect(justUnder).toContain("minutes focused");
    expect(atBoundary).toContain("1.0 hours focused");
  });

  it("rounds the completion rate to the nearest whole percent", () => {
    const line = buildSummaryLine(
      stats({ sessions_count: 3, completions: 1, focused_seconds: 600 }),
    );
    // 1/3 = 33.33...% -> rounds to 33%
    expect(line).toContain("33% completed");
  });

  it("omits the streak clause when current_streak_days is 1 or 0", () => {
    const zero = buildSummaryLine(
      stats({ sessions_count: 1, completions: 1, focused_seconds: 600, current_streak_days: 0 }),
    );
    const one = buildSummaryLine(
      stats({ sessions_count: 1, completions: 1, focused_seconds: 600, current_streak_days: 1 }),
    );
    expect(zero).not.toContain("streak");
    expect(one).not.toContain("streak");
  });

  it("appends the streak clause once current_streak_days is 2 or more", () => {
    const line = buildSummaryLine(
      stats({ sessions_count: 5, completions: 5, focused_seconds: 3600, current_streak_days: 4 }),
    );
    expect(line).toContain("You're on a 4-day streak.");
  });
});
