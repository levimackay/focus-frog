import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InterventionOverlay from "./InterventionOverlay";

function renderOverlay(overrides: Partial<Parameters<typeof InterventionOverlay>[0]> = {}) {
  const onAcknowledge = vi.fn();
  const onEmergencyExit = vi.fn();
  const utils = render(
    <InterventionOverlay
      goal="Write the report"
      escalationLevel={3}
      emergencyHotkey="CommandOrControl+Shift+Escape"
      reducedMotion
      onAcknowledge={onAcknowledge}
      onEmergencyExit={onEmergencyExit}
      {...overrides}
    />,
  );
  return { ...utils, onAcknowledge, onEmergencyExit };
}

describe("InterventionOverlay -- the 'never trap the user' safety guarantees", () => {
  it("moves focus to the emergency exit button on mount, per the WAI-ARIA alertdialog pattern", () => {
    renderOverlay();
    expect(screen.getByRole("button", { name: /emergency exit/i })).toHaveFocus();
  });

  it("calls onEmergencyExit when Escape is pressed, from anywhere -- not just while the button is focused", async () => {
    const { onEmergencyExit } = renderOverlay();
    const user = userEvent.setup();
    await user.keyboard("{Escape}");
    expect(onEmergencyExit).toHaveBeenCalledOnce();
  });

  it("calls onAcknowledge when 'I'm back on track' is clicked", async () => {
    const { onAcknowledge, onEmergencyExit } = renderOverlay();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /i'm back on track/i }));
    expect(onAcknowledge).toHaveBeenCalledOnce();
    expect(onEmergencyExit).not.toHaveBeenCalled();
  });

  it("calls onEmergencyExit when the secondary 'Exit session' button is clicked", async () => {
    const { onEmergencyExit } = renderOverlay();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^exit session/i }));
    expect(onEmergencyExit).toHaveBeenCalledOnce();
  });

  it("removes its Escape listener on unmount, so a stale overlay can't fire after it's gone", async () => {
    const { onEmergencyExit, unmount } = renderOverlay();
    unmount();
    const user = userEvent.setup();
    await user.keyboard("{Escape}");
    expect(onEmergencyExit).not.toHaveBeenCalled();
  });

  it("shows the non-nuclear treatment below escalation level 4", () => {
    const { container } = renderOverlay({ escalationLevel: 3 });
    expect(container.querySelector(".intervention-overlay--nuclear")).not.toBeInTheDocument();
    expect(screen.getByText("The frog caught you")).toBeInTheDocument();
  });

  it("shows the nuclear treatment at escalation level 4", () => {
    const { container } = renderOverlay({ escalationLevel: 4 });
    expect(container.querySelector(".intervention-overlay--nuclear")).toBeInTheDocument();
    expect(screen.getByText("Nuclear intervention")).toBeInTheDocument();
  });

  it("always renders the goal the user committed to", () => {
    renderOverlay({ goal: "Ship the release" });
    expect(screen.getByText("Ship the release")).toBeInTheDocument();
  });
});
