import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  lede,
  className,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  className?: string;
}) {
  return (
    <header className={cn("border-b border-border/60", className)}>
      <div className="mx-auto w-full max-w-4xl px-6 py-20 sm:py-28">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-4 font-serif text-5xl font-medium leading-[1.08] text-foreground sm:text-6xl">
          {title}
        </h1>
        {lede && (
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {lede}
          </p>
        )}
      </div>
    </header>
  );
}
