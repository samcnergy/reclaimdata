import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ParentStrip } from "@/components/marketing/parent-strip";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { ProblemStrip } from "@/components/marketing/problem-strip";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { WaitlistCta } from "@/components/marketing/waitlist-cta";
import { WhatWeExtract } from "@/components/marketing/what-we-extract";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ProblemStrip />
      <HowItWorks />
      <WhatWeExtract />
      <PricingCards />
      <TrustStrip />
      <WaitlistCta />
      <ParentStrip />
    </>
  );
}
