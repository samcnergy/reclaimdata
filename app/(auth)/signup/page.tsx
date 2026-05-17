import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create a workspace",
  robots: { index: false },
};

export default function SignupPage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="font-serif text-3xl font-medium text-foreground">
          Start reclaiming your data.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          $249 per month. Cancel any time.
        </p>
      </div>
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}
