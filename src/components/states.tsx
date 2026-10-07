import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive-soft p-4 text-sm sm:flex-row sm:items-center">
      <AlertCircle className="size-5 shrink-0 text-destructive" />
      <p className="flex-1 text-foreground">{(error as Error)?.message ?? "Something went wrong."}</p>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Empty({ title, body, cta, to }: { title: string; body?: string; cta?: string; to?: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card p-8 text-center">
      <h3 className="text-lg font-bold">{title}</h3>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>}
      {cta && to && (
        <Button asChild className="mt-4"><Link to={to}>{cta}</Link></Button>
      )}
    </div>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1 text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>{children}</section>;
}

const statusStyles: Record<string, string> = {
  "STRONG MATCH": "bg-success-soft text-success",
  "NEEDS IMPROVEMENT": "bg-warning-soft text-warning",
  "SKILL GAP": "bg-destructive-soft text-destructive",
  HIGH: "bg-warm-soft text-warm-foreground",
  MEDIUM: "bg-secondary text-secondary-foreground",
  LOW: "bg-muted text-muted-foreground",
};

export function Pill({ value }: { value: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", statusStyles[value] ?? "bg-muted text-muted-foreground")}>
      {value}
    </span>
  );
}

export function Score({ value, size = "lg" }: { value: number; size?: "lg" | "sm" }) {
  const tone = value >= 75 ? "text-success" : value >= 45 ? "text-warning" : "text-destructive";
  return <span className={cn("font-display font-extrabold tabular-nums", tone, size === "lg" ? "text-5xl" : "text-xl")}>{value}%</span>;
}

export function LevelDots({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`Level ${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cn("size-2 rounded-full", i < value ? "bg-primary" : "bg-border")} />
      ))}
    </span>
  );
}
