import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

import SessionHud from "./SessionHud";
import { useSessionStore } from "../../stores/sessionStore";
import { useCompanionStore } from "../../stores/companionStore";
import type { SessionSnapshot } from "../../ipc/types";

function snapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    id: "s1",
    state: "Focused",
    escalation_level: 0,
    goal: "Write the quarterly report",
    success_criteria: "Sent to Maya",
    remaining_secs: 125,
    distraction_count: 2,
    intervention_count: 0,
    started_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("SessionHud", () => {
  beforeEach(() => {
    useSessionStore.setState({ snapshot: null, phase: "none", starting: false, error: null });
    useCompanionStore.setState({
      profile: null,
      mood: "idle",
      bubble: null,
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing without a session snapshot", () => {
    const { container } = render(<SessionHud reducedMotion onOpenSettings={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the remaining time from the session snapshot as MM:SS", () => {
    useSessionStore.setState({ snapshot: snapshot({ remaining_secs: 125 }), phase: "active" });
    render(<SessionHud reducedMotion onOpenSettings={() => {}} />);
    expect(screen.getByText("02:05")).toBeInTheDocument();
  });

  it("renders the goal and distraction/intervention counters", () => {
    useSessionStore.setState({
      snapshot: snapshot({
        goal: "Write the quarterly report",
        distraction_count: 3,
        intervention_count: 1,
      }),
      phase: "active",
    });
    render(<SessionHud reducedMotion onOpenSettings={() => {}} />);
    expect(screen.getByText("Write the quarterly report")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("hides the frog and shows a note when the visibility toggle is used", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    useSessionStore.setState({ snapshot: snapshot(), phase: "active" });
    render(<SessionHud reducedMotion onOpenSettings={() => {}} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /hide frog/i }));
    expect(screen.getByText(/frog is hidden/i)).toBeInTheDocument();
  });
});
