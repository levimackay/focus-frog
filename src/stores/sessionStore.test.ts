import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionSnapshot } from "../ipc/types";

const startSession = vi.fn();
const getActiveSession = vi.fn();
const abandonSession = vi.fn();

vi.mock("../ipc/commands", () => ({
  session: {
    startSession: (...args: unknown[]) => startSession(...args),
    getActiveSession: (...args: unknown[]) => getActiveSession(...args),
    abandonSession: (...args: unknown[]) => abandonSession(...args),
    acknowledgeIntervention: vi.fn(),
    submitJournal: vi.fn(),
    emergencyExit: vi.fn(),
  },
}));

import { useSessionStore } from "./sessionStore";

function snapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    id: "s1",
    state: "Focused",
    escalation_level: 0,
    goal: "Write tests",
    success_criteria: "Tests pass",
    remaining_secs: 1200,
    distraction_count: 0,
    intervention_count: 0,
    started_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.setState({ snapshot: null, phase: "none", starting: false, error: null });
    startSession.mockReset();
    getActiveSession.mockReset();
    abandonSession.mockReset();
  });

  it("starts in the 'none' phase", () => {
    expect(useSessionStore.getState().phase).toBe("none");
  });

  it("moves to the 'active' phase after a successful start", async () => {
    startSession.mockResolvedValue(snapshot({ state: "Focused" }));
    await useSessionStore.getState().start({
      goal: "g",
      success_criteria: "s",
      duration_secs: 600,
      annoyance_profile: "gentle",
    });
    expect(useSessionStore.getState().phase).toBe("active");
    expect(useSessionStore.getState().snapshot?.id).toBe("s1");
  });

  it("captures an error and does not crash when start rejects", async () => {
    startSession.mockRejectedValue(new Error("backend not ready"));
    await useSessionStore.getState().start({
      goal: "g",
      success_criteria: "s",
      duration_secs: 600,
      annoyance_profile: "gentle",
    });
    expect(useSessionStore.getState().error).toBe("backend not ready");
    expect(useSessionStore.getState().phase).toBe("none");
  });

  it("derives the 'intervention' phase from FocusState.Intervention", () => {
    useSessionStore
      .getState()
      .applySnapshot(snapshot({ state: "Intervention", escalation_level: 3 }));
    expect(useSessionStore.getState().phase).toBe("intervention");
  });

  it("derives the 'completed' phase from FocusState.Completed", () => {
    useSessionStore.getState().applySnapshot(snapshot({ state: "Completed", remaining_secs: 0 }));
    expect(useSessionStore.getState().phase).toBe("completed");
  });

  it("derives the 'abandoned' phase from FocusState.Abandoned", () => {
    useSessionStore.getState().applySnapshot(snapshot({ state: "Abandoned" }));
    expect(useSessionStore.getState().phase).toBe("abandoned");
  });

  it("treats Distracted/Ignored/Recovering as 'active'", () => {
    useSessionStore.getState().applySnapshot(snapshot({ state: "Distracted" }));
    expect(useSessionStore.getState().phase).toBe("active");
    useSessionStore.getState().applySnapshot(snapshot({ state: "Ignored" }));
    expect(useSessionStore.getState().phase).toBe("active");
    useSessionStore.getState().applySnapshot(snapshot({ state: "Recovering" }));
    expect(useSessionStore.getState().phase).toBe("active");
  });

  it("resets to 'none' with reset()", () => {
    useSessionStore.getState().applySnapshot(snapshot({ state: "Completed" }));
    useSessionStore.getState().reset();
    expect(useSessionStore.getState().phase).toBe("none");
    expect(useSessionStore.getState().snapshot).toBeNull();
  });

  it("abandon() calls the IPC layer and updates state to abandoned", async () => {
    abandonSession.mockResolvedValue(snapshot({ state: "Abandoned" }));
    await useSessionStore.getState().abandon();
    expect(abandonSession).toHaveBeenCalledOnce();
    expect(useSessionStore.getState().phase).toBe("abandoned");
  });
});
