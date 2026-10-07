// Deterministic SkillPath skill-gap analysis. No AI, no randomness:
// the same skills + the same requirements always produce the same output.

export type Importance = "HIGH" | "MEDIUM" | "LOW" | string;

export interface Requirement {
  skill_name: string;
  required_level: number;
  importance: Importance;
  description?: string | null;
}

export interface UserSkill {
  name: string;
  proficiency_level: number | null;
}

export type MatchStatus = "STRONG MATCH" | "NEEDS IMPROVEMENT" | "SKILL GAP";
export type Priority = "HIGH" | "MEDIUM" | "LOW";

export interface SkillComparison {
  skill_name: string;
  required_level: number;
  current_level: number;
  gap: number;
  status: MatchStatus;
  priority: Priority;
  importance: Importance;
  description?: string | null;
}

export const normalize = (s: string) => s.trim().toLowerCase();

export function classify(current: number, required: number): MatchStatus {
  if (current >= required) return "STRONG MATCH";
  if (current <= 0) return "SKILL GAP";
  return "NEEDS IMPROVEMENT";
}

export const IMPORTANCE_WEIGHT: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
export const weightOf = (importance?: Importance | null) => IMPORTANCE_WEIGHT[String(importance ?? "").toUpperCase()] ?? 2;

/**
 * Priority of a gap. HIGH-importance gaps are always HIGH.
 * MEDIUM importance: HIGH if 3+ levels short, else MEDIUM.
 * LOW importance: MEDIUM if 3+ levels short, else LOW.
 */
export function priorityFor(current: number, required: number, importance: Importance): Priority {
  const gap = required - current;
  if (gap <= 0) return "LOW";
  const imp = String(importance).toUpperCase();
  if (imp === "HIGH") return "HIGH";
  if (imp === "LOW") return gap >= 3 ? "MEDIUM" : "LOW";
  return gap >= 3 ? "HIGH" : "MEDIUM";
}

export function priorityReason(current: number, required: number, importance?: Importance | null): string {
  const gap = required - current;
  if (gap <= 0) return "You meet or exceed the required level.";
  const imp = String(importance ?? "MEDIUM").toLowerCase();
  const lv = gap === 1 ? "1 level" : `${gap} levels`;
  const base = current === 0 ? `You haven't added this skill yet; the role needs level ${required}` : `You are ${lv} below the required level ${required}`;
  return `${base}, and it is a ${imp}-importance skill for this role.`;
}

/**
 * Match % weighted by importance (HIGH 3, MEDIUM 2, LOW 1):
 * sum(w * min(current, required)) / sum(w * required).
 */
export function matchScore(rows: { current_level: number; required_level: number; importance?: Importance | null }[]): number {
  let need = 0, have = 0;
  for (const r of rows) {
    const w = weightOf(r.importance);
    need += w * Number(r.required_level);
    have += w * Math.min(Number(r.current_level), Number(r.required_level));
  }
  return need <= 0 ? 0 : Math.round((have / need) * 100);
}

/** Score saved with an analysis; falls back to the % in the summary, then to unweighted readiness. */
export function savedScore(a: { match_percentage?: number | null; summary?: string | null }, rows: { current_level: number; required_level: number }[]): number {
  if (a.match_percentage != null && !Number.isNaN(Number(a.match_percentage))) return Math.round(Number(a.match_percentage));
  const m = a.summary?.match(/(\d{1,3})%/);
  if (m) return Number(m[1]);
  return readinessScore(rows);
}

export function compareSkills(skills: UserSkill[], requirements: Requirement[]): SkillComparison[] {
  const levels = new Map<string, number>();
  for (const s of skills) {
    const lvl = Number(s.proficiency_level ?? 0);
    const key = normalize(s.name);
    levels.set(key, Math.max(levels.get(key) ?? 0, lvl));
  }
  const order: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return requirements
    .map((r) => {
      const required = Number(r.required_level);
      const current = levels.get(normalize(r.skill_name)) ?? 0;
      return {
        skill_name: r.skill_name,
        required_level: required,
        current_level: current,
        gap: Math.max(0, required - current),
        status: classify(current, required),
        priority: priorityFor(current, required, r.importance),
        importance: r.importance,
        description: r.description ?? null,
      };
    })
    .sort(
      (a, b) =>
        order[a.priority] - order[b.priority] || b.gap - a.gap || a.skill_name.localeCompare(b.skill_name),
    );
}

/** Readiness % = sum(min(current, required)) / sum(required), rounded. */
export function readinessScore(rows: { current_level: number; required_level: number }[]): number {
  const req = rows.reduce((t, r) => t + Number(r.required_level), 0);
  if (req <= 0) return 0;
  const have = rows.reduce((t, r) => t + Math.min(Number(r.current_level), Number(r.required_level)), 0);
  return Math.round((have / req) * 100);
}

export function countStatuses(rows: { current_level: number; required_level: number }[]) {
  let strong = 0, improve = 0, gaps = 0;
  for (const r of rows) {
    const s = classify(Number(r.current_level), Number(r.required_level));
    if (s === "STRONG MATCH") strong++;
    else if (s === "SKILL GAP") gaps++;
    else improve++;
  }
  return { strong, improve, gaps };
}

export function buildSummary(careerTitle: string, rows: SkillComparison[]): string {
  const { strong, improve, gaps } = countStatuses(rows);
  return `Match ${matchScore(rows)}% for ${careerTitle}: ${strong} strong, ${improve} to improve, ${gaps} missing.`;
}

export interface RoadmapDraft {
  week_number: number;
  skill: string;
  tasks: string[];
  title: string;
  description: string;
  estimated_hours: number;
}

/** Roadmap from the highest-priority gaps (max 6). 4 hours per missing level. */
export function buildRoadmap(
  rows: { skill_name: string; current_level: number; required_level: number; priority?: string | null }[],
  descriptions: Record<string, string | null | undefined> = {},
): RoadmapDraft[] {
  const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return rows
    .filter((r) => Number(r.current_level) < Number(r.required_level))
    .sort(
      (a, b) =>
        (order[String(a.priority)] ?? 3) - (order[String(b.priority)] ?? 3) ||
        b.required_level - b.current_level - (a.required_level - a.current_level) ||
        a.skill_name.localeCompare(b.skill_name),
    )
    .slice(0, 6)
    .map((r, i) => {
      const gap = Number(r.required_level) - Number(r.current_level);
      const what = descriptions[normalize(r.skill_name)];
      return {
        week_number: i + 1,
        skill: r.skill_name,
        tasks: [
          `Review the core concepts of ${r.skill_name}`,
          `Practise ${r.skill_name} for ${gap * 4} hours this week`,
          `Build a small project that uses ${r.skill_name}`,
        ],
        title:
          Number(r.current_level) === 0
            ? `Learn ${r.skill_name} fundamentals`
            : `Improve ${r.skill_name} to level ${r.required_level}`,
        description: `${what ? what + " " : ""}Study the core concepts, practise daily and build a small project using ${r.skill_name}.`,
        estimated_hours: gap * 4,
      };
    });
}

export type GapLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH";
/** gap = required - current: <=0 NONE, 1 LOW, 2 MEDIUM, >=3 HIGH. */
export function gapLevel(current: number, required: number): GapLevel {
  const gap = Number(required) - Number(current);
  if (gap <= 0) return "NONE";
  if (gap === 1) return "LOW";
  if (gap === 2) return "MEDIUM";
  return "HIGH";
}

/** Years is optional in the UI but required in the DB: blank/invalid → 0. */
export function yearsOrZero(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Deterministic reason saved on every analysis_results row (never null). */
export function gapReason(current: number, required: number): string {
  const gap = Number(required) - Number(current);
  if (gap <= 0) return "You currently meet or exceed the required level for this skill.";
  if (gap === 1) return "You are 1 level below the required proficiency. A small improvement will strengthen your readiness.";
  if (gap === 2) return "You are 2 levels below the required proficiency. This skill should be improved as part of your preparation.";
  return "You are significantly below the required proficiency. This is an important skill gap to address.";
}
