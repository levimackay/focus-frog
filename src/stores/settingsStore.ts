import { create } from "zustand";
import { settings as settingsApi } from "../ipc/commands";
import { DEFAULT_SETTINGS, type Settings } from "../ipc/types";

interface SettingsState {
  settings: Settings;
  distractingApps: string[];
  loading: boolean;
  loaded: boolean;
  error: string | null;

  load: () => Promise<void>;
  loadDistractingApps: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
  addDistractingApp: (name: string) => Promise<void>;
  removeDistractingApp: (name: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  distractingApps: [],
  loading: false,
  loaded: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const settings = await settingsApi.getSettings();
      set({ settings, loading: false, loaded: true });
    } catch (err) {
      set({
        loading: false,
        loaded: true,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  loadDistractingApps: async () => {
    try {
      const distractingApps = await settingsApi.listDistractingApps();
      set({ distractingApps });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  update: async (patch: Partial<Settings>) => {
    const next: Settings = { ...get().settings, ...patch };
    // Optimistic update — settings screens should feel instant.
    set({ settings: next });
    try {
      const confirmed = await settingsApi.updateSettings(next);
      set({ settings: confirmed });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  addDistractingApp: async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const distractingApps = await settingsApi.addDistractingApp(trimmed);
      set({ distractingApps });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  removeDistractingApp: async (name: string) => {
    try {
      const distractingApps = await settingsApi.removeDistractingApp(name);
      set({ distractingApps });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },
}));

/** True when motion should be minimized: explicit setting OR OS preference. */
export function selectReducedMotion(state: SettingsState): boolean {
  if (state.settings.reduced_motion) return true;
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
