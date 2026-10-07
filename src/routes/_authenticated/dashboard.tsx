import { normalize } from "@/lib/analysis";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ErrorState, Loading, Panel, Pill, Score } from "@/components/states";
import { isCompleted, useAnalyses, useCareers, useGoals, usePrimaryGoal, useProfile, useRequirements, useRoadmap, useRunAnalysis, useSkills } from "@/lib/queries";
import { classify, savedScore } from "@/lib/analysis";
import { onboardingProgress } from "@/lib/onboarding";
import { useUserId } from "@/lib/useUser";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: pageHead("Dashboard", "Your career match, skill gaps and roadmap progress."),
  component: Dashboard,
});

const ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function Dashboard() {
  const userId = useUserId();
  const navigate = useNavigate();
  const profile = useProfile(userId);
  const skills = useSkills(userId);
  const goals = useGoals(userId);
  const { career, isLoading: gl } = usePrimaryGoal(userId);
  const analyses = useAnalyses(userId);
  const roadmap = useRoadmap(userId);
  const careers = useCareers();
  const run = useRunAnalysis(userId);
  const latestCareerId = (analyses.data ?? []).find((a) => !career || a.career_id === career.id)?.career_id ?? analyses.data?.[0]?.career_id;
  const reqs = useRequirements(latestCareerId);

  if (profile.isLoading || skills.isLoading || gl || analyses.isLoading || roadmap.isLoading) return <Loading label="Loading your dashboard…" />;
  const err = profile.error || skills.error || analyses.error || roadmap.error || goals.error;
  if (err) return <ErrorState error={err} onRetry={() => { profile.refetch(); skills.refetch(); analyses.refetch(); roadmap.refetch(); goals.refetch(); }} />;

  const prog = onboardingProgress({ profile: profile.data, skillCount: skills.data?.length ?? 0, interestCount: goals.data?.length ?? 0, hasPrimary: !!career });
  const forGoal = (analyses.data ?? []).filter((a) => !career || a.career_id === career.id);
  const latest = forGoal[0] ?? analyses.data?.[0];
  const previous = latest ? (analyses.data ?? []).find((a) => a.career_id === latest.career_id && a.created_at < latest.created_at) : undefined;
  const rows = latest?.results ?? [];
  const score = latest ? savedScore(latest, rows) : null;
  const delta = latest && previous ? score! - savedScore(previous, previous.results) : null;
  const strong = rows.filter((r) => classify(r.current_level, r.required_level) === "STRONG MATCH");
  const impOf = new Map((reqs.data ?? []).map((r) => [normalize(r.skill_name), String(r.importance).toUpperCase()]));
  const badge = (n: string, fallback: string | null) => impOf.get(normalize(n)) ?? fallback ?? "-";
  const gaps = rows.filter((r) => r.current_level < r.required_level).sort((a, b) => (ORDER[a.priority ?? ""] ?? 3) - (ORDER[b.priority ?? ""] ?? 3) || (b.required_level - b.current_level) - (a.required_level - a.current_level));
  const items = roadmap.data ?? [];
  const done = items.filter((i) => isCompleted(i.status)).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const name = profile.data?.full_name?.split(" ")[0];
  const latestTitle = careers.data?.find((c) => c.id === latest?.career_id)?.title;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{name ? `Welcome back, ${name}` : "Welcome to SkillPath"}</h1>
          <p className="mt-1 text-muted-foreground">{career ? <>Primary career goal: <b className="text-foreground">{career.title}</b></> : "Let's set up your skill path."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/skills">Update My Skills</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/careers">Explore Careers</Link></Button>
          {career && !!skills.data?.length && (
            <Button size="sm" variant="accent" disabled={run.isPending} onClick={() => run.mutate(career, { onSuccess: (a) => navigate({ to: "/analysis/$analysisId", params: { analysisId: a.id } }) })}>
              {run.isPending ? "Analysing…" : latest ? "Re-analyze" : "Analyze my skills"}
            </Button>
          )}
        </div>
      </div>

      {!prog.complete && (
        <Panel className="border-primary/40">
          <h2 className="text-lg font-bold">Complete your SkillPath</h2>
          <p className="mt-1 text-sm text-muted-foreground">Next step: <b className="text-foreground">{prog.nextLabel}</b></p>
          <Button asChild className="mt-3" size="sm"><Link to="/onboarding">Continue setup</Link></Button>
        </Panel>
      )}

      {latest ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Panel>
            <p className="text-sm text-muted-foreground">Career match · {latestTitle}</p>
            <div className="my-3 flex items-baseline gap-2">
              <Score value={score!} />
              {delta != null && delta !== 0 && <span className={delta > 0 ? "font-bold text-success" : "font-bold text-destructive"}>{delta > 0 ? "+" : ""}{delta}%</span>}
            </div>
            <p className="text-xs text-muted-foreground">Recent analysis · {new Date(latest.created_at).toLocaleDateString()}</p>
            <Button asChild size="sm" variant="outline" className="mt-4"><Link to="/analysis/$analysisId" params={{ analysisId: latest.id }}>View Analysis</Link></Button>
          </Panel>
          <Panel>
            <h2 className="mb-3 font-bold">Strong skills</h2>
            {strong.length ? <ul className="flex flex-wrap gap-1.5">{strong.map((s) => <li key={s.id} className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">{s.skill_name}</li>)}</ul> : <p className="text-sm text-muted-foreground">No requirements fully met yet.</p>}
          </Panel>
          <Panel>
            <h2 className="mb-3 font-bold">Priority skill gaps</h2>
            {gaps.length ? <ul className="grid gap-2">{gaps.slice(0, 5).map((g) => <li key={g.id} className="flex items-center justify-between text-sm"><span>{g.skill_name} <span className="text-muted-foreground">{g.current_level}→{g.required_level}</span></span><Pill value={badge(g.skill_name, g.priority)} /></li>)}</ul> : <p className="text-sm text-muted-foreground">No gaps — great work!</p>}
          </Panel>
        </div>
      ) : prog.complete ? (
        <Panel><p className="text-sm text-muted-foreground">No analysis yet. Use “Analyze my skills” to see your match for {career?.title}.</p></Panel>
      ) : null}

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Roadmap progress</h2>
          {items.length > 0 && <Button asChild size="sm" variant="outline"><Link to="/roadmap">Continue Roadmap</Link></Button>}
        </div>
        {items.length ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">{done} of {items.length} completed · {pct}%</p>
            <Progress value={pct} className="mt-2" />
          </>
        ) : (
          <div className="mt-2">
            <h3 className="font-semibold">Your personalized roadmap</h3>
            <p className="mt-1 text-sm text-muted-foreground">Generate an AI-powered learning plan based on your current skills, career goal, and priority skill gaps.</p>
            <Button asChild size="sm" variant="accent" className="mt-3"><Link to="/roadmap">Generate AI Roadmap</Link></Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
