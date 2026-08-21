import type { EscalationLevel, FocusState } from "../ipc/types";
import type { FrogMood } from "../stores/companionStore";

/**
 * Deterministic fallback mapping from engine state -> frog mood, used
 * whenever there isn't a fresher mood supplied by a `companion:message`
 * event (see ARCHITECTURE.md sections 3 and 8). This keeps the frog
 * visually honest about session state even in the gap before the first
 * message of a given state arrives.
 */
export function moodForState(state: FocusState, escalationLevel: EscalationLevel): FrogMood {
  switch (state) {
    case "Idle":
      return "idle";
    case "Focused":
      return "walking";
    case "Distracted":
      return "confused";
    case "Ignored":
      return escalationLevel >= 2 ? "angry" : "concerned";
    case "Intervention":
      return escalationLevel >= 4 ? "intervention" : "chasing";
    case "Recovering":
      return "looking";
    case "Completed":
      return "celebrating";
    case "Abandoned":
      return "sleeping";
    default:
      return "idle";
  }
}
