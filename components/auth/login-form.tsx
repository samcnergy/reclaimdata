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
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/app";

  const [magicLinkSent, setMagicLinkSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (authError) {
      setError(authError.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function sendMagicLink() {
    setError(null);
    const email = getValues("email");
    if (!z.string().email().safeParse(email).success) {
      setError("Enter your email first, then request a magic link.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const origin = window.location.origin;
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (authError) {
      setError(authError.message);
      return;
    }
    setMagicLinkSent(email);
  }

  if (magicLinkSent) {
    return (
      <div className="rounded-xl border border-confidence-high/40 bg-confidence-high/5 p-6 text-center">
        <h2 className="font-serif text-2xl text-foreground">Check your inbox</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          We sent a magic link to{" "}
          <strong className="font-semibold">{magicLinkSent}</strong>. Click it
          to sign in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
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
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="w-full"
        onClick={sendMagicLink}
      >
        Email me a magic link instead
      </Button>
    </form>
  );
}
