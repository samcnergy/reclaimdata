export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="max-w-2xl text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          A ReTHINK CNERGY product
        </p>
        <h1 className="font-serif mt-6 text-5xl font-medium leading-[1.05] text-foreground sm:text-6xl">
          Reclaim the golden data hidden in your filing cabinet.
        </h1>
        <p className="mt-8 text-lg leading-relaxed text-muted-foreground">
          Reclaim Data turns decades of paper contracts, Word documents, scanned
          PDFs, spreadsheets, and emails into a clean, validated customer
          database you can actually market to.
        </p>
        <p className="mt-12 text-xs text-muted-foreground/70">
          v0 scaffold. Landing page arrives in milestone 3.
        </p>
      </div>
    </main>
  );
}
