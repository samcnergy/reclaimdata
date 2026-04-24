"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const schema = z.object({
  fullName: z.string().min(2, "Please enter your name").max(120),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/app";
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const origin = window.location.origin;

    const { data, error: authError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.fullName },
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (authError) {
      setError(authError.message);
      return;
    }

    // If email confirmation is required, session will be null.
    if (!data.session) {
      setCheckEmail(values.email);
      return;
    }

    router.push(next);
    router.refresh();
  }

  if (checkEmail) {
    return (
      <div className="rounded-xl border border-confidence-high/40 bg-confidence-high/5 p-6 text-center">
        <h2 className="font-serif text-2xl text-foreground">Confirm your email</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          We sent a confirmation link to{" "}
          <strong className="font-semibold">{checkEmail}</strong>. Click it to
          finish setting up your workspace.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="signup-name">Full name</Label>
        <Input
          id="signup-name"
          type="text"
          autoComplete="name"
          {...register("fullName")}
        />
        {errors.fullName && (
          <p className="text-xs text-destructive">{errors.fullName.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating your workspace…" : "Create your workspace"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        By signing up you agree to our{" "}
        <a href="/terms" className="underline-offset-4 hover:underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline-offset-4 hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
