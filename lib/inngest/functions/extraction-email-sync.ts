import { inngest } from "@/lib/inngest/client";

export const extractionEmailSync = inngest.createFunction(
  {
    id: "extraction-email-sync",
    triggers: [{ event: "extraction.email.sync" }],
    retries: 1,
    concurrency: { limit: 1, key: "event.data.connectionId" },
  },
  async ({ event, logger }) => {
    const { connectionId } = event.data as { connectionId: string };
    const { syncEmailConnection } = await import("@/lib/gmail/sync");
    const stats = await syncEmailConnection({ connectionId });
    logger.info(
      `[gmail.sync] connection=${connectionId} fetched=${stats.messagesFetched} uploads=${stats.uploadsCreated} errors=${stats.errors}`,
    );
    return stats;
  },
);
