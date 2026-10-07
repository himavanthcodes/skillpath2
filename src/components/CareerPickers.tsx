import { Check, Star } from "lucide-react";
import { useCareers, useGoals, useSetPrimaryGoal, useToggleInterest } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { ErrorState, Loading } from "./states";

const CATEGORY_ORDER = ["Technology", "Data & Analytics", "Design & Creative", "Business", "Engineering", "Other"];

/** Multi-select career interests, grouped by category. Saved as career_goals rows. */
export function CareerInterestsPicker({ userId }: { userId: string }) {
  const careers = useCareers();
  const goals = useGoals(userId);
  const toggle = useToggleInterest(userId);
  if (careers.isLoading || goals.isLoading) return <Loading />;
  if (careers.error || goals.error) return <ErrorState error={careers.error || goals.error} onRetry={() => { careers.refetch(); goals.refetch(); }} />;
  const selected = new Map((goals.data ?? []).map((g) => [g.career_id, g]));
  const groups = new Map<string, typeof careers.data>();
  for (const c of careers.data ?? []) {
    const k = c.category ?? "Other";
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const rank = (k: string) => (CATEGORY_ORDER.includes(k) ? CATEGORY_ORDER.indexOf(k) : 98);
  const keys = [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return (
    <div className="grid gap-5">
      {keys.map((k) => (
        <div key={k}>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{k}</h3>
          <div className="flex flex-wrap gap-2">
            {groups.get(k)!.map((c) => {
              const g = selected.get(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={!!g}
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ careerId: c.id, on: !g })}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm", g ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary")}
                >
                  {g?.is_primary ? <Star className="size-3.5" /> : g ? <Check className="size-3.5" /> : null}
                  {c.title}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-sm text-muted-foreground">{selected.size} selected</p>
    </div>
  );
}

/** Choose exactly one primary goal from the user's interests. */
export function PrimaryGoalPicker({ userId }: { userId: string }) {
  const careers = useCareers();
  const goals = useGoals(userId);
  const setGoal = useSetPrimaryGoal(userId);
  if (careers.isLoading || goals.isLoading) return <Loading />;
  const list = (goals.data ?? []).map((g) => ({ g, c: careers.data?.find((c) => c.id === g.career_id) })).filter((x) => x.c);
  if (!list.length) return <p className="text-sm text-muted-foreground">Select at least one career interest first.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Primary career goal">
      {list.map(({ g, c }) => (
        <button
          key={g.id}
          type="button"
          role="radio"
          aria-checked={g.is_primary}
          disabled={setGoal.isPending}
          onClick={() => !g.is_primary && setGoal.mutate(g.career_id)}
          className={cn("flex items-start gap-3 rounded-lg border p-3 text-left hover:border-primary", g.is_primary && "border-primary bg-secondary")}
        >
          <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", g.is_primary && "border-primary bg-primary")} />
          <span>
            <span className="block font-semibold">{c!.title}</span>
            <span className="text-xs text-muted-foreground">{g.is_primary ? "Primary goal" : c!.short_description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
