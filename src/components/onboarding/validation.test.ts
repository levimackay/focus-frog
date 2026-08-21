import { describe, expect, it } from "vitest";
import {
  GOAL_MAX_LENGTH,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  SUCCESS_CRITERIA_MAX_LENGTH,
  isGoalFormValid,
  validateGoalForm,
} from "./validation";

const validValues = {
  goal: "Write the report",
  successCriteria: "Report is sent",
  durationMinutes: 25,
};

describe("validateGoalForm", () => {
  it("passes for well-formed input", () => {
    expect(validateGoalForm(validValues)).toEqual({});
    expect(isGoalFormValid(validValues)).toBe(true);
  });

  it("requires a goal", () => {
    const errors = validateGoalForm({ ...validValues, goal: "   " });
    expect(errors.goal).toBeDefined();
  });

  it("requires success criteria", () => {
    const errors = validateGoalForm({ ...validValues, successCriteria: "" });
    expect(errors.successCriteria).toBeDefined();
  });

  it("rejects a goal over the max length", () => {
    const errors = validateGoalForm({ ...validValues, goal: "x".repeat(GOAL_MAX_LENGTH + 1) });
    expect(errors.goal).toMatch(new RegExp(String(GOAL_MAX_LENGTH)));
  });

  it("rejects success criteria over the max length", () => {
    const errors = validateGoalForm({
      ...validValues,
      successCriteria: "x".repeat(SUCCESS_CRITERIA_MAX_LENGTH + 1),
    });
    expect(errors.successCriteria).toBeDefined();
  });

  it("requires a duration", () => {
    const errors = validateGoalForm({ ...validValues, durationMinutes: "" });
    expect(errors.durationMinutes).toBeDefined();
  });

  it("rejects durations below the 1-minute floor", () => {
    const errors = validateGoalForm({ ...validValues, durationMinutes: MIN_DURATION_MINUTES - 1 });
    expect(errors.durationMinutes).toBeDefined();
  });

  it("accepts the exact minimum duration", () => {
    const errors = validateGoalForm({ ...validValues, durationMinutes: MIN_DURATION_MINUTES });
    expect(errors.durationMinutes).toBeUndefined();
  });

  it("accepts the exact maximum duration", () => {
    const errors = validateGoalForm({ ...validValues, durationMinutes: MAX_DURATION_MINUTES });
    expect(errors.durationMinutes).toBeUndefined();
  });

  it("rejects durations above the 4-hour ceiling", () => {
    const errors = validateGoalForm({ ...validValues, durationMinutes: MAX_DURATION_MINUTES + 1 });
    expect(errors.durationMinutes).toBeDefined();
  });
});
