import { useEffect } from "react";
import InterventionOverlay from "../components/session/InterventionOverlay";
import { useSessionStore } from "../stores/sessionStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useFocusFrogEvents } from "../hooks/useFocusFrogEvents";
import { useReducedMotion } from "../hooks/useReducedMotion";
import "../styles/global.css";
import "./NuclearWindow.css";

/**
 * Root for the `#/nuclear` window (src-tauri/src/lib.rs
 * `create_nuclear_window`): opened only when the engine reaches
 * `Intervention` at escalation level 4 under the Nuclear profile, closed as
 * soon as the session leaves `Intervention`. It reuses the exact same
 * InterventionOverlay the main window shows for a non-nuclear (escalation
 * 3) intervention, so the emergency exit's behavior, keyboard reachability,
 * and "never trap the user" guarantees are identical in both places —
 * there is no nuclear-specific fork of that component.
 */
export default function NuclearWindow() {
  useFocusFrogEvents();

  const loadSettings = useSettingsStore((s) => s.load);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const emergencyHotkey = useSettingsStore((s) => s.settings.emergency_hotkey);
  const hydrateSession = useSessionStore((s) => s.hydrate);
  const snapshot = useSessionStore((s) => s.snapshot);
  const acknowledgeIntervention = useSessionStore((s) => s.acknowledgeIntervention);
  const emergencyExit = useSessionStore((s) => s.emergencyExit);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    loadSettings();
    hydrateSession();
  }, [loadSettings, hydrateSession]);

  // This window only exists while the backend has actually driven the
  // engine into Intervention at escalation 4 — but guard the async gap
  // between "window opened" and "first snapshot fetched" the same way the
  // rest of the app avoids a blank flash, rather than rendering nothing
  // useful over a window with no native close button.
  if (!settingsLoaded || !snapshot) {
    return (
      <div className="nuclear-window-loading" role="status" aria-label="Loading">
        <div className="skeleton" style={{ width: 140, height: 140, borderRadius: "50%" }} />
      </div>
    );
  }

  return (
    <InterventionOverlay
      goal={snapshot.goal}
      escalationLevel={snapshot.escalation_level}
      emergencyHotkey={emergencyHotkey}
      reducedMotion={reducedMotion}
      onAcknowledge={acknowledgeIntervention}
      onEmergencyExit={emergencyExit}
    />
  );
}
