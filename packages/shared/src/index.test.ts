import { describe, expect, it } from "vitest";
import { codeCandidates, normalizeCode } from "./index";

describe("normalizeCode (mirrors data/common.py)", () => {
  it("uppercases, strips accents, spaces and separators", () => {
    expect(normalizeCode(" Atlántico ")).toBe("ATLANTICO");
    expect(normalizeCode("1.234,5")).toBe("12345");
    expect(normalizeCode("Illa Verde")).toBe("ILLAVERDE");
    expect(normalizeCode("Costa Atlántica")).toBe("COSTAATLANTICA");
  });
  it("accepts leading zeros for numbers", () => {
    expect(codeCandidates("00042", "digits_only")).toContain("42");
  });
});
