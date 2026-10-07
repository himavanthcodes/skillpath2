import { gapReason, yearsOrZero } from "./analysis";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase, errMsg } from "./supabase";
import {
  buildRoadmap,
  buildSummary,
  compareSkills,
  matchScore,
  normalize,
  type Requirement,
} from "./analysis";

export interface Profile { id: string; user_id: string; full_name: string | null; bio: string | null; education: string | null; current_year?: number | string | null; institution?: string | null }
export interface Skill { id: string; user_id: string; name: string; category: string | null; proficiency_level: number | null; years_experience: number | null }
export interface Evidence { id: string; user_id: string; skill_id: string; description: string | null; evidence_type: string | null; created_at: string }
export interface Career { id: string; title: string; category: string | null; description: string | null; short_description: string | null; icon: string | null }
export interface CareerRequirement extends Requirement { id: string; career_id: string }
export interface Goal { id: string; user_id: string; career_id: string; is_primary: boolean }
export interface Analysis { id: string; user_id: string; career_id: string; summary: string | null; match_percentage?: number | null; created_at: string }
export interface AnalysisResult { id: string; analysis_id: string; skill_name: string; required_level: number; current_level: number; priority: string | null }
export interface RoadmapItem { id: string; user_id: string; analysis_id: string | null; title: string; description: string | null; status: string | null; estimated_hours: number | null; week_number?: number | null; skill?: string | null; tasks?: unknown; created_at: string; updated_at: string }

// Status values written to roadmap_items.status
export const ROADMAP_STATUSES = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
] as const;
export const isCompleted = (s: string | null) => String(s ?? "").toLowerCase() === "completed";

async function run<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(errMsg(error));
  return data;
}

// ---------- catalog ----------
export const useCareers = () =>
  useQuery({
    queryKey: ["careers"],
    queryFn: () => run(supabase.from("careers").select("id,title,category,description,short_description,icon").order("title")) as Promise<Career[]>,
    staleTime: 5 * 60_000,
  });

export const useRequirements = (careerId?: string) =>
  useQuery({
    queryKey: ["requirements", careerId],
    enabled: !!careerId,
    queryFn: () =>
      run(supabase.from("career_requirements").select("id,career_id,skill_name,required_level,importance,description").eq("career_id", careerId!).order("required_level", { ascending: false })) as Promise<CareerRequirement[]>,
  });

export const useAllRequirements = () =>
  useQuery({
    queryKey: ["requirements-all"],
    staleTime: 10 * 60_000,
    queryFn: () => run(supabase.from("career_requirements").select("id,career_id,skill_name,required_level,importance,description")) as Promise<CareerRequirement[]>,
  });

export const useSkillNames = () =>
  useQuery({
    queryKey: ["skill-names"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const rows = (await run(supabase.from("career_requirements").select("skill_name"))) as { skill_name: string }[];
      const map = new Map<string, string>();
      rows.forEach((r) => map.set(normalize(r.skill_name), r.skill_name));
      return [...map.values()].sort((a, b) => a.localeCompare(b));
    },
  });

// ---------- profile ----------
export const useProfile = (userId: string) =>
  useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const rows = (await run(supabase.from("profiles").select("*").eq("user_id", userId).order("created_at").limit(1))) as Profile[];
      return rows[0] ?? null;
    },
  });

/** Create the profile row once; never duplicates. */
/** Decode the non-secret claims (sub, role, aud, exp) of the access token for diagnostics. */
function jwtClaims(token?: string | null): Record<string, unknown> | null {
  try {
    if (!token) return null;
    const part = token.split(".")[1] ?? "";
    const p = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return { sub: p.sub, role: p.role, aud: p.aud, exp: p.exp, expired: p.exp * 1000 < Date.now() };
  } catch {
    return { undecodable: true };
  }
}

export async function ensureProfile(userId: string, fullName?: string | null) {
  const { data, error } = await supabase.from("profiles").select("id").eq("user_id", userId).limit(1);
  if (error) throw new Error(errMsg(error));
  if (data && data.length) return;
  const payload = { id: userId, user_id: userId, full_name: fullName ?? null };
  const { data: s } = await supabase.auth.getSession();
  const { data: u } = await supabase.auth.getUser();
  const diag = {
    passedUserId: userId,
    sessionUserId: s.session?.user.id ?? null,
    verifiedUserId: u.user?.id ?? null,
    tokenClaims: jwtClaims(s.session?.access_token),
    payload,
  };
  console.info("[profiles INSERT diag] before", diag);
  const ins = await supabase.from("profiles").insert(payload);
  if (ins.error) {
    console.error("[profiles INSERT diag] error", {
      ...diag,
      status: ins.status,
      code: ins.error.code,
      message: ins.error.message,
      details: ins.error.details,
      hint: ins.error.hint,
    });
  }
  if (ins.error && ins.error.code !== "23505") throw new Error(errMsg(ins.error));
}

export function useSaveProfile(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { full_name: string; education: string; bio: string; current_year: number | null; institution: string | null }) => {
      await ensureProfile(userId);
      await run(supabase.from("profiles").update({ ...v, updated_at: new Date().toISOString() }).eq("user_id", userId).select());
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile", userId] }); toast.success("Profile saved"); },
    onError: (e) => toast.error(errMsg(e)),
  });
}

// ---------- skills ----------
export const useSkills = (userId: string) =>
  useQuery({
    queryKey: ["skills", userId],
    queryFn: () => run(supabase.from("skills").select("*").eq("user_id", userId).order("name")) as Promise<Skill[]>,
  });

export function useSkillMutations(userId: string) {
  const qc = useQueryClient();
  const done = () => { qc.setQueryData(["skills-changed", userId], true); return qc.invalidateQueries({ queryKey: ["skills", userId] }); };
  const add = useMutation({
    mutationFn: async (v: { name: string; category: string | null; proficiency_level: number; years_experience: number | null }) => {
      const existing = (qc.getQueryData(["skills", userId]) as Skill[] | undefined) ?? [];
      if (existing.some((s) => normalize(s.name) === normalize(v.name))) throw new Error(`You already added ${v.name}.`);
      await run(supabase.from("skills").insert({ ...v, years_experience: yearsOrZero(v.years_experience), user_id: userId }).select());
    },
    onSuccess: () => { done(); toast.success("Skill added"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const update = useMutation({
    mutationFn: async ({ id, ...v }: { id: string; proficiency_level?: number; years_experience?: number | null; category?: string | null }) =>
      run(supabase.from("skills").update({ ...v, ...("years_experience" in v ? { years_experience: yearsOrZero(v.years_experience) } : {}), updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).select()),
    onSuccess: done,
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await run(supabase.from("skill_evidence").delete().eq("skill_id", id).eq("user_id", userId));
      await run(supabase.from("skills").delete().eq("id", id).eq("user_id", userId));
    },
    onSuccess: () => { done(); qc.invalidateQueries({ queryKey: ["evidence", userId] }); toast.success("Skill removed"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return { add, update, remove };
}

// ---------- evidence ----------
export const EVIDENCE_TYPES = [
  { value: "personal_project", label: "Personal Project" },
  { value: "college_project", label: "College Project" },
  { value: "internship", label: "Internship" },
  { value: "job", label: "Job" },
  { value: "hackathon", label: "Hackathon" },
  { value: "course", label: "Course" },
  { value: "self_learning", label: "Self Learning" },
  { value: "other", label: "Other" },
];
// Labels for values saved by earlier versions of the app.
export const LEGACY_EVIDENCE_LABELS: Record<string, string> = { project: "Project", work: "Work / internship", certificate: "Certificate", self_study: "Self-study" };
export const evidenceLabel = (v: string | null) => EVIDENCE_TYPES.find((t) => t.value === v)?.label ?? LEGACY_EVIDENCE_LABELS[v ?? ""] ?? v ?? "";

export const useEvidence = (userId: string) =>
  useQuery({
    queryKey: ["evidence", userId],
    queryFn: () => run(supabase.from("skill_evidence").select("*").eq("user_id", userId).order("created_at", { ascending: false })) as Promise<Evidence[]>,
  });

export function useEvidenceMutations(userId: string) {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["evidence", userId] });
  const add = useMutation({
    mutationFn: (v: { skill_id: string; evidence_type: string; description: string }) =>
      run(supabase.from("skill_evidence").insert({ ...v, user_id: userId }).select()),
    onSuccess: () => { done(); toast.success("Answer saved"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const update = useMutation({
    mutationFn: ({ id, ...v }: { id: string; evidence_type: string; description: string }) =>
      run(supabase.from("skill_evidence").update(v).eq("id", id).eq("user_id", userId).select()),
    onSuccess: () => { done(); toast.success("Answer updated"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => run(supabase.from("skill_evidence").delete().eq("id", id).eq("user_id", userId)),
    onSuccess: done,
    onError: (e) => toast.error(errMsg(e)),
  });
  return { add, update, remove };
}

// ---------- goals ----------
export const useGoals = (userId: string) =>
  useQuery({
    queryKey: ["goals", userId],
    queryFn: () => run(supabase.from("career_goals").select("*").eq("user_id", userId)) as Promise<Goal[]>,
  });

export function usePrimaryGoal(userId: string) {
  const goals = useGoals(userId);
  const careers = useCareers();
  const goal = goals.data?.find((g) => g.is_primary) ?? null;
  const career = goal ? careers.data?.find((c) => c.id === goal.career_id) ?? null : null;
  return { goal, career, isLoading: goals.isLoading || careers.isLoading, error: goals.error || careers.error };
}

export function useSetPrimaryGoal(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (careerId: string) => {
      const goals = (await run(supabase.from("career_goals").select("*").eq("user_id", userId))) as Goal[];
      // 1. clear previous primary
      await run(supabase.from("career_goals").update({ is_primary: false, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("is_primary", true).neq("career_id", careerId).select());
      // 2. set new primary
      const existing = goals.find((g) => g.career_id === careerId);
      if (existing) await run(supabase.from("career_goals").update({ is_primary: true, updated_at: new Date().toISOString() }).eq("id", existing.id).select());
      else await run(supabase.from("career_goals").insert({ user_id: userId, career_id: careerId, is_primary: true }).select());
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals", userId] }); toast.success("Career goal updated"); },
    onError: (e) => toast.error(errMsg(e)),
  });
}

/** Career interests = career_goals rows. Exactly one may be primary. */
export function useToggleInterest(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ careerId, on }: { careerId: string; on: boolean }) => {
      const goals = (await run(supabase.from("career_goals").select("*").eq("user_id", userId).eq("career_id", careerId))) as Goal[];
      if (on) {
        if (!goals.length) await run(supabase.from("career_goals").insert({ user_id: userId, career_id: careerId, is_primary: false }).select());
      } else {
        if (goals.some((g) => g.is_primary)) throw new Error("This is your primary goal. Choose another primary goal before removing it.");
        await run(supabase.from("career_goals").delete().eq("user_id", userId).eq("career_id", careerId));
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals", userId] }),
    onError: (e) => toast.error(errMsg(e)),
  });
}

// ---------- analyses ----------
export const useAnalyses = (userId: string) =>
  useQuery({
    queryKey: ["analyses", userId],
    queryFn: async () => {
      const list = (await run(supabase.from("analyses").select("*").eq("user_id", userId).order("created_at", { ascending: false }))) as Analysis[];
      if (!list.length) return [] as (Analysis & { results: AnalysisResult[] })[];
      const results = (await run(supabase.from("analysis_results").select("*").in("analysis_id", list.map((a) => a.id)))) as AnalysisResult[];
      return list.map((a) => ({ ...a, results: results.filter((r) => r.analysis_id === a.id) }));
    },
  });

export const useAnalysis = (userId: string, id: string) =>
  useQuery({
    queryKey: ["analysis", id],
    queryFn: async () => {
      const a = (await run(supabase.from("analyses").select("*").eq("id", id).eq("user_id", userId).maybeSingle())) as Analysis | null;
      if (!a) return null;
      const results = (await run(supabase.from("analysis_results").select("*").eq("analysis_id", id))) as AnalysisResult[];
      return { ...a, results };
    },
  });

export function useRunAnalysis(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (career: Career) => {
      const skills = (await run(supabase.from("skills").select("*").eq("user_id", userId))) as Skill[];
      const reqs = (await run(supabase.from("career_requirements").select("*").eq("career_id", career.id))) as CareerRequirement[];
      if (!reqs.length) throw new Error(`No requirements are defined for ${career.title} yet.`);
      const rows = compareSkills(skills, reqs);
      const base = { user_id: userId, career_id: career.id, summary: buildSummary(career.title, rows) };
      let ins = await supabase.from("analyses").insert({ ...base, match_percentage: matchScore(rows) }).select().single();
      if (ins.error && ["42703", "22P02", "PGRST204"].includes(String(ins.error.code))) ins = await supabase.from("analyses").insert(base).select().single();
      if (ins.error) throw new Error(errMsg(ins.error));
      const a = ins.data as Analysis;
      const payload = rows.map((r) => ({ analysis_id: a.id, skill_name: r.skill_name, required_level: r.required_level, current_level: r.current_level, gap_level: Math.max(0, r.required_level - r.current_level), priority: r.priority, reason: gapReason(r.current_level, r.required_level) }));
      const REQUIRED = ["analysis_id", "skill_name", "required_level", "current_level", "gap_level", "priority", "reason"] as const;
      for (const p of payload) {
        const missing = REQUIRED.filter((k) => {
          const v = (p as Record<string, unknown>)[k];
          return v === null || v === undefined || (typeof v === "string" && !v.trim()) || (typeof v === "number" && Number.isNaN(v));
        });
        if (missing.length) {
          await supabase.from("analyses").delete().eq("id", a.id);
          throw new Error(`Analysis row for ${p.skill_name} is missing: ${missing.join(", ")}.`);
        }
      }
      // Temporary diagnostic (no secrets): exact rows sent to analysis_results.
      console.log("[analysis_results INSERT payload]", JSON.stringify(payload, null, 2));
      const res = await supabase.from("analysis_results").insert(payload);
      if (res.error) console.error("[analysis_results INSERT error]", JSON.stringify(res.error));
      if (res.error) {
        await supabase.from("analyses").delete().eq("id", a.id);
        throw new Error(errMsg(res.error));
      }
      return a;
    },
    onSuccess: () => { qc.setQueryData(["skills-changed", userId], false); qc.invalidateQueries({ queryKey: ["analyses", userId] }); toast.success("Analysis saved"); },
    onError: (e) => toast.error(errMsg(e)),
  });
}

// ---------- roadmap ----------
export const useRoadmap = (userId: string) =>
  useQuery({
    queryKey: ["roadmap", userId],
    queryFn: () => run(supabase.from("roadmap_items").select("*").eq("user_id", userId).order("created_at", { ascending: false })) as Promise<RoadmapItem[]>,
  });

export function useGenerateRoadmap(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (analysis: Analysis & { results: AnalysisResult[] }) => {
      const existing = (await run(supabase.from("roadmap_items").select("id").eq("user_id", userId).eq("analysis_id", analysis.id))) as { id: string }[];
      if (existing.length) throw new Error("A roadmap already exists for this analysis.");
      const reqs = (await run(supabase.from("career_requirements").select("skill_name,description").eq("career_id", analysis.career_id))) as { skill_name: string; description: string | null }[];
      const desc = Object.fromEntries(reqs.map((r) => [normalize(r.skill_name), r.description]));
      const drafts = buildRoadmap(analysis.results, desc);
      if (!drafts.length) throw new Error("No skill gaps — nothing to add to the roadmap.");
      const rowsFull = drafts.map((d) => ({ ...d, user_id: userId, analysis_id: analysis.id, status: "not_started" }));
      let ins = await supabase.from("roadmap_items").insert(rowsFull).select();
      if (ins.error && ["42703", "22P02", "PGRST204"].includes(String(ins.error.code))) {
        // fall back to core columns if the extra ones have a different type
        ins = await supabase.from("roadmap_items").insert(rowsFull.map(({ week_number: _w, skill: _s, tasks: _t, ...rest }) => rest)).select();
      }
      if (ins.error) throw new Error(errMsg(ins.error));
      return drafts.length;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ["roadmap", userId] }); toast.success(`Roadmap created with ${n} items`); },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useSetRoadmapStatus(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      run(supabase.from("roadmap_items").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).select()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roadmap", userId] }),
    onError: (e) => toast.error(errMsg(e)),
  });
}

/** True after the user edits skills in this session and hasn't re-analysed yet. */
export const useSkillsChanged = (userId: string) =>
  useQuery({ queryKey: ["skills-changed", userId], queryFn: () => false, staleTime: Infinity, gcTime: Infinity });
