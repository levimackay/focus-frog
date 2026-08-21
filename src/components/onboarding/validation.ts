import type { AnnoyanceProfile } from "../../ipc/types";

// Mirrors ARCHITECTURE.md section 7 StartSessionInput bounds exactly.
export const GOAL_MAX_LENGTH = 200;
export const SUCCESS_CRITERIA_MAX_LENGTH = 300;
export const MIN_DURATION_SECS = 60; // 1 minute
export const MAX_DURATION_SECS = 14400; // 4 hours
export const MIN_DURATION_MINUTES = MIN_DURATION_SECS / 60;
export const MAX_DURATION_MINUTES = MAX_DURATION_SECS / 60;

export interface GoalFormValues {
  goal: string;
  successCriteria: string;
  durationMinutes: number | "";
}

export interface GoalFormErrors {
  goal?: string;
  successCriteria?: string;
  durationMinutes?: string;
}

export function validateGoalForm(values: GoalFormValues): GoalFormErrors {
  const errors: GoalFormErrors = {};

  const goal = values.goal.trim();
  if (!goal) {
    errors.goal = "Tell the frog what you're working on.";
  } else if (goal.length > GOAL_MAX_LENGTH) {
    errors.goal = `Keep it under ${GOAL_MAX_LENGTH} characters (${goal.length} now).`;
  }

  const successCriteria = values.successCriteria.trim();
  if (!successCriteria) {
    errors.successCriteria = "How will you know you're done?";
  } else if (successCriteria.length > SUCCESS_CRITERIA_MAX_LENGTH) {
    errors.successCriteria = `Keep it under ${SUCCESS_CRITERIA_MAX_LENGTH} characters (${successCriteria.length} now).`;
  }

  if (values.durationMinutes === "" || values.durationMinutes === null) {
    errors.durationMinutes = "Pick a duration.";
  } else if (Number.isNaN(values.durationMinutes)) {
    errors.durationMinutes = "That doesn't look like a number.";
  } else if (values.durationMinutes < MIN_DURATION_MINUTES) {
    errors.durationMinutes = `At least ${MIN_DURATION_MINUTES} minute.`;
  } else if (values.durationMinutes > MAX_DURATION_MINUTES) {
    errors.durationMinutes = `Focus Frog sessions cap at ${MAX_DURATION_MINUTES / 60} hours.`;
  }

  return errors;
}

export function isGoalFormValid(values: GoalFormValues): boolean {
  return Object.keys(validateGoalForm(values)).length === 0;
}

export interface AnnoyanceProfileOption {
  id: AnnoyanceProfile;
  label: string;
  description: string;
  requiresOptIn: boolean;
}

export const ANNOYANCE_PROFILES: AnnoyanceProfileOption[] = [
  {
    id: "gentle",
    label: "Gentle",
    description:
      "A nudge and a patient look, nothing more — the frog never escalates past a friendly reminder.",
    requiresOptIn: false,
  },
  {
    id: "persistent",
    label: "Persistent",
    description:
      "Reminders get more frequent and more pointed the longer you stay distracted, up to a firm on-screen intervention.",
    requiresOptIn: false,
  },
  {
    id: "ruthless",
    label: "Ruthless",
    description:
      "Full escalation, fast — the frog will follow you around the screen and interrupt whatever you're doing.",
    requiresOptIn: false,
  },
  {
    id: "nuclear",
    label: "Nuclear",
    description:
      "Everything Ruthless does, plus a full-screen focus overlay that stays up until you dismiss it. Requires explicit opt-in below — you can always exit it instantly with the emergency hotkey.",
    requiresOptIn: true,
  },
];
