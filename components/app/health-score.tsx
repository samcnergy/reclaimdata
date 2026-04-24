import { cn } from "@/lib/utils";

export function HealthScore({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const tone =
    score >= 75
      ? "bg-confidence-high/15 text-confidence-high"
      : score >= 40
        ? "bg-confidence-mid/15 text-[hsl(var(--confidence-mid))]"
        : "bg-confidence-low/15 text-confidence-low";

  return (
    <span
      className={cn(
        "inline-flex w-[42px] items-center justify-center rounded-md py-0.5 text-xs font-semibold tabular-nums",
        tone,
        className,
      )}
      title={`Health ${score}/100`}
    >
      {score}
    </span>
  );
}
