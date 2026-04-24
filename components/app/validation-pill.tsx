import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Kind = "phone" | "email" | "address";
type Status = string;

const MAP: Record<Status, { label: string; tone: "good" | "warn" | "bad" | "muted" }> = {
  valid: { label: "Valid", tone: "good" },
  invalid: { label: "Invalid", tone: "bad" },
  unvalidated: { label: "Unvalidated", tone: "muted" },
  disconnected: { label: "Disconnected", tone: "bad" },
  risky: { label: "Risky", tone: "warn" },
  disposable: { label: "Disposable", tone: "warn" },
  catch_all: { label: "Catch-all", tone: "warn" },
  missing_unit: { label: "Missing unit", tone: "warn" },
  vacant: { label: "Vacant", tone: "warn" },
};

export function ValidationPill({
  status,
  kind,
  className,
}: {
  status: Status;
  kind: Kind;
  className?: string;
}) {
  const entry = MAP[status] ?? { label: status, tone: "muted" as const };
  return (
    <Badge tone={entry.tone} className={cn("capitalize", className)} title={`${kind}: ${entry.label}`}>
      {entry.label}
    </Badge>
  );
}
