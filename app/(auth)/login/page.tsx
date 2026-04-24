import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="font-serif text-3xl font-medium text-foreground">
          Welcome back.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your Reclaim Data workspace.
        </p>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Create a workspace
        </Link>
        .
      </p>
    </div>
  );
}
