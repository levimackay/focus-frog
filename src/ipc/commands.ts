/**
 * Typed wrappers around @tauri-apps/api's `invoke`.
 *
 * This file (plus events.ts and types.ts) is the ONLY place in the frontend
 * that imports @tauri-apps/api directly. Every command name and payload
 * shape below must match ARCHITECTURE.md section 7 exactly.
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  CompanionProfile,
  Personality,
  SessionSnapshot,
  SessionSummary,
  Settings,
  StartSessionInput,
  StatsRange,
  StatsSummary,
} from "./types";

export const session = {
  startSession: (input: StartSessionInput): Promise<SessionSnapshot> =>
    invoke("start_session", { input }),

  getActiveSession: (): Promise<SessionSnapshot | null> => invoke("get_active_session"),

  abandonSession: (): Promise<SessionSnapshot> => invoke("abandon_session"),

  acknowledgeIntervention: (): Promise<SessionSnapshot> => invoke("acknowledge_intervention"),

  submitJournal: (entry: string | null): Promise<SessionSnapshot> =>
    invoke("submit_journal", { entry }),

  emergencyExit: (): Promise<SessionSnapshot> => invoke("emergency_exit"),
};

export const settings = {
  getSettings: (): Promise<Settings> => invoke("get_settings"),

  updateSettings: (settings: Settings): Promise<Settings> =>
    invoke("update_settings", { settings }),

  addDistractingApp: (name: string): Promise<string[]> => invoke("add_distracting_app", { name }),

  removeDistractingApp: (name: string): Promise<string[]> =>
    invoke("remove_distracting_app", { name }),

  listDistractingApps: (): Promise<string[]> => invoke("list_distracting_apps"),
};

export const companion = {
  getCompanionProfile: (): Promise<CompanionProfile> => invoke("get_companion_profile"),

  updateCompanion: (name: string, personality: Personality): Promise<CompanionProfile> =>
    invoke("update_companion", { name, personality }),
};

export const stats = {
  getStats: (range: StatsRange): Promise<StatsSummary> => invoke("get_stats", { range }),

  getRecentSessions: (limit: number): Promise<SessionSummary[]> =>
    invoke("get_recent_sessions", { limit }),
};

export const windowCommands = {
  setFrogPosition: (x: number, y: number): Promise<void> => invoke("set_frog_position", { x, y }),

  quitApp: (): Promise<void> => invoke("quit_app"),
};
