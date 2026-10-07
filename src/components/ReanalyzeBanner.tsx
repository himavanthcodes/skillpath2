import { useNavigate } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrimaryGoal, useRunAnalysis, useSkillsChanged } from "@/lib/queries";

export function ReanalyzeBanner({ userId }: { userId: string }) {
  const changed = useSkillsChanged(userId);
  const { career } = usePrimaryGoal(userId);
  const run = useRunAnalysis(userId);
  const navigate = useNavigate();
  if (!changed.data || !career) return null;
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-warm/40 bg-warm-soft p-4 sm:flex-row sm:items-center">
      <p className="flex-1 text-sm font-medium text-warm-foreground">Your career analysis may have changed.</p>
      <Button size="sm" variant="accent" disabled={run.isPending} onClick={() => run.mutate(career, { onSuccess: (a) => navigate({ to: "/analysis/$analysisId", params: { analysisId: a.id } }) })}>
        <RefreshCw /> {run.isPending ? "Analysing…" : "Re-analyze my profile"}
      </Button>
    </div>
  );
}
