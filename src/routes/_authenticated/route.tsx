import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Compass, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { ensureProfile, usePrimaryGoal } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/onboarding", label: "Get started" },
  { to: "/skills", label: "Skills" },
  { to: "/careers", label: "Careers" },
  { to: "/analysis", label: "Analysis" },
  { to: "/roadmap", label: "Roadmap" },
  { to: "/profile", label: "Profile" },
] as const;

function AppLayout() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { career } = usePrimaryGoal(user.id);

  useEffect(() => {
    ensureProfile(user.id, (user.user_metadata?.['full_name'] as string) ?? null)
      .then(() => qc.invalidateQueries({ queryKey: ["profile", user.id] }))
      .catch((e) => console.error("Profile setup failed:", e));
  }, [user.id, user.user_metadata, qc]);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/dashboard" className="flex items-center gap-2 font-display text-xl font-extrabold text-primary">
            <Compass className="size-6 text-warm" /> SkillPath
          </Link>
          <nav className="ml-4 hidden gap-1 lg:flex">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground" activeProps={{ className: "bg-secondary !text-secondary-foreground" }}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {career && <span className="hidden max-w-48 truncate rounded-full bg-warm-soft px-3 py-1 text-xs font-semibold text-warm-foreground md:inline">Goal: {career.title}</span>}
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut /> <span className="hidden sm:inline">Sign out</span></Button>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu" onClick={() => setOpen(!open)}><Menu /></Button>
          </div>
        </div>
        <nav className={cn("grid gap-1 border-t px-4 py-2 lg:hidden", !open && "hidden")}>
          {career && <span className="px-3 py-1 text-xs font-semibold text-warm-foreground">Goal: {career.title}</span>}
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium" activeProps={{ className: "bg-secondary" }}>{n.label}</Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
