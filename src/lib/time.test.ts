import { describe, expect, it } from "vitest";
import { formatDuration, formatMinutes } from "./time";

describe("formatDuration", () => {
  it("formats sub-minute durations", () => {
    expect(formatDuration(5)).toBe("00:05");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(125)).toBe("02:05");
  });

  it("formats hours once past 3600 seconds", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("clamps negative input to zero", () => {
    expect(formatDuration(-5)).toBe("00:00");
  });
});

describe("formatMinutes", () => {
  it("renders under an hour as minutes", () => {
    expect(formatMinutes(25 * 60)).toBe("25 min");
  });

  it("renders exact hours cleanly", () => {
    expect(formatMinutes(2 * 3600)).toBe("2 hr");
  });

  it("renders hours plus remainder minutes", () => {
    expect(formatMinutes(90 * 60)).toBe("1 hr 30 min");
  });
});
