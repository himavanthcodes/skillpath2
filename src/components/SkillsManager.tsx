import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSkillMutations, useSkillNames, useSkills, type Skill } from "@/lib/queries";
import { Empty, ErrorState, Loading } from "./states";

export const LEVEL_LABELS = ["None", "Beginner", "Basic", "Intermediate", "Advanced", "Expert"];
export const SKILL_CATEGORIES = ["Programming", "Web Development", "Data & AI", "Databases", "Cloud & DevOps", "Design", "Business", "Communication", "Other"];
const EXAMPLES: Record<string, string> = {
  Python: "Programming", "C++": "Programming", Java: "Programming", JavaScript: "Programming", TypeScript: "Programming",
  HTML: "Web Development", CSS: "Web Development", React: "Web Development", "Node.js": "Web Development", Express: "Web Development",
  SQL: "Databases", MongoDB: "Databases", Firebase: "Cloud & DevOps", Supabase: "Databases", Git: "Cloud & DevOps", GitHub: "Cloud & DevOps",
  "Machine Learning": "Data & AI", "Data Analysis": "Data & AI", "UI/UX": "Design", Figma: "Design", Photoshop: "Design",
  "Video Editing": "Design", Communication: "Communication",
};
const guessCategory = (n: string) => EXAMPLES[Object.keys(EXAMPLES).find((k) => k.toLowerCase() === n.trim().toLowerCase()) ?? ""] ?? "";

export function SkillsManager({ userId }: { userId: string }) {
  const skills = useSkills(userId);
  const names = useSkillNames();
  const { add } = useSkillMutations(userId);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState(2);
  const [years, setYears] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    add.mutate(
      { name: n, category: category.trim() || null, proficiency_level: level, years_experience: years === "" ? null : Math.max(0, Number(years)) },
      { onSuccess: () => { setName(""); setCategory(""); setYears(""); setLevel(2); } },
    );
  };

  const owned = new Set((skills.data ?? []).map((s) => s.name.toLowerCase()));
  const suggestions = [...new Set([...Object.keys(EXAMPLES), ...(names.data ?? [])])].filter((n) => !owned.has(n.toLowerCase()));
  const pick = (n: string) => { setName(n); const g = guessCategory(n); if (g) setCategory(g); };

  return (
    <div className="grid gap-6">
      <form onSubmit={submit} className="grid gap-4 rounded-xl border bg-muted/50 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="skill-name">Skill</Label>
            <Input id="skill-name" list="skill-suggestions" maxLength={60} placeholder="Search or type any skill" value={name} onChange={(e) => pick(e.target.value)} />
            <datalist id="skill-suggestions">{suggestions.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label="Category"><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>{SKILL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <div className="grid gap-2">
            <Label>Proficiency: <span className="font-semibold text-primary">{level} · {LEVEL_LABELS[level]}</span></Label>
            <Slider min={1} max={5} step={1} value={[level]} onValueChange={(v) => setLevel(v[0] ?? 1)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="skill-years">Years of experience (optional)</Label>
            <Input id="skill-years" type="number" min={0} max={50} step={0.5} value={years} onChange={(e) => setYears(e.target.value)} />
          </div>
        </div>
        <div><Button type="submit" disabled={add.isPending || !name.trim()}>{add.isPending ? "Adding…" : "Add skill"}</Button></div>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground">Suggestions:</span>
            {suggestions.slice(0, 24).map((n) => (
              <button type="button" key={n} onClick={() => pick(n)} className="rounded-full border bg-card px-2.5 py-0.5 text-xs hover:border-primary hover:text-primary">{n}</button>
            ))}
          </div>
        )}
      </form>

      {skills.isLoading ? <Loading /> : skills.error ? <ErrorState error={skills.error} onRetry={() => skills.refetch()} /> : !skills.data?.length ? (
        <Empty title="No skills yet" body="Add the skills you already have — even beginner level counts." />
      ) : (
        <ul className="grid gap-3">{skills.data.map((s) => <SkillRow key={s.id} skill={s} userId={userId} />)}</ul>
      )}
    </div>
  );
}

function SkillRow({ skill, userId }: { skill: Skill; userId: string }) {
  const { update, remove } = useSkillMutations(userId);
  const [level, setLevel] = useState(skill.proficiency_level ?? 1);
  const [years, setYears] = useState(skill.years_experience?.toString() ?? "");
  const dirty = level !== (skill.proficiency_level ?? 1) || years !== (skill.years_experience?.toString() ?? "");
  return (
    <li className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1.4fr_110px_auto] sm:items-center">
      <div>
        <p className="font-semibold">{skill.name}</p>
        {skill.category && <p className="text-xs text-muted-foreground">{skill.category}</p>}
      </div>
      <div className="grid gap-1.5">
        <span className="text-xs text-muted-foreground">Level {level} · {LEVEL_LABELS[level]}</span>
        <Slider min={1} max={5} step={1} value={[level]} onValueChange={(v) => setLevel(v[0] ?? 1)} aria-label={`${skill.name} proficiency`} />
      </div>
      <Input type="number" min={0} max={50} step={0.5} placeholder="Years" value={years} onChange={(e) => setYears(e.target.value)} aria-label="Years of experience" />
      <div className="flex gap-2">
        <Button size="sm" disabled={!dirty || update.isPending} onClick={() => update.mutate({ id: skill.id, proficiency_level: level, years_experience: years === "" ? null : Number(years) })}>
          {update.isPending ? "Saving…" : "Save"}
        </Button>
        <Button size="icon" variant="ghost" disabled={remove.isPending} aria-label={`Remove ${skill.name}`} onClick={() => { if (confirm(`Remove ${skill.name}?`)) remove.mutate(skill.id); }}>
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}
