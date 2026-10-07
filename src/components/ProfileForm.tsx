import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile, useSaveProfile } from "@/lib/queries";
import { EDUCATION_LEVELS, YEARS, joinEducation, splitEducation } from "@/lib/profile";
import { ErrorState, Loading } from "./states";

export function ProfileForm({ userId, onSaved, submitLabel = "Save profile" }: { userId: string; onSaved?: () => void; submitLabel?: string }) {
  const profile = useProfile(userId);
  const save = useSaveProfile(userId);
  const [v, setV] = useState({ full_name: "", level: "", branch: "", year: "", institution: "", bio: "" });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    const { level, branch } = splitEducation(p.education);
    setV({ full_name: p.full_name ?? "", level, branch, year: p.current_year != null ? String(Number(p.current_year) || "") : "", institution: p.institution ?? "", bio: p.bio ?? "" });
  }, [profile.data]);

  if (profile.isLoading) return <Loading />;
  if (profile.error) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.full_name.trim()) return setErr("Please enter your full name.");
        if (!v.level) return setErr("Please choose your education level.");
        setErr(null);
        save.mutate(
          {
            full_name: v.full_name.trim(),
            education: joinEducation(v.level, v.branch),
            current_year: v.year ? Number(v.year) : null,
            institution: v.institution.trim() || null,
            bio: v.bio.trim(),
          },
          { onSuccess: () => onSaved?.() },
        );
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" maxLength={100} value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Education level</Label>
          <Select value={v.level} onValueChange={(level) => setV({ ...v, level })}>
            <SelectTrigger aria-label="Education level"><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>{EDUCATION_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="branch">Degree / branch</Label>
          <Input id="branch" maxLength={100} placeholder="e.g. Computer Science" value={v.branch} onChange={(e) => setV({ ...v, branch: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label>Current year</Label>
          <Select value={v.year} onValueChange={(year) => setV({ ...v, year })}>
            <SelectTrigger aria-label="Current year"><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y.value} value={String(y.value)}>{y.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="institution">College / university <span className="text-muted-foreground">(optional)</span></Label>
          <Input id="institution" maxLength={150} value={v.institution} onChange={(e) => setV({ ...v, institution: e.target.value })} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="bio">About you</Label>
        <Textarea id="bio" maxLength={1000} rows={4} placeholder="Tell us what you are studying, what you enjoy learning, and what kind of work interests you." value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
