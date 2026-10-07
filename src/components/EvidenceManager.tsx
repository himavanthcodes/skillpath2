import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVIDENCE_TYPES, evidenceLabel, useEvidence, useEvidenceMutations, useSkills, type Evidence, type Skill } from "@/lib/queries";
import { Empty, ErrorState, Loading } from "./states";

// Follow-up questions live in the app; answers are saved to skill_evidence.
const followUp = (s: Skill) => `How have you used ${s.name}?`;

export function EvidenceManager({ userId }: { userId: string }) {
  const skills = useSkills(userId);
  const evidence = useEvidence(userId);
  if (skills.isLoading || evidence.isLoading) return <Loading />;
  if (skills.error || evidence.error) return <ErrorState error={skills.error || evidence.error} onRetry={() => { skills.refetch(); evidence.refetch(); }} />;
  if (!skills.data?.length) return <Empty title="Add skills first" body="Follow-up questions appear for each skill you add." cta="Add skills" to="/skills" />;
  return (
    <ul className="grid gap-4">
      {skills.data.map((s) => (
        <EvidenceCard key={s.id} skill={s} userId={userId} items={(evidence.data ?? []).filter((e) => e.skill_id === s.id)} />
      ))}
    </ul>
  );
}

function EvidenceCard({ skill, userId, items }: { skill: Skill; userId: string; items: Evidence[] }) {
  const { add, update, remove } = useEvidenceMutations(userId);
  const [type, setType] = useState("personal_project");
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const reset = () => { setText(""); setEditing(null); setType("personal_project"); };
  return (
    <li className="rounded-xl border bg-card p-4">
      <p className="font-semibold">{skill.name}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{followUp(skill)}</p>
      {items.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {items.map((e) => (
            <li key={e.id} className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="shrink-0 rounded bg-secondary px-1.5 text-xs font-semibold text-secondary-foreground">{evidenceLabel(e.evidence_type)}</span>
              <span className="flex-1">{e.description}</span>
              <button aria-label="Edit answer" className="text-muted-foreground hover:text-foreground" onClick={() => { setEditing(e.id); setText(e.description ?? ""); setType(EVIDENCE_TYPES.some((t) => t.value === e.evidence_type) ? e.evidence_type! : "other"); }}><Pencil className="size-4" /></button>
              <button aria-label="Delete answer" className="text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(e.id)}><X className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-3 grid gap-2 sm:grid-cols-[200px_1fr_auto] sm:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          if (editing) update.mutate({ id: editing, evidence_type: type, description: text.trim() }, { onSuccess: reset });
          else add.mutate({ skill_id: skill.id, evidence_type: type, description: text.trim() }, { onSuccess: reset });
        }}
      >
        <div className="grid gap-1">
          <Label className="sr-only">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{EVIDENCE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Textarea rows={1} maxLength={500} placeholder={`e.g. Built a hospital website using ${skill.name}`} value={text} onChange={(e) => setText(e.target.value)} aria-label={`Answer for ${skill.name}`} />
        <div className="flex gap-1">
          <Button type="submit" variant="secondary" disabled={add.isPending || update.isPending || !text.trim()}>{add.isPending || update.isPending ? "Saving…" : editing ? "Update" : "Save"}</Button>
          {editing && <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>}
        </div>
      </form>
    </li>
  );
}
