import { describe, expect, it } from "vitest";
import { moodForState } from "./mood";

describe("moodForState", () => {
  it("maps Focused to walking", () => {
    expect(moodForState("Focused", 0)).toBe("walking");
  });

  it("maps Distracted to confused", () => {
    expect(moodForState("Distracted", 1)).toBe("confused");
  });

  it("maps low-escalation Ignored to concerned, high-escalation to angry", () => {
    expect(moodForState("Ignored", 1)).toBe("concerned");
    expect(moodForState("Ignored", 2)).toBe("angry");
  });

  it("maps Intervention to chasing below escalation 4, intervention at 4", () => {
    expect(moodForState("Intervention", 3)).toBe("chasing");
    expect(moodForState("Intervention", 4)).toBe("intervention");
  });

  it("maps Completed to celebrating and Abandoned to sleeping", () => {
    expect(moodForState("Completed", 0)).toBe("celebrating");
    expect(moodForState("Abandoned", 0)).toBe("sleeping");
  });
});
