import { inngest } from "@/lib/inngest/client";

/**
 * Per-file extraction pipeline. Milestone 8 covers the contract-only path:
 * PDFs and images → Claude Sonnet 4.6 with strict tool use → extraction_runs
 * row + raw-response blob in Storage. Milestone 9 expands to every document
 * type; milestone 10 consumes extraction_runs and populates customers.
 *
 * Fault tolerance: if extraction fails we mark the upload as failed with
 * the error message. Inngest will retry transient errors automatically.
 */
export const extractionFileProcess = inngest.createFunction(
  {
    id: "extraction-file-process",
    triggers: [{ event: "extraction.file.process" }],
    retries: 2,
  },
  async ({ event, step, logger }) => {
    const { uploadId, workspaceId } = event.data as {
      uploadId: string;
      workspaceId: string;
    };

    await step.run("mark-processing", async () => {
      const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
      const admin = createSupabaseAdminClient();
      await admin
        .from("uploads")
        .update({ status: "processing" })
        .eq("id", uploadId)
        .eq("workspace_id", workspaceId);
    });

    try {
      const result = await step.run("extract", async () => {
        const { runExtraction } = await import("@/lib/extraction/runner");
        return await runExtraction({ uploadId, workspaceId });
      });

      await step.run("mark-completed", async () => {
        const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
        const admin = createSupabaseAdminClient();
        await admin
          .from("uploads")
          .update({
            status: "completed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", uploadId)
          .eq("workspace_id", workspaceId);
      });

      logger.info(
        `[extraction] upload=${uploadId} cost=${result.costCents}¢ duration=${result.durationMs}ms customers=${result.extracted.customers.length} contracts=${result.extracted.contracts.length}`,
      );

      return {
        uploadId,
        extractionRunId: result.extractionRunId,
        documentType: result.extracted.document_type,
        costCents: result.costCents,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await step.run("mark-failed", async () => {
        const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
        const admin = createSupabaseAdminClient();
        await admin
          .from("uploads")
          .update({
            status: "failed",
            error_message: message.slice(0, 500),
            processed_at: new Date().toISOString(),
          })
          .eq("id", uploadId)
          .eq("workspace_id", workspaceId);
      });
      throw err;
    }
  },
);
