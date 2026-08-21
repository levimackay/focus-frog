import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DEFAULT_SETTINGS, type CompanionProfile, type SessionSnapshot } from "./ipc/types";

const getActiveSession = vi.fn();
const getSettings = vi.fn();
const getCompanionProfile = vi.fn();

vi.mock("./ipc/commands", () => ({
  session: {
    getActiveSession: (...args: unknown[]) => getActiveSession(...args),
    startSession: vi.fn(),
    abandonSession: vi.fn(),
    acknowledgeIntervention: vi.fn(),
    submitJournal: vi.fn(),
    emergencyExit: vi.fn(),
  },
  settings: {
    getSettings: (...args: unknown[]) => getSettings(...args),
    updateSettings: vi.fn(),
    addDistractingApp: vi.fn(),
    removeDistractingApp: vi.fn(),
    listDistractingApps: vi.fn(),
  },
  companion: {
    getCompanionProfile: (...args: unknown[]) => getCompanionProfile(...args),
    updateCompanion: vi.fn(),
  },
  stats: {
    getStats: vi.fn(),
    getRecentSessions: vi.fn(),
  },
  windowCommands: {
    setFrogPosition: vi.fn(),
    quitApp: vi.fn(),
  },
}));

vi.mock("./ipc/events", () => ({
  events: {
    onSessionUpdate: vi.fn().mockResolvedValue(() => {}),
    onSessionCompleted: vi.fn().mockResolvedValue(() => {}),
    onCompanionMessage: vi.fn().mockResolvedValue(() => {}),
  },
}));

import App from "./App";
import { useSessionStore } from "./stores/sessionStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useCompanionStore } from "./stores/companionStore";

function snapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    id: "s1",
    state: "Intervention",
    escalation_level: 3,
    goal: "Write the quarterly report",
    success_criteria: "Sent to Maya",
    remaining_secs: 120,
    distraction_count: 2,
    intervention_count: 1,
    started_at: new Date().toISOString(),
    ...overrides,
  };
}

const companionProfile: CompanionProfile = {
  id: 1,
  species: "frog",
  name: "Hopper",
  personality: "Friendly",
  level: 1,
  experience: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("App -- inline InterventionOverlay gating by escalation level", () => {
  beforeEach(() => {
    // jsdom's localStorage isn't guaranteed available under every Node/CI
    // config (App.tsx itself tolerates this via try/catch) -- do the same
    // here rather than assuming it exists.
    try {
      window.localStorage.clear();
    } catch {
      /* not available in this environment; App.tsx handles that too */
    }
    useSessionStore.setState({ snapshot: null, phase: "none", starting: false, error: null });
    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      distractingApps: [],
      loading: false,
      loaded: false,
      error: null,
    });
    useCompanionStore.setState({
      profile: null,
      mood: "idle",
      bubble: null,
      loading: false,
      error: null,
    });
    getSettings.mockReset().mockResolvedValue(DEFAULT_SETTINGS);
    getCompanionProfile.mockReset().mockResolvedValue(companionProfile);
    getActiveSession.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ARCHITECTURE.md section 9.1: escalation 3 (Intervention under
  // Persistent/Ruthless) has no dedicated OS window, so the main window's
  // session view must render the overlay inline.
  it("shows the inline overlay at escalation level 3", async () => {
    getActiveSession.mockResolvedValue(snapshot({ escalation_level: 3 }));
    render(<App />);
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  // Escalation 4 (Nuclear) gets its own dedicated `NuclearWindow` -- the
  // main window must stay out of the way, or the user sees two overlays
  // stacked at once (the exact bug section 9.1 calls out avoiding).
  it("does NOT show the inline overlay at escalation level 4 -- the nuclear window owns it", async () => {
    getActiveSession.mockResolvedValue(snapshot({ escalation_level: 4 }));
    render(<App />);
    // Wait for hydration to settle onto the session view (goal text is a
    // stable signal SessionHud rendered) before asserting the negative.
    expect(await screen.findByText("Write the quarterly report")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("still shows SessionHud underneath the inline overlay at escalation level 3", async () => {
    getActiveSession.mockResolvedValue(snapshot({ escalation_level: 3 }));
    const { container } = render(<App />);
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    // Both SessionHud and InterventionOverlay mention the goal in prose, so
    // scope to SessionHud's own goal element rather than matching by text.
    expect(container.querySelector(".session-goal")).toHaveTextContent(
      "Write the quarterly report",
    );
  });
});
