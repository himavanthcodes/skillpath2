import { createFileRoute } from "@tanstack/react-router";
import { ProfileForm } from "@/components/ProfileForm";
import { CareerInterestsPicker, PrimaryGoalPicker } from "@/components/CareerPickers";
import { PageHeader, Panel } from "@/components/states";
import { useUserId } from "@/lib/useUser";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/profile")({
  head: pageHead("Profile", "Your SkillPath profile, career interests and goal."),
  component: () => {
    const userId = useUserId();
    return (
      <div className="grid max-w-3xl gap-6">
        <PageHeader title="Your profile" sub="Edit anything you entered during setup." />
        <Panel><h2 className="mb-4 text-xl font-bold">About you</h2><ProfileForm userId={userId} /></Panel>
        <Panel><h2 className="mb-4 text-xl font-bold">Career interests</h2><CareerInterestsPicker userId={userId} /></Panel>
        <Panel>
          <h2 className="mb-1 text-xl font-bold">Primary career goal</h2>
          <p className="mb-4 text-sm text-muted-foreground">Changing your goal keeps all your previous analyses.</p>
          <PrimaryGoalPicker userId={userId} />
        </Panel>
      </div>
    );
  },
});
