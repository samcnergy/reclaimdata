import Link from "next/link";

import { Logo } from "@/components/shared/logo";

const columns = [
  {
    heading: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/about", label: "About" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/dpa", label: "Data processing" },
    ],
  },
  {
    heading: "Contact",
    links: [
      { href: "mailto:hello@reclaimdata.ai", label: "hello@reclaimdata.ai" },
      { href: "https://rethinkcnergy.com", label: "ReTHINK CNERGY" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/60">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Turn analog customer records into a clean, marketable database.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.heading} className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70">
                {col.heading}
              </h3>
              <ul className="space-y-2 text-sm">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} ReTHINK CNERGY. All rights reserved.
          </p>
          <p>
            A{" "}
            <a
              href="https://rethinkcnergy.com"
              className="font-medium text-foreground transition-colors hover:text-accent"
            >
              ReTHINK CNERGY
            </a>{" "}
            product.
          </p>
        </div>
      </div>
    </footer>
  );
}
