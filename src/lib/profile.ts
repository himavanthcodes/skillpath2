// The profiles table has a single `education` text column, so education level and
// degree/branch are stored together as "Level · Branch".
export const EDUCATION_LEVELS = ["B.Tech / B.E.", "B.Sc", "BCA", "Diploma", "12th", "Graduate", "Other"];
export const YEARS = [
  { value: 1, label: "1st Year" },
  { value: 2, label: "2nd Year" },
  { value: 3, label: "3rd Year" },
  { value: 4, label: "4th Year" },
  { value: 5, label: "Graduate" },
];
const SEP = " · ";

export function joinEducation(level: string, branch: string): string {
  return [level.trim(), branch.trim()].filter(Boolean).join(SEP);
}

export function splitEducation(education: string | null | undefined): { level: string; branch: string } {
  const e = (education ?? "").trim();
  if (!e) return { level: "", branch: "" };
  const i = e.indexOf(SEP);
  const head = i === -1 ? e : e.slice(0, i);
  const rest = i === -1 ? "" : e.slice(i + SEP.length);
  if (EDUCATION_LEVELS.includes(head)) return { level: head, branch: rest };
  return { level: "", branch: e }; // legacy free-text value
}

export const yearLabel = (y: unknown) => YEARS.find((x) => x.value === Number(y))?.label ?? "";
