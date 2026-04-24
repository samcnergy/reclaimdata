"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Gauge,
  LayoutDashboard,
  Settings,
  Upload,
  Users,
} from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/app/upload", label: "Upload", icon: Upload },
  { href: "/app/customers", label: "Customers", icon: Users },
  { href: "/app/audit", label: "Audit", icon: Gauge },
  { href: "/app/uploads", label: "Uploads", icon: FileText },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  workspaceName,
  userEmail,
}: {
  workspaceName: string;
  userEmail: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border/60 bg-card/60">
      <div className="flex h-16 items-center border-b border-border/60 px-5">
        <Logo />
      </div>
      <div className="border-b border-border/60 px-5 py-4">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          Workspace
        </p>
        <p className="mt-1 truncate text-sm font-medium text-foreground">
          {workspaceName}
        </p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border/60 p-3">
        <div className="rounded-md px-3 py-2 text-xs text-muted-foreground">
          <p className="truncate">{userEmail}</p>
          <form action="/auth/sign-out" method="POST" className="mt-2">
            <button
              type="submit"
              className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
