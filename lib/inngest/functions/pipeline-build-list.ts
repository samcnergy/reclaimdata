import { inngest } from "@/lib/inngest/client";

/**
 * Orchestrator function: runs the normalize → dedupe → load pipeline
 * across every completed extraction run in the workspace.
 *
 * Events:
 *   pipeline.build-list  →  fired by /api/build-list
 */
export const pipelineBuildList = inngest.createFunction(
  {
    id: "pipeline-build-list",
    triggers: [{ event: "pipeline.build-list" }],
    retries: 1,
    concurrency: { limit: 1, key: "event.data.workspaceId" },
  },
  async ({ event, logger }) => {
    const { workspaceId } = event.data as { workspaceId: string };

    const { buildClientList } = await import("@/lib/pipeline/build-list");
    const dbUrl = process.env.SUPABASE_DB_URL;
    if (!dbUrl) throw new Error("SUPABASE_DB_URL is not set");

    const stats = await buildClientList({ workspaceId, dbUrl });

    logger.info(
      `[build-list] ws=${workspaceId} runs=${stats.runsProcessed} created=${stats.customersCreated} merged=${stats.customersMerged} queued=${stats.candidatesQueued} contracts=${stats.contractsCreated}`,
    );

    return stats;
  },
);
