import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Compass, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, errMsg } from "@/lib/supabase";
import { ensureProfile } from "@/lib/queries";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ mode: z.enum(["login", "register"]).optional() }),
  head: () => ({
    meta: [
      { title: "Sign in — SkillPath" },
      { name: "description", content: "Sign in or create your SkillPath account to analyse your skills." },
      { property: "og:title", content: "Sign in — SkillPath" },
      { property: "og:description", content: "Sign in or create your SkillPath account to analyse your skills." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  fullName: z.string().trim().max(100).optional(),
});

function AuthPage() {
  const { mode: initial } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "register">(initial ?? "login");
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const parsed = schema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid input");
    if (mode === "register" && !form.fullName.trim()) return setError("Enter your name");
    setBusy(true);
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { full_name: form.fullName.trim() } },
        });
        if (error) throw error;
        if (data.session && data.user) {
          await ensureProfile(data.user.id, form.fullName.trim());
          navigate({ to: "/onboarding" });
        } else setConfirmSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const m = errMsg(err);
      setError(m.includes("Email not confirmed") ? "Please confirm your email first — check your inbox for the link." : m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-2xl font-extrabold text-primary"><Compass className="size-7 text-warm" /> SkillPath</Link>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          {confirmSent ? (
            <div className="text-center">
              <MailCheck className="mx-auto size-10 text-primary" />
              <h1 className="mt-3 text-2xl font-bold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">We sent a confirmation link to <b>{form.email}</b>. Click it, then sign in.</p>
              <Button className="mt-6" variant="outline" onClick={() => { setConfirmSent(false); setMode("login"); }}>Back to sign in</Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{mode === "login" ? "Sign in to continue your skill path." : "It takes a minute. Your data stays private to you."}</p>
              <form onSubmit={submit} className="mt-6 grid gap-4">
                {mode === "register" && (
                  <div className="grid gap-1.5"><Label htmlFor="name">Full name</Label><Input id="name" autoComplete="name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
                )}
                <div className="grid gap-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                {error && <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}
                <Button type="submit" size="lg" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</Button>
              </form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "login" ? "New to SkillPath? " : "Already have an account? "}
                <button className="font-semibold text-primary hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>
                  {mode === "login" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
