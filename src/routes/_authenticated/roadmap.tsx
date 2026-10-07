import { createFileRoute } from "@tanstack/react-router";
import { Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, Loading, PageHeader, Panel } from "@/components/states";
import {
  isCompleted,
  ROADMAP_STATUSES,
  useAnalyses,
  useGenerateRoadmap,
  useRoadmap,
  useSetRoadmapStatus,
} from "@/lib/queries";
import { extractRoadmapSummary, parseTasks } from "@/lib/roadmap";
import { useUserId } from "@/lib/useUser";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/roadmap")({
  head: pageHead("Roadmap", "Your personalized AI learning roadmap and progress."),
  component: RoadmapPage,
});

function RoadmapPage() {
  const userId = useUserId();
  const items = useRoadmap(userId);
  const analyses = useAnalyses(userId);
  const setStatus = useSetRoadmapStatus(userId);
  const gen = useGenerateRoadmap(userId);

  const allItems = items.data ?? [];
  const allAnalyses = analyses.data ?? [];
  const newestAnalysis = allAnalyses[0];

  // Identify active roadmap by the newest items' analysis_id
  const activeRoadmapAnalysisId = allItems[0]?.analysis_id;

  // Filter items to strictly those from the active roadmap session
  const activeItems = activeRoadmapAnalysisId
    ? allItems.filter((i) => i.analysis_id === activeRoadmapAnalysisId)
    : allItems;

  // Sort strictly by sequential week number
  const list = [...activeItems].sort(
    (a, b) => (a.week_number ?? 99) - (b.week_number ?? 99) || a.created_at.localeCompare(b.created_at)
  );

  const activeAnalysis =
    allAnalyses.find((a) => a.id === activeRoadmapAnalysisId) ??
    newestAnalysis;

  const aiSummary = extractRoadmapSummary(activeAnalysis?.summary);
  const done = list.filter((i) => isCompleted(i.status)).length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;
  const estimatedWeeks = list.length
    ? Math.max(...list.map((i) => i.week_number ?? 1), list.length)
    : 0;

  // Detect if user performed a newer analysis after this roadmap was generated
  const hasNewerAnalysis = Boolean(
    newestAnalysis &&
    activeRoadmapAnalysisId &&
    newestAnalysis.id !== activeRoadmapAnalysisId
  );

  return (
    <div>
      <PageHeader
        title="Your roadmap"
        sub="A week-by-week plan built from your highest-priority skill gaps."
      >
        {list.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={gen.isPending}
            onClick={() => gen.mutate(newestAnalysis ?? activeAnalysis ?? null)}
          >
            <Sparkles className="mr-1 size-3.5" />
            {gen.isPending ? "Building your personalized roadmap..." : "Generate AI Roadmap"}
          </Button>
        )}
      </PageHeader>

      {gen.isPending ? (
        <Panel className="flex flex-col items-center justify-center py-12 text-center">
          <Loading label="Building your personalized roadmap..." />
          <p className="mt-2 text-xs text-muted-foreground">
            Analyzing your skills, proficiency levels, and career requirements...
          </p>
        </Panel>
      ) : items.isLoading ? (
        <Loading />
      ) : items.error ? (
        <ErrorState error={items.error} onRetry={() => items.refetch()} />
      ) : !list.length ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <h3 className="text-xl font-bold">Your AI-powered roadmap</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            A personalized week-by-week learning plan based on your current skills, career goal, and priority skill gaps.
          </p>
          <Button
            variant="accent"
            size="lg"
            className="mt-6"
            disabled={gen.isPending}
            onClick={() => gen.mutate(newestAnalysis ?? null)}
          >
            <Sparkles className="mr-1.5 size-4" />
            Generate AI Roadmap
          </Button>
        </div>
      ) : (
        <>
          {hasNewerAnalysis && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  New analysis available
                </p>
                <p className="text-xs text-muted-foreground">
                  You updated your skills since this roadmap was built. Generate an updated AI roadmap to align with your latest progress.
                </p>
              </div>
              <Button
                variant="accent"
                size="sm"
                disabled={gen.isPending}
                onClick={() => gen.mutate(newestAnalysis ?? null)}
              >
                <Sparkles className="mr-1.5 size-3.5" />
                Update Roadmap
              </Button>
            </div>
          )}

          <Panel className="mb-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-3xl font-extrabold">{pct}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground">
                  Estimated duration: {estimatedWeeks} {estimatedWeeks === 1 ? "week" : "weeks"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {done} of {list.length} weeks completed
                </p>
              </div>
            </div>
            <Progress value={pct} className="mt-3" />

            {aiSummary && (
              <div className="mt-5 rounded-lg border bg-secondary/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Personalized Roadmap Summary
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground">{aiSummary}</p>
              </div>
            )}
          </Panel>

          <ol className="grid gap-3">
            {list.map((i, idx) => {
              const tasks = parseTasks(i.tasks);
              const weekNum = i.week_number ?? idx + 1;
              return (
                <li
                  key={i.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-start",
                    isCompleted(i.status) && "opacity-70"
                  )}
                >
                  <span className="shrink-0 rounded-md bg-secondary px-2.5 py-1 text-xs font-bold text-primary">
                    Week {weekNum}
                  </span>
                  <div className="flex-1">
                    {i.skill && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {i.skill}
                      </p>
                    )}
                    <p className={cn("font-semibold text-foreground", isCompleted(i.status) && "line-through")}>
                      {i.title}
                    </p>
                    {i.description && i.description !== i.title && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{i.description}</p>
                    )}
                    {tasks.length > 0 && (
                      <ul className="mt-2.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {tasks.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    )}
                    {i.estimated_hours != null && (
                      <p className="mt-2.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" /> ~{i.estimated_hours} hours
                      </p>
                    )}
                  </div>
                  <Select
                    value={(i.status ?? "NOT_STARTED").toUpperCase()}
                    onValueChange={(v) => setStatus.mutate({ id: i.id, status: v })}
                    disabled={setStatus.isPending}
                  >
                    <SelectTrigger className="sm:w-40" aria-label={`Status for ${i.title}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROADMAP_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
