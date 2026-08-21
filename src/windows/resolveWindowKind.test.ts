import { describe, expect, it } from "vitest";
import { resolveWindowKind } from "./resolveWindowKind";

describe("resolveWindowKind", () => {
  it("resolves the companion window from its hash", () => {
    expect(resolveWindowKind("#/companion")).toBe("companion");
  });

  it("resolves the nuclear window from its hash", () => {
    expect(resolveWindowKind("#/nuclear")).toBe("nuclear");
  });

  it("treats no hash as the main window", () => {
    expect(resolveWindowKind("")).toBe("main");
  });

  it("treats an unrecognized hash as the main window rather than throwing", () => {
    expect(resolveWindowKind("#/something-else")).toBe("main");
  });
});
