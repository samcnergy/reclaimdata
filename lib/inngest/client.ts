import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "reclaimdata",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

/**
 * Inngest function registrations live in ./functions and are wired into the
 * /api/inngest route handler in later milestones:
 *   - extraction.file.process (milestone 8)
 *   - extraction.email.sync (milestone 14)
 *   - pipeline.build-list (milestone 10)
 *   - validation.{phone,email,address} (milestone 11)
 *   - audit.run (milestone 13)
 */
