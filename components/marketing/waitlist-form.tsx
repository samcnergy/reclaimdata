"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const customerCountOptions = [
  { value: "<500", label: "Fewer than 500" },
  { value: "500-2500", label: "500 – 2,500" },
  { value: "2500-10000", label: "2,500 – 10,000" },
  { value: ">10000", label: "More than 10,000" },
] as const;

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  company: z.string().max(120).optional().or(z.literal("")),
  industry: z.string().max(120).optional().or(z.literal("")),
  approximateCustomerCount: z
    .enum(["<500", "500-2500", "2500-10000", ">10000"])
    .optional()
    .or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

export function WaitlistForm() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      company: "",
      industry: "",
      approximateCustomerCount: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }
      setSubmitted(true);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Unexpected error");
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-confidence-high/40 bg-confidence-high/5 p-8 text-center">
        <CheckCircle2
          className="mx-auto h-10 w-10 text-confidence-high"
          strokeWidth={1.75}
        />
        <h3 className="mt-4 font-serif text-2xl text-foreground">
          You're on the list.
        </h3>
        <p className="mt-3 text-sm text-muted-foreground">
          We'll be in touch when your cohort opens up. Check your inbox for a
          confirmation.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="waitlist-email">Email</Label>
        <Input
          id="waitlist-email"
          type="email"
          autoComplete="email"
          placeholder="you@yourcompany.com"
          {...register("email")}
          aria-invalid={errors.email ? "true" : undefined}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="waitlist-company">
            Company <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="waitlist-company"
            type="text"
            autoComplete="organization"
            placeholder="Your business"
            {...register("company")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="waitlist-industry">
            Industry <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="waitlist-industry"
            type="text"
            placeholder="e.g. roofing, HVAC, landscaping"
            {...register("industry")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="waitlist-count">
          Approximate customer count{" "}
          <span className="text-muted-foreground">(optional)</span>
        </Label>
        <select
          id="waitlist-count"
          className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:text-sm"
          {...register("approximateCustomerCount")}
          defaultValue=""
        >
          <option value="">Pick a range</option>
          {customerCountOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {serverError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        variant="accent"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Submitting…" : "Join the waitlist"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        We'll only email you about Reclaim Data. Unsubscribe anytime.
      </p>
    </form>
  );
}
