export const ONBOARDING_STEPS = ["About You", "Your Skills", "Experience", "Career Interests", "Career Goal"];

/** Which onboarding steps are complete. Experience is optional, so it never blocks. */
export function onboardingProgress(s: { profile: { full_name: string | null; education: string | null } | null | undefined; skillCount: number; interestCount: number; hasPrimary: boolean }) {
  const done = [!!s.profile?.full_name && !!s.profile?.education, s.skillCount > 0, s.skillCount > 0, s.interestCount > 0, s.hasPrimary];
  const required = [0, 1, 3, 4];
  const open = required.find((i) => !done[i]);
  return { done, complete: open === undefined, nextStep: open ?? 4, nextLabel: open === undefined ? null : ONBOARDING_STEPS[open] };
}
