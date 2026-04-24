import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Dashboard
        </p>
        <h1 className="mt-2 font-serif text-4xl font-medium text-foreground">
          Welcome to your workspace.
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Upload your first set of documents to start building a client list.
          Everything you process here is private to this workspace.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Customers" value="0" hint="Nothing extracted yet." />
        <StatCard
          label="Data health"
          value="—"
          hint="Score appears after your first audit."
        />
        <StatCard label="Uploads processed" value="0" hint="—" />
        <StatCard label="Last audit" value="Never" hint="Run one anytime." />
      </div>

      <Card className="mt-10 border-dashed">
        <CardHeader>
          <CardTitle>Start with an upload</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-lg text-sm text-muted-foreground">
            Drag in contracts, invoices, scanned PDFs, Word docs, spreadsheets,
            or images. Connect Gmail if you'd like us to read your sent folder.
          </p>
          <Button asChild size="lg" variant="accent">
            <Link href="/app/upload">Upload files</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-6">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </p>
        <p className="font-serif text-3xl text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
