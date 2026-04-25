import { FileText, Camera, Table2 } from "lucide-react";

const problems = [
  {
    icon: FileText,
    text: "Paper contracts in filing cabinets.",
  },
  {
    icon: Camera,
    text: "Boxes of scanned PDFs and phone photos.",
  },
  {
    icon: Table2,
    text: "Spreadsheets no one has updated since 2017.",
  },
];

export function ProblemStrip() {
  return (
    <section className="bg-secondary/30 py-20">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          {problems.map((p) => (
            <div
              key={p.text}
              className="flex flex-col items-center gap-4 text-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background text-accent shadow-sm">
                <p.icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <p className="max-w-[18rem] text-base leading-relaxed text-foreground">
                {p.text}
              </p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-14 max-w-3xl text-balance text-center font-serif text-2xl leading-snug text-foreground">
          You already paid to build these relationships. Reclaim Data lets you
          use them again.
        </p>
      </div>
    </section>
  );
}
