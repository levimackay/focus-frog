import { describe, expect, it, vi, beforeEach } from "vitest";

const listenMock = vi.fn().mockResolvedValue(() => {});

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

import { events } from "./events";

describe("ipc/events", () => {
  beforeEach(() => {
    listenMock.mockClear();
  });

  it("subscribes to session:update with the exact event name", async () => {
    const handler = vi.fn();
    await events.onSessionUpdate(handler);
    expect(listenMock).toHaveBeenCalledWith("session:update", expect.any(Function));
  });

  it("subscribes to session:completed with the exact event name", async () => {
    const handler = vi.fn();
    await events.onSessionCompleted(handler);
    expect(listenMock).toHaveBeenCalledWith("session:completed", expect.any(Function));
  });

  it("subscribes to companion:message with the exact event name", async () => {
    const handler = vi.fn();
    await events.onCompanionMessage(handler);
    expect(listenMock).toHaveBeenCalledWith("companion:message", expect.any(Function));
  });

  it("unwraps the event payload before calling the handler", async () => {
    let capturedListener: ((evt: { payload: unknown }) => void) | undefined;
    listenMock.mockImplementationOnce(
      (_event: string, listener: (evt: { payload: unknown }) => void) => {
        capturedListener = listener;
        return Promise.resolve(() => {});
      },
    );

    const handler = vi.fn();
    await events.onCompanionMessage(handler);
    capturedListener?.({ payload: { text: "hop to it", mood: "concerned" } });

    expect(handler).toHaveBeenCalledWith({ text: "hop to it", mood: "concerned" });
  });
});
