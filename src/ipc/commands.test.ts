import { describe, expect, it, vi, beforeEach } from "vitest";

const invokeMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { session, settings, companion, stats, windowCommands } from "./commands";

describe("ipc/commands", () => {
  beforeEach(() => {
    invokeMock.mockClear();
  });

  it("calls start_session with the input payload under the exact param name", async () => {
    const input = {
      goal: "Ship the thing",
      success_criteria: "It's shipped",
      duration_secs: 1500,
      annoyance_profile: "gentle" as const,
    };
    await session.startSession(input);
    expect(invokeMock).toHaveBeenCalledWith("start_session", { input });
  });

  it("calls get_active_session with no payload", async () => {
    await session.getActiveSession();
    expect(invokeMock).toHaveBeenCalledWith("get_active_session");
  });

  it("calls abandon_session, acknowledge_intervention, emergency_exit with no payload", async () => {
    await session.abandonSession();
    await session.acknowledgeIntervention();
    await session.emergencyExit();
    expect(invokeMock).toHaveBeenNthCalledWith(1, "abandon_session");
    expect(invokeMock).toHaveBeenNthCalledWith(2, "acknowledge_intervention");
    expect(invokeMock).toHaveBeenNthCalledWith(3, "emergency_exit");
  });

  it("calls submit_journal with an entry field, including null", async () => {
    await session.submitJournal("great session");
    expect(invokeMock).toHaveBeenCalledWith("submit_journal", { entry: "great session" });
    await session.submitJournal(null);
    expect(invokeMock).toHaveBeenCalledWith("submit_journal", { entry: null });
  });

  it("calls get_settings and update_settings with the exact command names", async () => {
    await settings.getSettings();
    expect(invokeMock).toHaveBeenCalledWith("get_settings");

    const fakeSettings = { theme: "dark" } as never;
    await settings.updateSettings(fakeSettings);
    expect(invokeMock).toHaveBeenCalledWith("update_settings", { settings: fakeSettings });
  });

  it("calls the distracting-app commands with the name param", async () => {
    await settings.addDistractingApp("Slack");
    expect(invokeMock).toHaveBeenCalledWith("add_distracting_app", { name: "Slack" });

    await settings.removeDistractingApp("Slack");
    expect(invokeMock).toHaveBeenCalledWith("remove_distracting_app", { name: "Slack" });

    await settings.listDistractingApps();
    expect(invokeMock).toHaveBeenCalledWith("list_distracting_apps");
  });

  it("calls companion commands with the contract's param names", async () => {
    await companion.getCompanionProfile();
    expect(invokeMock).toHaveBeenCalledWith("get_companion_profile");

    await companion.updateCompanion("Hopper", "Zen");
    expect(invokeMock).toHaveBeenCalledWith("update_companion", {
      name: "Hopper",
      personality: "Zen",
    });
  });

  it("calls stats commands with the exact contract shapes", async () => {
    await stats.getStats("week");
    expect(invokeMock).toHaveBeenCalledWith("get_stats", { range: "week" });

    await stats.getRecentSessions(5);
    expect(invokeMock).toHaveBeenCalledWith("get_recent_sessions", { limit: 5 });
  });

  it("calls window commands with the exact contract shapes", async () => {
    await windowCommands.setFrogPosition(10, 20);
    expect(invokeMock).toHaveBeenCalledWith("set_frog_position", { x: 10, y: 20 });

    await windowCommands.quitApp();
    expect(invokeMock).toHaveBeenCalledWith("quit_app");
  });
});
