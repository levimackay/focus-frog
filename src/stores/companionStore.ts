import { create } from "zustand";
import { companion as companionApi } from "../ipc/commands";
import type { CompanionMessagePayload, CompanionProfile, Personality } from "../ipc/types";

/**
 * Moods the Frog component knows how to render. This is a frontend-only
 * concept — the backend's `companion:message` event ships a free `mood:
 * string` field (see ARCHITECTURE.md section 8) chosen by the Rust
 * personality module, so we normalize whatever string arrives to one of
 * these before handing it to <Frog />.
 */
export const FROG_MOODS = [
  "idle",
  "walking",
  "sleeping",
  "looking",
  "happy",
  "confused",
  "concerned",
  "angry",
  "celebrating",
  "chasing",
  "intervention",
] as const;

export type FrogMood = (typeof FROG_MOODS)[number];

export function normalizeMood(raw: string): FrogMood {
  const lower = raw.toLowerCase().trim();
  return (FROG_MOODS as readonly string[]).includes(lower) ? (lower as FrogMood) : "idle";
}

interface SpeechBubble {
  text: string;
  mood: FrogMood;
  receivedAt: number;
}

interface CompanionState {
  profile: CompanionProfile | null;
  mood: FrogMood;
  bubble: SpeechBubble | null;
  loading: boolean;
  error: string | null;

  loadProfile: () => Promise<void>;
  updateCompanion: (name: string, personality: Personality) => Promise<void>;
  receiveMessage: (payload: CompanionMessagePayload) => void;
  dismissBubble: () => void;
  setMood: (mood: FrogMood) => void;
}

export const useCompanionStore = create<CompanionState>((set) => ({
  profile: null,
  mood: "idle",
  bubble: null,
  loading: false,
  error: null,

  loadProfile: async () => {
    set({ loading: true, error: null });
    try {
      const profile = await companionApi.getCompanionProfile();
      set({ profile, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  updateCompanion: async (name: string, personality: Personality) => {
    try {
      const profile = await companionApi.updateCompanion(name, personality);
      set({ profile });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  receiveMessage: (payload: CompanionMessagePayload) =>
    set({
      bubble: {
        text: payload.text,
        mood: normalizeMood(payload.mood),
        receivedAt: Date.now(),
      },
      mood: normalizeMood(payload.mood),
    }),

  dismissBubble: () => set({ bubble: null }),

  setMood: (mood: FrogMood) => set({ mood }),
}));
