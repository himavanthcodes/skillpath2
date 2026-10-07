import { describe, it, expect } from "vitest";
import { gapLevel, yearsOrZero } from "./analysis";
describe("gapLevel", () => {
  it("none when met", () => expect(gapLevel(4, 4)).toBe("NONE"));
  it("low at 1", () => expect(gapLevel(3, 4)).toBe("LOW"));
  it("medium at 2", () => expect(gapLevel(2, 4)).toBe("MEDIUM"));
  it("high at 3+", () => expect(gapLevel(0, 4)).toBe("HIGH"));
});
describe("yearsOrZero", () => {
  it("blank is 0", () => { expect(yearsOrZero(null)).toBe(0); expect(yearsOrZero("")).toBe(0); });
  it("keeps value", () => expect(yearsOrZero(1)).toBe(1));
});
import { gapReason } from "./analysis";
describe("gapReason", () => {
  it("met", () => expect(gapReason(4, 4)).toMatch(/meet or exceed/));
  it("1 level", () => expect(gapReason(3, 4)).toMatch(/^You are 1 level below/));
  it("2 levels", () => expect(gapReason(2, 4)).toMatch(/^You are 2 levels below/));
  it("3+", () => expect(gapReason(1, 4)).toMatch(/significantly below/));
});
