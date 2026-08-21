import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../ipc/types";

const getSettings = vi.fn();
const updateSettings = vi.fn();
const addDistractingApp = vi.fn();
const removeDistractingApp = vi.fn();
const listDistractingApps = vi.fn();

vi.mock("../ipc/commands", () => ({
  settings: {
    getSettings: (...args: unknown[]) => getSettings(...args),
    updateSettings: (...args: unknown[]) => updateSettings(...args),
    addDistractingApp: (...args: unknown[]) => addDistractingApp(...args),
    removeDistractingApp: (...args: unknown[]) => removeDistractingApp(...args),
    listDistractingApps: (...args: unknown[]) => listDistractingApps(...args),
  },
}));

import { selectReducedMotion, useSettingsStore } from "./settingsStore";

describe("settingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      distractingApps: [],
      loading: false,
      loaded: false,
      error: null,
    });
    getSettings.mockReset();
    updateSettings.mockReset();
    addDistractingApp.mockReset();
    removeDistractingApp.mockReset();
    listDistractingApps.mockReset();
  });

  it("loads settings and marks loaded on success", async () => {
    const loaded = { ...DEFAULT_SETTINGS, idle_threshold_secs: 45 };
    getSettings.mockResolvedValue(loaded);
    await useSettingsStore.getState().load();
    const state = useSettingsStore.getState();
    expect(state.settings.idle_threshold_secs).toBe(45);
    expect(state.loaded).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("still marks loaded=true after a failed load, so the UI doesn't hang on the loading screen forever", async () => {
    getSettings.mockRejectedValue(new Error("db unavailable"));
    await useSettingsStore.getState().load();
    const state = useSettingsStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.error).toBe("db unavailable");
  });

  it("update() applies the patch optimistically before the backend confirms", async () => {
    // Never resolves within this test -- we only care about the synchronous
    // optimistic state written before the await.
    updateSettings.mockReturnValue(new Promise(() => {}));
    const promise = useSettingsStore.getState().update({ frog_size: 128 });
    expect(useSettingsStore.getState().settings.frog_size).toBe(128);
    void promise; // avoid unhandled-rejection noise; intentionally left pending
  });

  it("update() reconciles with the server's confirmed value once it resolves", async () => {
    // Server may normalize/clamp fields -- confirm the store adopts exactly
    // what came back, not just the optimistic patch.
    updateSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, frog_size: 200 });
    await useSettingsStore.getState().update({ frog_size: 999 });
    expect(useSettingsStore.getState().settings.frog_size).toBe(200);
  });

  it("update() records an error but leaves the optimistic value in place on failure", async () => {
    updateSettings.mockRejectedValue(new Error("validation error: frog_size out of range"));
    await useSettingsStore.getState().update({ frog_size: 999 });
    const state = useSettingsStore.getState();
    expect(state.error).toBe("validation error: frog_size out of range");
    // Documents current (not necessarily ideal) behavior: a failed update
    // does not roll the optimistic value back.
    expect(state.settings.frog_size).toBe(999);
  });

  it("addDistractingApp trims whitespace before sending", async () => {
    addDistractingApp.mockResolvedValue(["Reddit"]);
    await useSettingsStore.getState().addDistractingApp("  Reddit  ");
    expect(addDistractingApp).toHaveBeenCalledWith("Reddit");
    expect(useSettingsStore.getState().distractingApps).toEqual(["Reddit"]);
  });

  it("addDistractingApp is a no-op for an empty/whitespace-only name", async () => {
    await useSettingsStore.getState().addDistractingApp("   ");
    expect(addDistractingApp).not.toHaveBeenCalled();
  });

  it("removeDistractingApp updates the list from the backend response", async () => {
    useSettingsStore.setState({ distractingApps: ["Reddit", "Twitter"] });
    removeDistractingApp.mockResolvedValue(["Twitter"]);
    await useSettingsStore.getState().removeDistractingApp("Reddit");
    expect(useSettingsStore.getState().distractingApps).toEqual(["Twitter"]);
  });
});

describe("selectReducedMotion", () => {
  const baseState = {
    settings: DEFAULT_SETTINGS,
    distractingApps: [],
    loading: false,
    loaded: true,
    error: null,
    load: vi.fn(),
    loadDistractingApps: vi.fn(),
    update: vi.fn(),
    addDistractingApp: vi.fn(),
    removeDistractingApp: vi.fn(),
  };

  it("returns true when the explicit setting is on, regardless of OS preference", () => {
    expect(
      selectReducedMotion({ ...baseState, settings: { ...DEFAULT_SETTINGS, reduced_motion: true } }),
    ).toBe(true);
  });

  it("falls back to the OS media-query preference when the explicit setting is off", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({ matches: true, media: query }) as MediaQueryList) as typeof window.matchMedia;
    try {
      expect(
        selectReducedMotion({
          ...baseState,
          settings: { ...DEFAULT_SETTINGS, reduced_motion: false },
        }),
      ).toBe(true);
    } finally {
      window.matchMedia = original;
    }
  });

  it("returns false when neither the explicit setting nor the OS preference wants reduced motion", () => {
    expect(
      selectReducedMotion({ ...baseState, settings: { ...DEFAULT_SETTINGS, reduced_motion: false } }),
    ).toBe(false);
  });
});
