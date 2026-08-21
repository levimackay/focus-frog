/**
 * TypeScript mirror of the Rust serde types defined in ARCHITECTURE.md.
 *
 * Field names and enum string values must match the Rust side EXACTLY —
 * this file is part of the binding contract, not a convenience layer.
 * Do not rename or "improve" anything here without updating
 * ARCHITECTURE.md first.
 */

// ---------------------------------------------------------------------------
// Section 3 — Focus Engine state
// ---------------------------------------------------------------------------

export type FocusState =
  | "Idle"
  | "Focused"
  | "Distracted"
  | "Ignored"
  | "Intervention"
  | "Recovering"
  | "Completed"
  | "Abandoned";

/** Derived, not stored independently. 0-4. See ARCHITECTURE.md section 3. */
export type EscalationLevel = 0 | 1 | 2 | 3 | 4;

// ---------------------------------------------------------------------------
// Section 6 — Settings
// ---------------------------------------------------------------------------

export type AnnoyanceProfile = "gentle" | "persistent" | "ruthless" | "nuclear";

export type Personality = "Friendly" | "PassiveAggressive" | "DrillSergeant" | "Chaotic" | "Zen";

export type Theme = "system" | "light" | "dark";

export interface Settings {
  idle_threshold_secs: number;
  distraction_grace_secs: number;
  ignored_threshold_secs: number;
  intervention_threshold_secs: number;
  recovery_confirm_secs: number;
  default_annoyance_profile: AnnoyanceProfile;
  default_personality: Personality;
  app_detection_enabled: boolean;
  launch_on_startup: boolean;
  sound_enabled: boolean;
  reduced_motion: boolean;
  theme: Theme;
  frog_size: number;
  frog_position: [number, number];
  emergency_hotkey: string;
  nuclear_mode_enabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  idle_threshold_secs: 20,
  distraction_grace_secs: 8,
  ignored_threshold_secs: 60,
  intervention_threshold_secs: 180,
  recovery_confirm_secs: 5,
  default_annoyance_profile: "gentle",
  default_personality: "Friendly",
  app_detection_enabled: true,
  launch_on_startup: false,
  sound_enabled: true,
  reduced_motion: false,
  theme: "system",
  frog_size: 96,
  frog_position: [0, 0],
  emergency_hotkey: "CommandOrControl+Shift+Escape",
  nuclear_mode_enabled: false,
};

// ---------------------------------------------------------------------------
// Section 7 — IPC command contract
// ---------------------------------------------------------------------------

export interface StartSessionInput {
  goal: string; // max 200 chars
  success_criteria: string; // max 300 chars
  duration_secs: number; // 60..=14400 (1min..4h)
  annoyance_profile: AnnoyanceProfile;
}

export interface SessionSnapshot {
  id: string;
  state: FocusState;
  escalation_level: EscalationLevel;
  goal: string;
  success_criteria: string;
  remaining_secs: number;
  distraction_count: number;
  intervention_count: number;
  started_at: string;
}

export interface CompanionProfile {
  id: 1;
  species: string;
  name: string;
  personality: Personality;
  level: number;
  experience: number;
  created_at: string;
  updated_at: string;
}

export type StatsRange = "week" | "month" | "all";

export interface StatsSummary {
  range: StatsRange;
  sessions_count: number;
  focused_seconds: number;
  distractions_defeated: number;
  completions: number;
  abandonments: number;
  current_streak_days: number;
  longest_streak_days: number;
}

export type SessionStatus = "active" | "completed" | "abandoned";

export interface SessionSummary {
  id: string;
  goal: string;
  status: SessionStatus;
  planned_duration_secs: number;
  distraction_count: number;
  intervention_count: number;
  started_at: string;
  ended_at: string | null;
}

// ---------------------------------------------------------------------------
// Section 8 — Events (backend -> frontend)
// ---------------------------------------------------------------------------

export interface CompanionMessagePayload {
  text: string;
  mood: string;
}

export interface FocusFrogEventMap {
  "session:update": SessionSnapshot;
  "session:completed": SessionSnapshot;
  "companion:message": CompanionMessagePayload;
}

export type FocusFrogEventName = keyof FocusFrogEventMap;
