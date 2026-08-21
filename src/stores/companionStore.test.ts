import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../ipc/commands", () => ({
  companion: {
    getCompanionProfile: vi.fn(),
    updateCompanion: vi.fn(),
  },
}));

import { normalizeMood, useCompanionStore } from "./companionStore";

describe("normalizeMood", () => {
  it("passes through known moods", () => {
    expect(normalizeMood("angry")).toBe("angry");
    expect(normalizeMood("Celebrating")).toBe("celebrating");
    expect(normalizeMood("  chasing  ")).toBe("chasing");
  });

  it("falls back to idle for unknown strings, so a bad backend value never crashes the frog", () => {
    expect(normalizeMood("ecstatic")).toBe("idle");
    expect(normalizeMood("")).toBe("idle");
  });
});

describe("companionStore.receiveMessage", () => {
  beforeEach(() => {
    useCompanionStore.setState({
      profile: null,
      mood: "idle",
      bubble: null,
      loading: false,
      error: null,
    });
  });

  it("stores the bubble text and normalizes the mood", () => {
    useCompanionStore.getState().receiveMessage({ text: "hop to it", mood: "Angry" });
    const { bubble, mood } = useCompanionStore.getState();
    expect(bubble?.text).toBe("hop to it");
    expect(mood).toBe("angry");
  });

  it("dismissBubble clears the bubble but keeps the mood", () => {
    useCompanionStore.getState().receiveMessage({ text: "hi", mood: "happy" });
    useCompanionStore.getState().dismissBubble();
    expect(useCompanionStore.getState().bubble).toBeNull();
    expect(useCompanionStore.getState().mood).toBe("happy");
  });
});
