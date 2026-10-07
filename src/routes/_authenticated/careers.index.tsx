import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Empty, ErrorState, Loading, PageHeader } from "@/components/states";
import { useAllRequirements, useCareers, usePrimaryGoal, useSkills } from "@/lib/queries";
import { compareSkills, matchScore } from "@/lib/analysis";
import { useUserId } from "@/lib/useUser";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/careers/")({
  head: pageHead("Careers", "Browse careers and their skill requirements."),
  component: CareersPage,
});

function CareersPage() {
  const userId = useUserId();
  const careers = useCareers();
  const { goal } = usePrimaryGoal(userId);
  const skills = useSkills(userId);
  const reqs = useAllRequirements();
  const matchFor = (careerId: string) => {
    const r = (reqs.data ?? []).filter((x) => x.career_id === careerId);
    return r.length && skills.data?.length ? matchScore(compareSkills(skills.data, r)) : null;
  };
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const cats = useMemo(() => ["All", ...new Set((careers.data ?? []).map((c) => c.category ?? "Other"))], [careers.data]);
  const list = (careers.data ?? []).filter(
    (c) => (cat === "All" || (c.category ?? "Other") === cat) && `${c.title} ${c.short_description ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <PageHeader title="Careers" sub="Explore careers, then set one as your primary goal." />
      <div className="mb-6 grid gap-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search careers" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={cn("rounded-full border px-3 py-1 text-sm", cat === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary")}>{c}</button>
          ))}
        </div>
      </div>
      {careers.isLoading ? <Loading /> : careers.error ? <ErrorState error={careers.error} onRetry={() => careers.refetch()} /> : !list.length ? (
        <Empty title="No careers match" body="Try a different search or category." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Link key={c.id} to="/careers/$careerId" params={{ careerId: c.id }} className="group rounded-xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.category}</span>
                {goal?.career_id === c.id && <span className="inline-flex items-center gap-1 rounded-full bg-warm-soft px-2 py-0.5 text-xs font-semibold text-warm-foreground"><Star className="size-3" /> Your goal</span>}
              </div>
              <h2 className="mt-2 text-xl font-bold group-hover:text-primary">{c.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{c.short_description}</p>
              {matchFor(c.id) != null && <p className="mt-3 text-sm font-semibold text-primary">{matchFor(c.id)}% match</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
