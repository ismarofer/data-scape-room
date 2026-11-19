import { describe, expect, it } from "vitest";
import { analyze, decode, fileReport, parseCsv, sha256Hex } from "./csv";

describe("csv wizard", () => {
  it("sha256 matches known vectors", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("a".repeat(1000))).toBe("41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
  });
  it("parses quotes and detects wrong delimiter", () => {
    expect(parseCsv('a,b\n"x,y",2\n', ",")[1].cells).toEqual(["x,y", "2"]);
    const a = analyze("id;fecha\n1;2023-01-01 10:00:00\n", { delimiter: ",", encoding: "utf-8", dateFormat: "iso" }, { name: "t", key: ["id"], dateCols: ["fecha"] });
    expect(a.header).toHaveLength(1);
    expect(fileReport(a, { name: "t", key: ["id"], dateCols: [] })).toContain("ids=none");
  });
  it("flags mojibake and bad dates", () => {
    const bytes = new Uint8Array([105, 100, 59, 100, 10, 49, 59, 0xe1, 10]); // id;d / 1;a-acute (latin-1)
    const bad = analyze(decode(bytes, "utf-8"), { delimiter: ";", encoding: "utf-8", dateFormat: "none" }, { name: "t", key: ["id"], dateCols: [] });
    expect(bad.mojibake).toBe(1);
    const ok = analyze(decode(bytes, "latin-1"), { delimiter: ";", encoding: "latin-1", dateFormat: "none" }, { name: "t", key: ["id"], dateCols: [] });
    expect(ok.mojibake).toBe(0);
  });
});
