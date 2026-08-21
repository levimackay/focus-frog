import { useEffect, useState } from "react";
import Home from "./components/Home";
import OnboardingFlow from "./components/onboarding/OnboardingFlow";
import SessionHud from "./components/session/SessionHud";
import InterventionOverlay from "./components/session/InterventionOverlay";
import CompletionScreen from "./components/session/CompletionScreen";
import StatsScreen from "./components/stats/StatsScreen";
import SettingsScreen from "./components/settings/SettingsScreen";
import { useSessionStore } from "./stores/sessionStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useCompanionStore } from "./stores/companionStore";
import { useFocusFrogEvents } from "./hooks/useFocusFrogEvents";
import { useReducedMotion } from "./hooks/useReducedMotion";
import type { StartSessionInput } from "./ipc/types";
import "./styles/global.css";

const ONBOARDED_KEY = "focus-frog:onboarded";

type View =
  | "loading"
  | "onboarding"
  | "home"
  | "newSession"
  | "session"
  | "completion"
  | "stats"
  | "settings";

function readOnboarded(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDED_KEY) === "true";
  } catch {
    return false;
  }
}

function markOnboarded() {
  try {
    window.localStorage.setItem(ONBOARDED_KEY, "true");
  } catch {
    // localStorage unavailable — non-fatal, just re-shows onboarding next launch.
  }
}

function App() {
  useFocusFrogEvents();

  const { settings, load: loadSettings, loaded: settingsLoaded } = useSettingsStore();
  const {
    snapshot,
    phase,
    starting,
    error,
    hydrate,
    start,
    acknowledgeIntervention,
    submitJournal,
    emergencyExit,
    reset,
  } = useSessionStore();
  const companion = useCompanionStore((s) => s.profile);
  const loadCompanion = useCompanionStore((s) => s.loadProfile);
  const reducedMotion = useReducedMotion();

  const [view, setView] = useState<View>("loading");
  const [hydrated, setHydrated] = useState(false);

  // Initial hydration.
  useEffect(() => {
    Promise.all([loadSettings(), hydrate(), loadCompanion()]).finally(() => setHydrated(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Decide the initial view once hydration completes.
  useEffect(() => {
    if (!hydrated) return;
    if (phase === "active" || phase === "intervention") {
      markOnboarded();
      setView("session");
    } else if (readOnboarded()) {
      setView("home");
    } else {
      setView("onboarding");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Force navigation whenever the session phase changes underneath the current view.
  useEffect(() => {
    if (!hydrated) return;
    if (phase === "intervention") {
      setView("session"); // never let an intervention hide behind settings/stats
    } else if (phase === "active") {
      setView((v) => (v === "home" || v === "newSession" || v === "onboarding" ? "session" : v));
    } else if (phase === "completed" || phase === "abandoned") {
      setView("completion");
    }
  }, [phase, hydrated]);

  // Theme + reduced-motion attributes on the document root.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", settings.theme);
    }
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-reduced-motion", String(reducedMotion));
  }, [reducedMotion]);

  function backFromSecondaryView() {
    setView(phase === "active" || phase === "intervention" ? "session" : "home");
  }

  async function handleStart(input: StartSessionInput) {
    await start(input);
    markOnboarded();
  }

  if (view === "loading" || !settingsLoaded) {
    return (
      <div className="app-loading" role="status" aria-label="Loading Focus Frog">
        <div className="skeleton" style={{ width: 160, height: 160, borderRadius: "50%" }} />
      </div>
    );
  }

  if (view === "onboarding" || view === "newSession") {
    return (
      <OnboardingFlow
        showIntro={view === "onboarding"}
        starting={starting}
        error={error}
        reducedMotion={reducedMotion}
        onComplete={handleStart}
      />
    );
  }

  if (view === "settings") {
    return <SettingsScreen onBack={backFromSecondaryView} />;
  }

  if (view === "stats") {
    return <StatsScreen onBack={backFromSecondaryView} />;
  }

  if (view === "completion" && snapshot) {
    return (
      <CompletionScreen
        snapshot={snapshot}
        reducedMotion={reducedMotion}
        onSubmitJournal={submitJournal}
        onDone={() => {
          reset();
          setView("home");
        }}
      />
    );
  }

  if (view === "session" && snapshot) {
    // Escalation 4 (Nuclear) gets its own dedicated OS window
    // (src-tauri's create_nuclear_window, rendered by
    // src/windows/NuclearWindow.tsx) the moment the engine reaches it — do
    // not also show an overlay in here, or the user sees two at once.
    // Escalation 3 (Intervention under Persistent/Ruthless) has no
    // separate window, so the main window is the only place it can show;
    // see ARCHITECTURE.md section 9 for why.
    const showInlineIntervention = phase === "intervention" && snapshot.escalation_level < 4;
    return (
      <>
        <SessionHud reducedMotion={reducedMotion} onOpenSettings={() => setView("settings")} />
        {showInlineIntervention && (
          <InterventionOverlay
            goal={snapshot.goal}
            escalationLevel={snapshot.escalation_level}
            emergencyHotkey={settings.emergency_hotkey}
            reducedMotion={reducedMotion}
            onAcknowledge={acknowledgeIntervention}
            onEmergencyExit={emergencyExit}
          />
        )}
      </>
    );
  }

  return (
    <Home
      reducedMotion={reducedMotion}
      frogName={companion?.name ?? "Frog"}
      onStartSession={() => setView("newSession")}
      onOpenStats={() => setView("stats")}
      onOpenSettings={() => setView("settings")}
    />
  );
}

export default App;
