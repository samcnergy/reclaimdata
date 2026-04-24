import { cn } from "@/lib/utils";

/**
 * Per-field confidence chip. Three buckets keyed off the muted palette
 * (never clinical) per the design spec.
 */
export function ConfidenceBadge({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  let tone: "bg-confidence-high text-primary-foreground"
    | "bg-confidence-mid text-primary"
    | "bg-confidence-low text-primary-foreground";
  let label: string;

  if (score >= 85) {
    tone = "bg-confidence-high text-primary-foreground";
    label = "High";
  } else if (score >= 60) {
    tone = "bg-confidence-mid text-primary";
    label = "Medium";
  } else {
    tone = "bg-confidence-low text-primary-foreground";
    label = "Low";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone,
        className,
      )}
      title={`Confidence ${score}/100`}
    >
      {label}
    </span>
  );
}
