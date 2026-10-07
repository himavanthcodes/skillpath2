import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillsManager } from "@/components/SkillsManager";
import { EvidenceManager } from "@/components/EvidenceManager";
import { PageHeader } from "@/components/states";
import { ReanalyzeBanner } from "@/components/ReanalyzeBanner";
import { useUserId } from "@/lib/useUser";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/skills")({
  head: pageHead("My skills", "Manage your skills, proficiency levels and evidence."),
  component: () => {
    const userId = useUserId();
    return (
      <div>
        <PageHeader title="My skills" sub="Rate each skill from 1 (beginner) to 5 (expert) and tell us how you've used it." />
        <ReanalyzeBanner userId={userId} />
        <Tabs defaultValue="skills">
          <TabsList><TabsTrigger value="skills">Skills & proficiency</TabsTrigger><TabsTrigger value="evidence">Experience</TabsTrigger></TabsList>
          <TabsContent value="skills" className="mt-4"><SkillsManager userId={userId} /></TabsContent>
          <TabsContent value="evidence" className="mt-4"><EvidenceManager userId={userId} /></TabsContent>
        </Tabs>
      </div>
    );
  },
});
