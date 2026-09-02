import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountdown } from "./useCountdown";

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at the given remaining seconds", () => {
    const { result } = renderHook(() => useCountdown(300, true));
    expect(result.current).toBe(300);
  });

  it("ticks down once per second while active", () => {
    const { result } = renderHook(() => useCountdown(300, true));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(297);
  });

  it("does not tick while inactive", () => {
    const { result } = renderHook(() => useCountdown(300, false));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(300);
  });

  it("stops ticking when active flips to false mid-session", () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useCountdown(300, active),
      { initialProps: { active: true } },
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(298);

    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(298);
  });

  it("never goes below zero even if the interval outruns the session", () => {
    const { result } = renderHook(() => useCountdown(2, true));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(0);
  });

  it("resyncs immediately when the backend pushes a fresh snapshot value", () => {
    const { result, rerender } = renderHook(
      ({ secs }: { secs: number }) => useCountdown(secs, true),
      { initialProps: { secs: 300 } },
    );
    // Local interpolation drifts down…
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current).toBe(296);

    // …then an authoritative snapshot arrives and wins.
    rerender({ secs: 290 });
    expect(result.current).toBe(290);
  });

  it("continues ticking from the resynced value", () => {
    const { result, rerender } = renderHook(
      ({ secs }: { secs: number }) => useCountdown(secs, true),
      { initialProps: { secs: 300 } },
    );
    rerender({ secs: 290 });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(288);
  });

  it("keeps the locally interpolated value when a rerender repeats the same server value", () => {
    const { result, rerender } = renderHook(
      ({ secs }: { secs: number }) => useCountdown(secs, true),
      { initialProps: { secs: 300 } },
    );
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(297);

    // An unrelated parent rerender passes the same snapshot value again —
    // that's not a fresh authoritative update, so no snap back to 300.
    rerender({ secs: 300 });
    expect(result.current).toBe(297);
  });
});
