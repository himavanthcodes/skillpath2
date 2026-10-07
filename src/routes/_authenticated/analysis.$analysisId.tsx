import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Empty, ErrorState, Loading, Panel, Pill, Score } from "@/components/states";
import { useAnalyses, useAnalysis, useCareers, useGenerateRoadmap, useRequirements, useRoadmap } from "@/lib/queries";
import { classify, normalize, priorityReason, savedScore } from "@/lib/analysis";
import { useUserId } from "@/lib/useUser";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/analysis/$analysisId")({
  head: pageHead("Analysis result", "Your match score, strengths and skill gaps."),
  component: AnalysisDetail,
});

const ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function AnalysisDetail() {
  const { analysisId } = Route.useParams();
  const userId = useUserId();
  const q = useAnalysis(userId, analysisId);
  const all = useAnalyses(userId);
  const careers = useCareers();
  const reqs = useRequirements(q.data?.career_id);
  const roadmap = useRoadmap(userId);
  const gen = useGenerateRoadmap(userId);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <Empty title="Analysis not found" cta="Back to history" to="/analysis" />;
  const a = q.data;
  const imp = new Map((reqs.data ?? []).map((r) => [normalize(r.skill_name), String(r.importance)]));
  const rows = [...a.results]
    .map((r) => ({ ...r, importance: imp.get(normalize(r.skill_name)) ?? null, status: classify(r.current_level, r.required_level), gap: Math.max(0, r.required_level - r.current_level) }))
    .sort((x, y) => (x.gap ? 0 : 1) - (y.gap ? 0 : 1) || (ORDER[x.priority ?? ""] ?? 3) - (ORDER[y.priority ?? ""] ?? 3) || y.gap - x.gap || x.skill_name.localeCompare(y.skill_name));
  const score = savedScore(a, rows);
  const strong = rows.filter((r) => r.status === "STRONG MATCH");
  const improve = rows.filter((r) => r.status === "NEEDS IMPROVEMENT");
  const missing = rows.filter((r) => r.status === "SKILL GAP");
  const priority = rows.filter((r) => r.gap > 0 && (r.importance ? r.importance.toUpperCase() : r.priority) === "HIGH");
  const prev = (all.data ?? []).find((x) => x.career_id === a.career_id && x.created_at < a.created_at);
  const delta = prev ? score - savedScore(prev, prev.results) : null;
  const hasRoadmap = roadmap.data?.some((r) => r.analysis_id === a.id);
  const careerTitle = careers.data?.find((x) => x.id === a.career_id)?.title ?? "Career";

  return (
    <div>
      <Link to="/analysis" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> History</Link>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="grid content-start gap-4">
          <Panel>
            <p className="text-sm text-muted-foreground">Career match for</p>
            <h1 className="text-2xl font-extrabold">{careerTitle}</h1>
            <div className="my-4 flex items-baseline gap-3">
              <Score value={score} />
              {delta != null && delta !== 0 && <span className={delta > 0 ? "font-bold text-success" : "font-bold text-destructive"}>{delta > 0 ? "+" : ""}{delta}%</span>}
            </div>
            <Progress value={score} />
            {delta != null && <p className="mt-2 text-xs text-muted-foreground">Compared with your previous analysis on {new Date(prev!.created_at).toLocaleDateString()}.</p>}
            <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-success-soft p-2"><dt className="text-xs text-success">Strong</dt><dd className="text-xl font-bold">{strong.length}</dd></div>
              <div className="rounded-lg bg-warning-soft p-2"><dt className="text-xs text-warning">Improve</dt><dd className="text-xl font-bold">{improve.length}</dd></div>
              <div className="rounded-lg bg-destructive-soft p-2"><dt className="text-xs text-destructive">Gaps</dt><dd className="text-xl font-bold">{missing.length}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">Score weights each required skill by importance (high ×3, medium ×2, low ×1). Analysed {new Date(a.created_at).toLocaleString()}.</p>
            <div className="mt-5 grid gap-2">
              {hasRoadmap ? (
                <Button asChild variant="outline"><Link to="/roadmap">View roadmap</Link></Button>
              ) : (
                <Button variant="accent" disabled={gen.isPending || roadmap.isLoading || !rows.some((r) => r.gap)} onClick={() => gen.mutate(a)}>
                  {gen.isPending ? "Building your personalized roadmap..." : "Generate AI Roadmap"}
                </Button>

              )}
              <Button asChild variant="ghost"><Link to="/skills">Update my skills</Link></Button>
            </div>
          </Panel>
          <Panel>
            <h2 className="mb-2 font-bold">Priority gaps</h2>
            {priority.length ? <ul className="flex flex-wrap gap-1.5">{priority.map((r) => <li key={r.id} className="rounded-full bg-warm-soft px-2.5 py-0.5 text-xs font-semibold text-warm-foreground">{r.skill_name}</li>)}</ul> : <p className="text-sm text-muted-foreground">No high-priority gaps.</p>}
            <h2 className="mb-2 mt-4 font-bold">Strong skills</h2>
            {strong.length ? <ul className="flex flex-wrap gap-1.5">{strong.map((r) => <li key={r.id} className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">{r.skill_name}</li>)}</ul> : <p className="text-sm text-muted-foreground">No requirements fully met yet.</p>}
          </Panel>
        </div>
        <Panel>
          <h2 className="mb-3 text-xl font-bold">Skill by skill</h2>
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-semibold">{r.skill_name}</p>
                  <p className="text-sm tabular-nums text-muted-foreground">You {r.current_level} / 5 · Required {r.required_level} · Gap {r.gap}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{priorityReason(r.current_level, r.required_level, r.importance)}</p>
                </div>
                <div className="flex gap-1.5">
                  <Pill value={r.status} />
                  {r.gap > 0 && <Pill value={r.importance ? r.importance.toUpperCase() : r.priority ?? "-"} />}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
