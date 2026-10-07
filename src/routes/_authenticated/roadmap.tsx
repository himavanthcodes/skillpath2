import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, ErrorState, Loading, PageHeader, Panel } from "@/components/states";
import { isCompleted, ROADMAP_STATUSES, useRoadmap, useSetRoadmapStatus } from "@/lib/queries";
import { parseTasks } from "@/lib/roadmap";
import { useUserId } from "@/lib/useUser";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/roadmap")({
  head: pageHead("Roadmap", "Your learning roadmap and progress."),
  component: RoadmapPage,
});

function RoadmapPage() {
  const userId = useUserId();
  const items = useRoadmap(userId);
  const setStatus = useSetRoadmapStatus(userId);
  // newest roadmap first by creation, then in week order
  const list = [...(items.data ?? [])].sort((a, b) => b.created_at.slice(0, 16).localeCompare(a.created_at.slice(0, 16)) || (a.week_number ?? 99) - (b.week_number ?? 99));
  const done = list.filter((i) => isCompleted(i.status)).length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;

  return (
    <div>
      <PageHeader title="Your roadmap" sub="A week-by-week plan built from your highest-priority skill gaps." />
      {items.isLoading ? <Loading /> : items.error ? <ErrorState error={items.error} onRetry={() => items.refetch()} /> : !list.length ? (
        <Empty title="Your AI-powered roadmap" body="A personalized week-by-week learning plan based on your current skills, career goal, and priority skill gaps." cta="Generate AI Roadmap" to="/analysis" />
      ) : (
        <>
          <Panel className="mb-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div><p className="text-sm text-muted-foreground">Progress</p><p className="text-3xl font-extrabold">{pct}%</p></div>
              <p className="text-sm text-muted-foreground">{done} of {list.length} items completed</p>
            </div>
            <Progress value={pct} className="mt-3" />
          </Panel>
          <ol className="grid gap-3">
            {list.map((i, idx) => {
              const tasks = parseTasks(i.tasks);
              return (
                <li key={i.id} className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-start", isCompleted(i.status) && "opacity-70")}>
                  <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-xs font-bold text-primary">Week {i.week_number ?? idx + 1}</span>
                  <div className="flex-1">
                    {i.skill && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{i.skill}</p>}
                    <p className={cn("font-semibold", isCompleted(i.status) && "line-through")}>{i.title}</p>
                    {i.description && <p className="text-sm text-muted-foreground">{i.description}</p>}
                    {tasks.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{tasks.map((t) => <li key={t}>{t}</li>)}</ul>}
                    {i.estimated_hours != null && <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" /> ~{i.estimated_hours} hours</p>}
                  </div>
                  <Select value={i.status ?? "not_started"} onValueChange={(v) => setStatus.mutate({ id: i.id, status: v })} disabled={setStatus.isPending}>
                    <SelectTrigger className="sm:w-40" aria-label={`Status for ${i.title}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{ROADMAP_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
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
