import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/ProfileForm";
import { SkillsManager } from "@/components/SkillsManager";
import { EvidenceManager } from "@/components/EvidenceManager";
import { CareerInterestsPicker, PrimaryGoalPicker } from "@/components/CareerPickers";
import { Loading, Panel } from "@/components/states";
import { useGoals, usePrimaryGoal, useProfile, useRunAnalysis, useSkills } from "@/lib/queries";
import { onboardingProgress, ONBOARDING_STEPS } from "@/lib/onboarding";
import { useUserId } from "@/lib/useUser";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: pageHead("Get started", "Set up your profile, skills, interests and career goal."),
  component: Onboarding,
});

function Onboarding() {
  const userId = useUserId();
  const navigate = useNavigate();
  const profile = useProfile(userId);
  const skills = useSkills(userId);
  const goals = useGoals(userId);
  const { career } = usePrimaryGoal(userId);
  const run = useRunAnalysis(userId);

  const prog = onboardingProgress({ profile: profile.data, skillCount: skills.data?.length ?? 0, interestCount: goals.data?.length ?? 0, hasPrimary: !!career });
  const [step, setStep] = useState<number | null>(null);
  const current = step ?? prog.nextStep;

  if (profile.isLoading || skills.isLoading || goals.isLoading) return <Loading />;
  const last = ONBOARDING_STEPS.length - 1;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Set up your SkillPath</h1>
      <p className="mt-1 text-muted-foreground">Each step saves as you go — leave and come back anytime.</p>
      <ol className="my-6 flex flex-wrap gap-2">
        {ONBOARDING_STEPS.map((s, i) => (
          <li key={s}>
            <button onClick={() => setStep(i)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", current === i ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
              {prog.done[i] ? <Check className="size-3.5" /> : <span className="text-xs">{i + 1}</span>} {s}
            </button>
          </li>
        ))}
      </ol>

      <Panel>
        {current === 0 && <><h2 className="mb-4 text-xl font-bold">Tell us about yourself</h2><ProfileForm userId={userId} submitLabel="Save and continue" onSaved={() => setStep(1)} /></>}
        {current === 1 && (
          <>
            <h2 className="text-xl font-bold">What can you do?</h2>
            <p className="mb-4 text-sm text-muted-foreground">Add the skills you currently know and rate your proficiency. You can update them anytime.</p>
            <SkillsManager userId={userId} />
          </>
        )}
        {current === 2 && (
          <>
            <h2 className="text-xl font-bold">Show us how you use your skills</h2>
            <p className="mb-4 text-sm text-muted-foreground">Optional — add examples for your most important skills, or skip this step.</p>
            <EvidenceManager userId={userId} />
          </>
        )}
        {current === 3 && (
          <>
            <h2 className="mb-4 text-xl font-bold">What kind of career interests you?</h2>
            <CareerInterestsPicker userId={userId} />
            {!!goals.data?.length && (
              <div className="mt-6 border-t pt-4">
                <h3 className="mb-3 font-semibold">Which of these is your current strongest interest?</h3>
                <PrimaryGoalPicker userId={userId} />
              </div>
            )}
          </>
        )}
        {current === 4 && (
          <>
            <h2 className="mb-1 text-xl font-bold">Choose your career goal</h2>
            <p className="mb-4 text-sm text-muted-foreground">Pick exactly one primary goal. Your other interests stay saved, and you can change this later.</p>
            <PrimaryGoalPicker userId={userId} />
            <div className="mt-6 text-center">
              {career ? (
                <Button size="lg" variant="accent" disabled={run.isPending || !skills.data?.length} onClick={() => run.mutate(career, { onSuccess: (a) => navigate({ to: "/analysis/$analysisId", params: { analysisId: a.id } }) })}>
                  {run.isPending ? "Analysing…" : `Analyse my fit for ${career.title}`}
                </Button>
              ) : null}
              {!skills.data?.length && <p className="mt-2 text-sm text-muted-foreground">Add at least one skill first.</p>}
            </div>
          </>
        )}
        <div className="mt-6 flex justify-between border-t pt-4">
          <Button variant="ghost" disabled={current === 0} onClick={() => setStep(current - 1)}>Back</Button>
          {current < last ? (
            <Button variant="outline" onClick={() => setStep(current + 1)}>{current === 2 ? "Skip / Next" : "Next"}</Button>
          ) : <Button asChild variant="ghost"><Link to="/dashboard">Go to dashboard</Link></Button>}
        </div>
      </Panel>
    </div>
  );
}
