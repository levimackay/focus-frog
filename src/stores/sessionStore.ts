import { create } from "zustand";
import { session as sessionApi } from "../ipc/commands";
import type { SessionSnapshot, StartSessionInput } from "../ipc/types";

export type SessionPhase =
  | "none" // no session ever loaded / not yet started
  | "active" // Focused / Distracted / Ignored / Intervention / Recovering
  | "intervention" // Intervention specifically — overlay must show
  | "completed"
  | "abandoned";

function phaseFor(snapshot: SessionSnapshot | null): SessionPhase {
  if (!snapshot) return "none";
  switch (snapshot.state) {
    case "Completed":
      return "completed";
    case "Abandoned":
      return "abandoned";
    case "Intervention":
      return "intervention";
    case "Idle":
      return "none";
    default:
      return "active";
  }
}

interface SessionState {
  snapshot: SessionSnapshot | null;
  phase: SessionPhase;
  starting: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  start: (input: StartSessionInput) => Promise<void>;
  abandon: () => Promise<void>;
  acknowledgeIntervention: () => Promise<void>;
  submitJournal: (entry: string | null) => Promise<void>;
  emergencyExit: () => Promise<void>;
  applySnapshot: (snapshot: SessionSnapshot) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  snapshot: null,
  phase: "none",
  starting: false,
  error: null,

  hydrate: async () => {
    try {
      const snapshot = await sessionApi.getActiveSession();
      set({ snapshot, phase: phaseFor(snapshot) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  start: async (input: StartSessionInput) => {
    set({ starting: true, error: null });
    try {
      const snapshot = await sessionApi.startSession(input);
      set({ snapshot, phase: phaseFor(snapshot), starting: false });
    } catch (err) {
      set({
        starting: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  abandon: async () => {
    try {
      const snapshot = await sessionApi.abandonSession();
      set({ snapshot, phase: phaseFor(snapshot) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  acknowledgeIntervention: async () => {
    try {
      const snapshot = await sessionApi.acknowledgeIntervention();
      set({ snapshot, phase: phaseFor(snapshot) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  submitJournal: async (entry: string | null) => {
    try {
      const snapshot = await sessionApi.submitJournal(entry);
      set({ snapshot, phase: phaseFor(snapshot) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  emergencyExit: async () => {
    try {
      const snapshot = await sessionApi.emergencyExit();
      set({ snapshot, phase: phaseFor(snapshot) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  /** Called by the event-listener hook on every `session:update` / `session:completed`. */
  applySnapshot: (snapshot: SessionSnapshot) => set({ snapshot, phase: phaseFor(snapshot) }),

  reset: () => set({ snapshot: null, phase: "none", error: null }),
}));
