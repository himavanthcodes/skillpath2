/** roadmap_items.tasks may come back as an array, a JSON string, or newline text. */
export function parseTasks(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p.map(String).filter(Boolean);
    } catch { /* plain text */ }
    return v.split("\n").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Input package for a future AI-personalised roadmap. The deterministic
 * analysis stays the source of truth for requirements, scores and gaps;
 * the AI only explains and sequences.
 */
export interface RoadmapContext {
  profile: { full_name: string | null; education: string | null; current_year: unknown; institution: string | null; bio: string | null } | null;
  skills: { name: string; category: string | null; proficiency_level: number | null; years_experience: number | null }[];
  evidence: { skill: string; type: string | null; description: string | null }[];
  career: { title: string; category: string | null };
  requirements: { skill_name: string; required_level: number; importance: string }[];
  matchScore: number;
  gaps: { skill_name: string; current_level: number; required_level: number; priority: string | null }[];
}

export function buildRoadmapContext(input: Omit<RoadmapContext, "gaps"> & { results: RoadmapContext["gaps"] }): RoadmapContext {
  const { results, ...rest } = input;
  return { ...rest, gaps: results.filter((r) => r.current_level < r.required_level) };
}

/**
 * Extracts the personalized AI roadmap summary from an analysis summary string, if present.
 */
export function extractRoadmapSummary(analysisSummary: string | null | undefined): string | null {
  if (!analysisSummary) return null;
  const match =
    analysisSummary.match(/AI Roadmap:\s*([\s\S]+)$/i) ||
    analysisSummary.match(/Roadmap Summary:\s*([\s\S]+)$/i);

  const raw = match?.[1];
  return raw ? raw.trim() : null;
}



