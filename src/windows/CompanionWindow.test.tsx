import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DEFAULT_SETTINGS, type SessionSnapshot } from "../ipc/types";

// Only `windowCommands` is ever actually reachable from this component (and
// only inside a `hasTauriRuntime()` branch that's always false in jsdom),
// but the stores this component reads from (`settingsStore`/`sessionStore`/
// `companionStore`) import the other groups at module scope, so all of them
// need a safe stand-in even though the test overrides each store's action
// functions directly and never lets the real ones run.
vi.mock("../ipc/commands", () => ({
  session: {
    getActiveSession: vi.fn(),
    startSession: vi.fn(),
    abandonSession: vi.fn(),
    acknowledgeIntervention: vi.fn(),
    submitJournal: vi.fn(),
    emergencyExit: vi.fn(),
  },
  settings: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    addDistractingApp: vi.fn(),
    removeDistractingApp: vi.fn(),
    listDistractingApps: vi.fn(),
  },
  companion: {
    getCompanionProfile: vi.fn(),
    updateCompanion: vi.fn(),
  },
  stats: {
    getStats: vi.fn(),
    getRecentSessions: vi.fn(),
  },
  windowCommands: { setFrogPosition: vi.fn(), quitApp: vi.fn() },
}));

vi.mock("../ipc/events", () => ({
  events: {
    onSessionUpdate: vi.fn().mockResolvedValue(() => {}),
    onSessionCompleted: vi.fn().mockResolvedValue(() => {}),
    onCompanionMessage: vi.fn().mockResolvedValue(() => {}),
  },
}));

// CompanionWindow reads settings/session/companion state straight out of
// their stores rather than fetching itself in a way we can intercept, so we
// preset store state and stub the stores' `load`/`hydrate`/`loadProfile`
// actions to no-ops -- this component's own render logic (the loading
// guard, the mood fallback, the accessible label) is what's under test, not
// store hydration (already covered by each store's own test file).
import { useSettingsStore } from "../stores/settingsStore";
import { useSessionStore } from "../stores/sessionStore";
import { useCompanionStore } from "../stores/companionStore";
import CompanionWindow from "./CompanionWindow";

function snapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    id: "s1",
    state: "Focused",
    escalation_level: 0,
    goal: "Write the report",
    success_criteria: "Report sent",
    remaining_secs: 600,
    distraction_count: 0,
    intervention_count: 0,
    started_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("CompanionWindow", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      distractingApps: [],
      loading: false,
      loaded: false,
      error: null,
      load: vi.fn(),
    });
    useSessionStore.setState({ snapshot: null, phase: "none", starting: false, error: null, hydrate: vi.fn() });
    useCompanionStore.setState({
      profile: null,
      mood: "idle",
      bubble: null,
      loading: false,
      error: null,
      loadProfile: vi.fn(),
    });
  });

  it("renders nothing while settings have not loaded, even with a session snapshot already present", () => {
    useSessionStore.setState({ snapshot: snapshot() });
    const { container } = render(<CompanionWindow />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing once settings are loaded but before a session snapshot arrives", () => {
    useSettingsStore.setState({ loaded: true });
    const { container } = render(<CompanionWindow />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the frog with an accessible label combining the companion name and the goal", () => {
    useSettingsStore.setState({ loaded: true });
    useSessionStore.setState({ snapshot: snapshot({ goal: "Write the report" }) });
    useCompanionStore.setState({
      profile: {
        id: 1,
        species: "frog",
        name: "Hopper",
        personality: "Friendly",
        level: 1,
        experience: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
    render(<CompanionWindow />);
    expect(screen.getByRole("img", { name: "Hopper, Write the report" })).toBeInTheDocument();
  });

  it("defaults the label to 'Frog' when no companion profile has loaded yet", () => {
    useSettingsStore.setState({ loaded: true });
    useSessionStore.setState({ snapshot: snapshot({ goal: "Ship the release" }) });
    render(<CompanionWindow />);
    expect(screen.getByRole("img", { name: "Frog, Ship the release" })).toBeInTheDocument();
  });

  it("shows the companion:message bubble text when one has arrived", () => {
    useSettingsStore.setState({ loaded: true });
    useSessionStore.setState({ snapshot: snapshot() });
    useCompanionStore.setState({
      bubble: { text: "Hop to it!", mood: "concerned", receivedAt: Date.now() },
    });
    render(<CompanionWindow />);
    expect(screen.getByText("Hop to it!")).toBeInTheDocument();
  });
});
