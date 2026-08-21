import { useEffect, useState } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import { useCompanionStore } from "../../stores/companionStore";
import { windowCommands } from "../../ipc/commands";
import {
  DEFAULT_SETTINGS,
  type AnnoyanceProfile,
  type Personality,
  type Theme,
} from "../../ipc/types";
import { ANNOYANCE_PROFILES } from "../onboarding/validation";
import { formatHotkey } from "../../lib/hotkey";
import Button from "../common/Button";
import Toggle from "../common/Toggle";
import DistractingAppsList from "./DistractingAppsList";
import "./SettingsScreen.css";

const SECTIONS = [
  "General",
  "Focus",
  "Frog",
  "Behavior",
  "Distractions",
  "Notifications",
  "Privacy",
  "Appearance",
  "Keyboard Shortcuts",
  "Advanced",
] as const;

type Section = (typeof SECTIONS)[number];

const PERSONALITIES: Personality[] = [
  "Friendly",
  "PassiveAggressive",
  "DrillSergeant",
  "Chaotic",
  "Zen",
];

export interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const [section, setSection] = useState<Section>("General");
  const { settings, loaded, load, update } = useSettingsStore();
  const companion = useCompanionStore((s) => s.profile);
  const loadCompanion = useCompanionStore((s) => s.loadProfile);
  const updateCompanion = useCompanionStore((s) => s.updateCompanion);

  useEffect(() => {
    if (!loaded) load();
    if (!companion) loadCompanion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="settings-screen">
      <header className="settings-header">
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <h1>Settings</h1>
      </header>

      <div className="settings-body">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s}
              className={
                s === section ? "settings-nav-item settings-nav-item--active" : "settings-nav-item"
              }
              aria-current={s === section ? "page" : undefined}
              onClick={() => setSection(s)}
            >
              {s}
            </button>
          ))}
        </nav>

        <div className="settings-panel">
          {!loaded ? (
            <div className="skeleton" style={{ height: 240 }} />
          ) : (
            <>
              {section === "General" && (
                <>
                  <h2>General</h2>
                  <Toggle
                    id="launch-on-startup"
                    label="Launch on startup"
                    description="Open Focus Frog automatically when you log in."
                    checked={settings.launch_on_startup}
                    onChange={(v) => update({ launch_on_startup: v })}
                  />
                  <div className="field-row">
                    <label htmlFor="default-profile">Default annoyance profile</label>
                    <select
                      id="default-profile"
                      value={settings.default_annoyance_profile}
                      onChange={(e) =>
                        update({ default_annoyance_profile: e.target.value as AnnoyanceProfile })
                      }
                    >
                      {ANNOYANCE_PROFILES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {section === "Focus" && (
                <>
                  <h2>Focus timing</h2>
                  <p className="section-note">
                    These control how quickly the engine reacts to distraction — see the escalation
                    ladder in the product design.
                  </p>
                  <SecondsField
                    label="Idle threshold"
                    description="How long you can be idle before it counts as a distraction signal."
                    value={settings.idle_threshold_secs}
                    min={5}
                    max={600}
                    onChange={(v) => update({ idle_threshold_secs: v })}
                  />
                  <SecondsField
                    label="Distraction grace period"
                    description="A distraction signal must persist this long before the frog notices."
                    value={settings.distraction_grace_secs}
                    min={1}
                    max={120}
                    onChange={(v) => update({ distraction_grace_secs: v })}
                  />
                  <SecondsField
                    label="Ignored threshold"
                    description="How long a distraction can run before escalating to Ignored."
                    value={settings.ignored_threshold_secs}
                    min={10}
                    max={900}
                    onChange={(v) => update({ ignored_threshold_secs: v })}
                  />
                  <SecondsField
                    label="Intervention threshold"
                    description="How long before the frog escalates all the way to an intervention."
                    value={settings.intervention_threshold_secs}
                    min={30}
                    max={1800}
                    onChange={(v) => update({ intervention_threshold_secs: v })}
                  />
                  <SecondsField
                    label="Recovery confirmation"
                    description="How long you need to stay focused before the frog trusts it."
                    value={settings.recovery_confirm_secs}
                    min={1}
                    max={60}
                    onChange={(v) => update({ recovery_confirm_secs: v })}
                  />
                </>
              )}

              {section === "Frog" && (
                <>
                  <h2>The frog</h2>
                  <div className="field-row">
                    <label htmlFor="frog-name">Name</label>
                    <input
                      id="frog-name"
                      type="text"
                      maxLength={40}
                      defaultValue={companion?.name ?? "Frog"}
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name && companion) updateCompanion(name, companion.personality);
                      }}
                    />
                  </div>
                  <div className="field-row">
                    <label htmlFor="frog-personality">Default personality</label>
                    <select
                      id="frog-personality"
                      value={settings.default_personality}
                      onChange={(e) =>
                        update({ default_personality: e.target.value as Personality })
                      }
                    >
                      {PERSONALITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field-row">
                    <label htmlFor="frog-size">Size ({settings.frog_size}px)</label>
                    <input
                      id="frog-size"
                      type="range"
                      min={48}
                      max={200}
                      value={settings.frog_size}
                      onChange={(e) => update({ frog_size: Number(e.target.value) })}
                    />
                  </div>
                  <div className="field-row">
                    <span>Companion window position</span>
                    <Button variant="secondary" onClick={() => update({ frog_position: [0, 0] })}>
                      Reset position
                    </Button>
                  </div>
                </>
              )}

              {section === "Behavior" && (
                <>
                  <h2>Behavior</h2>
                  <Toggle
                    id="nuclear-mode"
                    label="Allow Nuclear mode"
                    description="Lets the Nuclear annoyance profile show a full-screen focus overlay when you're deep in a distraction. The emergency exit always works regardless of this setting."
                    checked={settings.nuclear_mode_enabled}
                    onChange={(v) => update({ nuclear_mode_enabled: v })}
                  />
                </>
              )}

              {section === "Distractions" && (
                <>
                  <h2>Distracting apps</h2>
                  <p className="section-note">
                    When the foreground app matches one of these, it counts as a distraction signal
                    immediately (no idle time needed).
                  </p>
                  <DistractingAppsList />
                </>
              )}

              {section === "Notifications" && (
                <>
                  <h2>Notifications</h2>
                  <Toggle
                    id="sound-enabled"
                    label="Sound"
                    description="Play a sound alongside frog messages and escalations."
                    checked={settings.sound_enabled}
                    onChange={(v) => update({ sound_enabled: v })}
                  />
                </>
              )}

              {section === "Privacy" && (
                <>
                  <h2>Privacy</h2>
                  <Toggle
                    id="app-detection"
                    label="Application detection"
                    description="Reads the foreground app's name to detect distraction. When off, only idle time is used. Focus Frog never reads keystrokes, screen contents, or takes screenshots."
                    checked={settings.app_detection_enabled}
                    onChange={(v) => update({ app_detection_enabled: v })}
                  />
                </>
              )}

              {section === "Appearance" && (
                <>
                  <h2>Appearance</h2>
                  <div className="field-row">
                    <label htmlFor="theme">Theme</label>
                    <select
                      id="theme"
                      value={settings.theme}
                      onChange={(e) => update({ theme: e.target.value as Theme })}
                    >
                      <option value="system">Match system</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                  <Toggle
                    id="reduced-motion"
                    label="Reduce motion"
                    description="Minimizes animation throughout the app, independent of your OS setting."
                    checked={settings.reduced_motion}
                    onChange={(v) => update({ reduced_motion: v })}
                  />
                </>
              )}

              {section === "Keyboard Shortcuts" && (
                <>
                  <h2>Keyboard shortcuts</h2>
                  <div className="field-row">
                    <label htmlFor="emergency-hotkey">Emergency exit</label>
                    <input
                      id="emergency-hotkey"
                      type="text"
                      value={settings.emergency_hotkey}
                      onChange={(e) => update({ emergency_hotkey: e.target.value })}
                      aria-describedby="hotkey-preview"
                    />
                  </div>
                  <p id="hotkey-preview" className="section-note">
                    Currently <kbd>{formatHotkey(settings.emergency_hotkey)}</kbd> — works even when
                    Focus Frog isn't focused, and always closes any intervention overlay.
                  </p>
                </>
              )}

              {section === "Advanced" && (
                <>
                  <h2>Advanced</h2>
                  <div className="field-row">
                    <span>Reset all settings</span>
                    <Button variant="secondary" onClick={() => update(DEFAULT_SETTINGS)}>
                      Restore defaults
                    </Button>
                  </div>
                  <div className="field-row">
                    <span>Quit Focus Frog</span>
                    <Button variant="danger" onClick={() => windowCommands.quitApp()}>
                      Quit
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SecondsField({
  label,
  description,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="field-row field-row--stacked">
      <label htmlFor={id}>{label}</label>
      <p>{description}</p>
      <div className="seconds-input">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span>sec</span>
      </div>
    </div>
  );
}
