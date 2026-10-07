import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, ErrorState, Loading, PageHeader, Panel, Score } from "@/components/states";
import { useAnalyses, useCareers, usePrimaryGoal, useRunAnalysis, useSkills } from "@/lib/queries";
import { countStatuses, savedScore } from "@/lib/analysis";
import { useUserId } from "@/lib/useUser";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/analysis/")({
  head: pageHead("Analysis history", "Your skill-gap analyses over time."),
  component: AnalysisPage,
});

function AnalysisPage() {
  const userId = useUserId();
  const navigate = useNavigate();
  const { career, isLoading: goalLoading } = usePrimaryGoal(userId);
  const skills = useSkills(userId);
  const careers = useCareers();
  const analyses = useAnalyses(userId);
  const run = useRunAnalysis(userId);

  return (
    <div>
      <PageHeader title="Skill analysis" sub="Compare your skills with your career goal. Every run is saved to your history." />
      <Panel className="mb-8">
        {goalLoading ? <Loading /> : !career ? (
          <Empty title="Choose your career goal" body="Pick a primary career goal to analyse against." cta="Choose career goal" to="/careers" />
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Primary goal</p>
              <p className="text-2xl font-bold">{career.title}</p>
              <p className="text-sm text-muted-foreground">{skills.data?.length ?? 0} skills in your profile</p>
            </div>
            <Button size="lg" variant="accent" disabled={run.isPending} onClick={() => run.mutate(career, { onSuccess: (a) => navigate({ to: "/analysis/$analysisId", params: { analysisId: a.id } }) })}>
              {run.isPending ? "Analysing…" : "Analyse my skills"}
            </Button>
          </div>
        )}
      </Panel>

      <h2 className="mb-3 text-xl font-bold">History</h2>
      {analyses.isLoading ? <Loading /> : analyses.error ? <ErrorState error={analyses.error} onRetry={() => analyses.refetch()} /> : !analyses.data?.length ? (
        <Empty title="No analyses yet" body="Run your first analysis to see your match score." />
      ) : (
        <ul className="grid gap-3">
          {analyses.data.map((a) => {
            const c = countStatuses(a.results);
            return (
              <li key={a.id}>
                <Link to="/analysis/$analysisId" params={{ analysisId: a.id }} className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:border-primary">
                  <Score value={savedScore(a, a.results)} size="sm" />
                  <div className="flex-1">
                    <p className="font-semibold">{careers.data?.find((x) => x.id === a.career_id)?.title ?? "Career"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()} · {c.improve + c.gaps} skill gaps · {c.strong} strong</p>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
