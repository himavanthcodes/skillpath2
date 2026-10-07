import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, ErrorState, LevelDots, Loading, Panel, Pill } from "@/components/states";
import { useCareers, usePrimaryGoal, useRequirements, useRunAnalysis, useSetPrimaryGoal, useSkills } from "@/lib/queries";
import { compareSkills, matchScore, normalize } from "@/lib/analysis";
import { useUserId } from "@/lib/useUser";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/careers/$careerId")({
  head: pageHead("Career details", "Skill requirements for this career."),
  component: CareerDetail,
});

function CareerDetail() {
  const { careerId } = Route.useParams();
  const userId = useUserId();
  const navigate = useNavigate();
  const careers = useCareers();
  const reqs = useRequirements(careerId);
  const { goal } = usePrimaryGoal(userId);
  const setGoal = useSetPrimaryGoal(userId);
  const run = useRunAnalysis(userId);
  const skills = useSkills(userId);
  const career = careers.data?.find((c) => c.id === careerId);
  const mine = new Map(compareSkills(skills.data ?? [], reqs.data ?? []).map((r) => [normalize(r.skill_name), r.current_level]));
  const match = reqs.data?.length ? matchScore(compareSkills(skills.data ?? [], reqs.data)) : null;

  if (careers.isLoading) return <Loading />;
  if (careers.error) return <ErrorState error={careers.error} onRetry={() => careers.refetch()} />;
  if (!career) return <Empty title="Career not found" cta="Back to careers" to="/careers" />;
  const isGoal = goal?.career_id === careerId;

  return (
    <div>
      <Link to="/careers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> All careers</Link>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{career.category}</span>
          <h1 className="mt-1 text-4xl font-extrabold">{career.title}</h1>
          <p className="mt-2 text-muted-foreground">{career.description}</p>
          {match != null && <p className="mt-3 text-lg font-bold text-primary">{match}% match with your current skills</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {isGoal ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-warm-soft px-3 py-2 text-sm font-semibold text-warm-foreground"><Star className="size-4" /> Your primary goal</span>
          ) : (
            <Button variant="accent" disabled={setGoal.isPending} onClick={() => setGoal.mutate(careerId)}>{setGoal.isPending ? "Saving…" : goal ? "Make this my goal instead" : "Set as my career goal"}</Button>
          )}
          <Button disabled={run.isPending} onClick={() => run.mutate(career, { onSuccess: (a) => navigate({ to: "/analysis/$analysisId", params: { analysisId: a.id } }) })}>
            {run.isPending ? "Analyzing your current skills..." : "Analyse my skills"}
          </Button>
        </div>
      </div>
      <Panel>
        <h2 className="mb-4 text-xl font-bold">Required skills</h2>
        {reqs.isLoading ? <Loading /> : reqs.error ? <ErrorState error={reqs.error} onRetry={() => reqs.refetch()} /> : !reqs.data?.length ? (
          <p className="text-sm text-muted-foreground">No requirements defined for this career yet.</p>
        ) : (
          <ul className="divide-y">
            {reqs.data.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="font-semibold">{r.skill_name}</p>
                  {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                </div>
                <div className="grid grid-cols-[auto_auto] items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Required {r.required_level}/5</span><LevelDots value={r.required_level} />
                  <span>You {mine.get(normalize(r.skill_name)) ?? 0}/5</span><LevelDots value={mine.get(normalize(r.skill_name)) ?? 0} />
                </div>
                <div className="flex items-center gap-3">
                  <Pill value={String(r.importance)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
