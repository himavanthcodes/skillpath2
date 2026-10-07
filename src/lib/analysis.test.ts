import { describe, it, expect } from "vitest";
import { compareSkills, readinessScore, buildRoadmap, classify } from "./analysis";

const reqs = [
  { skill_name: "React", required_level: 4, importance: "HIGH" },
  { skill_name: "Git", required_level: 3, importance: "MEDIUM" },
  { skill_name: "CSS", required_level: 2, importance: "MEDIUM" },
];

describe("analysis", () => {
  it("matches skill names case-insensitively", () => {
    const r = compareSkills([{ name: "react", proficiency_level: 4 }], reqs);
    expect(r.find((x) => x.skill_name === "React")?.current_level).toBe(4);
  });
  it("missing skills get current level 0 and SKILL GAP", () => {
    const r = compareSkills([], reqs);
    expect(r.every((x) => x.current_level === 0 && x.status === "SKILL GAP")).toBe(true);
  });
  it("classifies partial skill as NEEDS IMPROVEMENT", () => {
    expect(classify(2, 4)).toBe("NEEDS IMPROVEMENT");
  });
  it("readiness is capped per requirement", () => {
    // React 5/4 -> 4, Git 1/3 -> 1, CSS 0/2 -> 0 => 5/9 = 56%
    const r = compareSkills(
      [{ name: "React", proficiency_level: 5 }, { name: "Git", proficiency_level: 1 }],
      reqs,
    );
    expect(readinessScore(r)).toBe(56);
  });
  it("roadmap uses 4 hours per missing level and skips strong matches", () => {
    const r = compareSkills([{ name: "React", proficiency_level: 4 }, { name: "Git", proficiency_level: 1 }], reqs);
    const road = buildRoadmap(r);
    expect(road.map((x) => x.estimated_hours)).toEqual([8, 8]);
    expect(road.some((x) => x.title.includes("React"))).toBe(false);
  });
});

import { matchScore, priorityFor, savedScore } from "./analysis";
import { joinEducation, splitEducation } from "./profile";
import { onboardingProgress } from "./onboarding";

describe("weighted match score", () => {
  it("weights HIGH x3, MEDIUM x2, LOW x1", () => {
    // HIGH 4/4 -> 12/12, LOW 0/4 -> 0/4  => 12/16 = 75%
    expect(matchScore([
      { current_level: 4, required_level: 4, importance: "HIGH" },
      { current_level: 0, required_level: 4, importance: "LOW" },
    ])).toBe(75);
  });
  it("caps over-qualified skills at the required level", () => {
    expect(matchScore([{ current_level: 5, required_level: 3, importance: "MEDIUM" }])).toBe(100);
  });
  it("prefers the saved match_percentage", () => {
    expect(savedScore({ match_percentage: 62, summary: "Match 10%" }, [])).toBe(62);
    expect(savedScore({ summary: "Match 41% for X" }, [])).toBe(41);
  });
});

describe("priority", () => {
  it("HIGH-importance gaps are high priority", () => expect(priorityFor(2, 4, "HIGH")).toBe("HIGH"));
  it("MEDIUM-importance gap of 2 is medium", () => expect(priorityFor(1, 3, "MEDIUM")).toBe("MEDIUM"));
  it("met requirements are low", () => expect(priorityFor(4, 4, "HIGH")).toBe("LOW"));
});

describe("profile & onboarding", () => {
  it("round-trips education level and branch", () => {
    expect(splitEducation(joinEducation("B.Tech / B.E.", "Computer Science"))).toEqual({ level: "B.Tech / B.E.", branch: "Computer Science" });
  });
  it("experience step never blocks onboarding", () => {
    const p = onboardingProgress({ profile: { full_name: "A", education: "BCA" }, skillCount: 1, interestCount: 1, hasPrimary: true });
    expect(p.complete).toBe(true);
  });
  it("points to Career Interests when none chosen", () => {
    expect(onboardingProgress({ profile: { full_name: "A", education: "BCA" }, skillCount: 2, interestCount: 0, hasPrimary: false }).nextLabel).toBe("Career Interests");
  });
});
