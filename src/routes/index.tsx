import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Compass, Map, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkillPath — Find the skills you need for your career goal" },
      { name: "description", content: "Compare your skills with real career requirements, see your gaps, and follow a personal learning roadmap." },
      { property: "og:title", content: "SkillPath — Find the skills you need for your career goal" },
      { property: "og:description", content: "Compare your skills with real career requirements, see your gaps, and follow a personal learning roadmap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  const steps = [
    { icon: Target, t: "Pick a career goal", d: "Choose from 21 careers, each with clear skill requirements." },
    { icon: TrendingUp, t: "See your readiness", d: "Your skill levels are compared requirement by requirement." },
    { icon: Map, t: "Follow your roadmap", d: "Close the highest-priority gaps first and track progress." },
  ];

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-6xl items-center px-4">
        <span className="flex items-center gap-2 font-display text-xl font-extrabold text-primary"><Compass className="size-6 text-warm" /> SkillPath</span>
        <div className="ml-auto flex gap-2">
          {signedIn ? (
            <Button asChild><Link to="/dashboard">Open dashboard</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
              <Button asChild><Link to="/auth" search={{ mode: "register" }}>Create account</Link></Button>
            </>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4">
        <section className="py-16 sm:py-24">
          <p className="mb-4 inline-flex rounded-full bg-warm-soft px-3 py-1 text-sm font-semibold text-warm-foreground">For students planning their career</p>
          <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.05] text-primary sm:text-7xl">Find the skills you need to reach your career goal.</h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">Tell SkillPath what you know. Pick where you want to go. Get an honest readiness score and a step-by-step plan to close the gap.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="accent">{signedIn ? <Link to="/dashboard">Start my skill check <ArrowRight /></Link> : <Link to="/auth" search={{ mode: "register" }}>Start my skill check <ArrowRight /></Link>}</Button>
          </div>
        </section>
        <section className="grid gap-4 pb-24 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.t} className="rounded-xl border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary"><s.icon className="size-5" /></span>
                <span className="font-display text-sm font-bold text-muted-foreground">Step {i + 1}</span>
              </div>
              <h2 className="mt-4 text-xl font-bold">{s.t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
