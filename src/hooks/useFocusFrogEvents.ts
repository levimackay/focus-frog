import { useEffect } from "react";
import { events } from "../ipc/events";
import { useSessionStore } from "../stores/sessionStore";
import { useCompanionStore } from "../stores/companionStore";

/**
 * Wires the three backend events (ARCHITECTURE.md section 8) into the
 * zustand stores. Mount once, near the root of the app.
 */
export function useFocusFrogEvents() {
  const applySnapshot = useSessionStore((s) => s.applySnapshot);
  const receiveMessage = useCompanionStore((s) => s.receiveMessage);

  useEffect(() => {
    let cancelled = false;
    const unlisten: Array<() => void> = [];

    (async () => {
      const a = await events.onSessionUpdate((snapshot) => {
        if (!cancelled) applySnapshot(snapshot);
      });
      const b = await events.onSessionCompleted((snapshot) => {
        if (!cancelled) applySnapshot(snapshot);
      });
      const c = await events.onCompanionMessage((payload) => {
        if (!cancelled) receiveMessage(payload);
      });
      if (cancelled) {
        a();
        b();
        c();
      } else {
        unlisten.push(a, b, c);
      }
    })();

    return () => {
      cancelled = true;
      unlisten.forEach((fn) => fn());
    };
  }, [applySnapshot, receiveMessage]);
}
