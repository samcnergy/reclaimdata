import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-secondary text-secondary-foreground",
        accent: "bg-accent/15 text-accent",
        good: "bg-confidence-high/15 text-confidence-high",
        warn: "bg-confidence-mid/15 text-[hsl(var(--confidence-mid))]",
        bad: "bg-destructive/15 text-destructive",
        muted: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
